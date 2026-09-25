"use client";

// Type-only: the barrel (`.`) exports this component alongside lightweight
// chrome (`CopyButton`, `EDITOR_LANGUAGES`) that must stay import-safe without
// Monaco. A `monaco-editor` VALUE import here would be evaluated the moment
// anything imports the barrel, pulling megabytes of Monaco + touching browser
// globals even for a consumer that only wants `CopyButton`. The engine is
// loaded at RUNTIME via `import("monaco-editor")` inside the mount effect
// below — see `monacoRef`.
import type * as monaco from "monaco-editor";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { EditorContextMenu } from "../editor-context-menu";
import { applyBrandTheme } from "../lib/monaco-theme-bridge";
import { useDataTheme } from "../lib/use-data-theme";

export type MonacoCodeEditor = monaco.editor.IStandaloneCodeEditor;

/** A Monaco editor action (system command + optional hotkey + palette/menu entry). */
export type EditorAction = monaco.editor.IActionDescriptor;

/**
 * The runtime value type handed back by `import("monaco-editor")` — same
 * namespace as the type-only `monaco` import above (`typeof` a type-only
 * namespace import resolves to the module's own type), used for `monacoRef`
 * and `onMount`'s second argument.
 */
type MonacoNamespace = typeof monaco;

export interface CodeEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Controlled content. Pair with `onChange`. */
  value?: string;
  /** Initial content for uncontrolled use. */
  defaultValue?: string;
  /** Fires on every edit with the full document text. */
  onChange?: (value: string) => void;
  /** Monaco language id (e.g. "typescript", "json"). Defaults to "typescript". */
  language?: string;
  /** Model path/URI — drives per-file language services + diagnostics. */
  path?: string;
  /** Render the editor read-only. */
  readOnly?: boolean;
  /** Editor height. Number → px. Defaults to "100%" (size via the parent). */
  height?: number | string;
  /** Passthrough Monaco construction options (merged over the defaults). */
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  /**
   * Accessible name for the editor. Maps onto Monaco's `ariaLabel` construction
   * option AND the inner screen-reader `<textarea>` (`aria-label`), so assistive
   * tech announces a name. Spreading `aria-label` via `...props` only lands on the
   * wrapper div and never reaches Monaco's focusable textarea — use this instead.
   */
  ariaLabel?: string;
  /** Sets `aria-invalid` on Monaco's inner `<textarea>` to convey validity. */
  ariaInvalid?: boolean;
  /** Sets `aria-describedby` on Monaco's inner `<textarea>` (e.g. an error id). */
  ariaDescribedBy?: string;
  /**
   * Right-click menu. `"brand"` (default) replaces Monaco's built-in menu with
   * brand-ui's `ContextMenu`; `"monaco"` keeps Monaco's themed menu; `"none"`
   * disables it.
   */
  contextMenu?: "brand" | "monaco" | "none";
  /** Called once the editor instance + monaco namespace are ready. */
  onMount?: (editor: MonacoCodeEditor, monacoApi: MonacoNamespace) => void;
  /**
   * Declarative Monaco editor actions — each registers a command (run on its
   * `keybindings`, in the command palette, and optionally the context menu via
   * `contextMenuGroupId`). Wraps `editor.addAction`; re-registered when the array
   * identity changes, disposed on unmount. Build keybindings with the re-exported
   * `monaco` namespace, e.g. `keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash]`.
   *
   * Note: a context-menu entry only shows when `contextMenu="monaco"`, but the
   * keybinding and command palette work regardless. Memoize `actions` to avoid
   * re-registering on every render.
   */
  actions?: EditorAction[];
}

/**
 * The smallest single edit that turns `oldValue` into `newValue`, found by
 * trimming the common prefix and suffix. Used instead of a wholesale
 * `editor.setValue()` when syncing a controlled `value`: `setValue` replaces
 * the entire model in one shot, which wipes the undo stack and always resets
 * the cursor to the start of the document. Routing the same change through
 * `editor.executeEdits` with just the differing middle span keeps it a single
 * coalescable undo entry and leaves the cursor/selection outside the edited
 * span untouched by Monaco's own position mapping.
 */
function computeMinimalEdit(
  oldValue: string,
  newValue: string,
): { start: number; endOld: number; text: string } {
  const maxCommon = Math.min(oldValue.length, newValue.length);
  let start = 0;
  while (start < maxCommon && oldValue.charCodeAt(start) === newValue.charCodeAt(start)) {
    start++;
  }
  let endOld = oldValue.length;
  let endNew = newValue.length;
  while (
    endOld > start &&
    endNew > start &&
    oldValue.charCodeAt(endOld - 1) === newValue.charCodeAt(endNew - 1)
  ) {
    endOld--;
    endNew--;
  }
  return { start, endOld, text: newValue.slice(start, endNew) };
}

const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  fontLigatures: true,
  fontSize: 13,
  lineNumbersMinChars: 3,
  padding: { top: 12, bottom: 12 },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
};

/**
 * A token-themed Monaco editor wrapped as a brand-ui React component. Monaco
 * renders its own editing surface + widgets; this wrapper owns lifecycle,
 * controlled/uncontrolled value, and applies the brand theme bridge so the
 * editor matches the active `data-theme` (every theme).
 *
 * Workers (for completions/diagnostics) are wired by importing
 * `@elabs-ai/components-editor/monaco-environment` once at the app entry.
 */
export const CodeEditor = forwardRef<MonacoCodeEditor | null, CodeEditorProps>(function CodeEditor(
  {
    value,
    defaultValue,
    onChange,
    language = "typescript",
    path,
    readOnly = false,
    height = "100%",
    options,
    ariaLabel,
    ariaInvalid,
    ariaDescribedBy,
    contextMenu = "brand",
    onMount,
    actions,
    className,
    style,
    ...props
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<MonacoCodeEditor | null>(null);
  const { theme, revision } = useDataTheme();
  // The CURRENT model, tracked outside React state: a `path` change swaps it
  // (see the effect below) without waiting on a re-render, and unmount must
  // dispose whichever model is live at that point, not the one from mount.
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  // The dynamically-imported `monaco-editor` module, once loaded. `editor`
  // (React state) is only ever set AFTER this ref is populated (see the mount
  // effect), so every other effect below that reads both may assume: `editor`
  // truthy implies `monacoRef.current` truthy.
  const monacoRef = useRef<MonacoNamespace | null>(null);

  // Latest callbacks via refs so the mount effect can run exactly once.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  useImperativeHandle<MonacoCodeEditor | null, MonacoCodeEditor | null>(ref, () => editor, [
    editor,
  ]);

  // Mount once. Monaco itself loads lazily (`import("monaco-editor")`) so the
  // engine is only fetched/evaluated once a `CodeEditor` actually mounts, never
  // merely by importing this module (see the top-of-file note). `cancelled`
  // guards against the component unmounting (or `container` going away) before
  // the dynamic import resolves.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: MonacoCodeEditor | null = null;
    let model: monaco.editor.ITextModel | null = null;
    let sub: { dispose(): void } | null = null;

    import("monaco-editor").then((monacoApi) => {
      if (cancelled) return;
      monacoRef.current = monacoApi;
      model = monacoApi.editor.createModel(
        value ?? defaultValue ?? "",
        language,
        path ? monacoApi.Uri.parse(`inmemory://brand/${path}`) : undefined,
      );
      modelRef.current = model;
      instance = monacoApi.editor.create(container, {
        ...BASE_OPTIONS,
        readOnly,
        // Disable Monaco's own menu unless explicitly opted into; "brand" renders
        // brand-ui's ContextMenu around the editor instead.
        contextmenu: contextMenu === "monaco",
        // Monaco's accessible name comes from this construction option (it writes it
        // onto its inner screen-reader <textarea>), not from a wrapper-div attribute.
        ...(ariaLabel !== undefined ? { ariaLabel } : null),
        model,
        ...options,
      });
      sub = instance.onDidChangeModelContent(() => {
        onChangeRef.current?.(instance!.getValue());
      });
      // Monaco now mounts asynchronously, so stamp the initial aria-* onto its
      // textarea right away — otherwise it is briefly exposed without a name
      // until the aria sync effect below runs on the next commit.
      const textarea = instance.getDomNode()?.querySelector("textarea");
      if (textarea) {
        if (ariaLabel !== undefined) textarea.setAttribute("aria-label", ariaLabel);
        if (ariaInvalid !== undefined) textarea.setAttribute("aria-invalid", String(ariaInvalid));
        if (ariaDescribedBy !== undefined)
          textarea.setAttribute("aria-describedby", ariaDescribedBy);
      }
      // Touch-capable browsers get an extra `iPadShowKeyboard` contribution: a
      // zero-size proxy `<textarea>` whose only job is triggering the on-screen
      // keyboard. It isn't a real input, so it never needs a label — just hide
      // it from assistive tech and drop it from tab order once, at mount (it
      // has no editable content, so it never needs the reactive prop-tracking
      // the main textarea gets above).
      const touchKeyboardProxy = instance
        .getDomNode()
        ?.querySelector<HTMLElement>(".iPadShowKeyboard");
      if (touchKeyboardProxy) {
        touchKeyboardProxy.setAttribute("aria-hidden", "true");
        touchKeyboardProxy.setAttribute("tabindex", "-1");
      }
      // `setEditor` triggers the theming effect below; keeping theme application
      // there (not here) guarantees it never blocks editor setup.
      setEditor(instance);
      onMountRef.current?.(instance, monacoApi);
    });

    return () => {
      cancelled = true;
      sub?.dispose();
      instance?.dispose();
      model?.dispose();
      modelRef.current = null;
      monacoRef.current = null;
      setEditor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `path` drives the model's URI, which Monaco never lets you change on an
  // existing model — a later `path` change (e.g. `CodeWorkspace` switching
  // files) was previously just ignored. Swap in a fresh model carrying the
  // CURRENT value/language under the new URI, and dispose the old one; a
  // per-file undo stack is Monaco's normal behavior for a model swap.
  useEffect(() => {
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;
    const current = modelRef.current;
    const currentUri = current?.uri?.toString();
    const nextUri = path ? monacoApi.Uri.parse(`inmemory://brand/${path}`).toString() : undefined;
    if (currentUri === nextUri) return;

    const nextModel = monacoApi.editor.createModel(
      current?.getValue() ?? value ?? defaultValue ?? "",
      language,
      path ? monacoApi.Uri.parse(`inmemory://brand/${path}`) : undefined,
    );
    editor.setModel(nextModel);
    modelRef.current = nextModel;
    current?.dispose();
    // `value`/`defaultValue`/`language` are read once, at the moment of the
    // swap, to seed the new model — not tracked as reactive deps here; the
    // controlled-value and language effects below correct them independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, path]);

  // Controlled value sync — only when it diverges, and via the smallest
  // `executeEdits` span rather than `setValue()`: a full-document `setValue`
  // wipes the undo stack and always resets the cursor to the start.
  useEffect(() => {
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi || value === undefined) return;
    const model = editor.getModel();
    if (!model) return;
    const current = model.getValue();
    if (value === current) return;
    const { start, endOld, text } = computeMinimalEdit(current, value);
    const range = monacoApi.Range.fromPositions(
      model.getPositionAt(start),
      model.getPositionAt(endOld),
    );
    editor.executeEdits("controlled-value-sync", [{ range, text }]);
  }, [editor, value]);

  useEffect(() => {
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (model && monacoApi) monacoApi.editor.setModelLanguage(model, language);
  }, [editor, language]);

  useEffect(() => {
    editor?.updateOptions({ readOnly, contextmenu: contextMenu === "monaco" });
  }, [editor, readOnly, contextMenu]);

  // `options` after mount: the construction-time spread only ever applied it
  // once. A caller changing `options` (e.g. toggling `minimap`) now reaches
  // the live editor via `updateOptions`, same as `readOnly`/`contextMenu` above.
  useEffect(() => {
    if (!editor || !options) return;
    editor.updateOptions(options);
  }, [editor, options]);

  useEffect(() => {
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;
    try {
      applyBrandTheme(monacoApi, theme);
    } catch (err) {
      console.error("[@elabs-ai/components-editor] failed to apply brand theme", err);
    }
    // `revision` forces a re-apply after the data-theme attribute settles (even
    // when the parsed theme name equals the default), so tokens are re-read.
  }, [editor, theme, revision]);

  // Forward accessibility attributes onto Monaco's focusable screen-reader
  // <textarea> (its real interactive surface), kept in sync as props change.
  // `ariaLabel` flows through Monaco's option, BUT Monaco only writes it onto the
  // textarea when accessibilitySupport isn't "off" (auto-detection can disable it,
  // e.g. headless). So we also set aria-label directly on the textarea — belt and
  // suspenders — alongside aria-invalid/aria-describedby (which aren't Monaco options).
  useEffect(() => {
    if (!editor) return;
    if (ariaLabel !== undefined) editor.updateOptions({ ariaLabel });
    const textarea = editor.getDomNode()?.querySelector("textarea");
    if (!textarea) return;
    if (ariaLabel === undefined) textarea.removeAttribute("aria-label");
    else textarea.setAttribute("aria-label", ariaLabel);
    if (ariaInvalid === undefined) textarea.removeAttribute("aria-invalid");
    else textarea.setAttribute("aria-invalid", String(ariaInvalid));
    if (ariaDescribedBy === undefined) textarea.removeAttribute("aria-describedby");
    else textarea.setAttribute("aria-describedby", ariaDescribedBy);
  }, [editor, ariaLabel, ariaInvalid, ariaDescribedBy]);

  // Declarative actions: register each on the editor instance and dispose on
  // array-identity change or unmount. Re-registering when the array reference
  // changes is intentional and correct (unlike onChange, a re-register is cheap
  // and desired). Consumers should memoize `actions` to avoid unnecessary churn.
  useEffect(() => {
    if (!editor || !actions || actions.length === 0) return;
    const disposables = actions.map((a) => editor.addAction(a));
    return () => disposables.forEach((d) => d.dispose());
  }, [editor, actions]);

  const resolvedStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  const editorEl = (
    <div
      ref={containerRef}
      data-testid="code-editor"
      className={cn("h-full w-full overflow-hidden bg-background text-foreground", className)}
      style={resolvedStyle}
      {...props}
    />
  );

  if (contextMenu === "brand") {
    return (
      <EditorContextMenu editor={editor} readOnly={readOnly}>
        {editorEl}
      </EditorContextMenu>
    );
  }
  return editorEl;
});
