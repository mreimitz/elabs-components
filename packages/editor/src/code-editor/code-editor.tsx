"use client";

import * as monaco from "monaco-editor";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
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
  onMount?: (editor: MonacoCodeEditor, monacoApi: typeof monaco) => void;
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
 * editor matches the active `data-theme` (all three themes).
 *
 * Workers (for completions/diagnostics) are wired by importing
 * `@qlik-coe-emea/qlabs-components-editor/monaco-environment` once at the app entry.
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

  // Latest callbacks via refs so the mount effect can run exactly once.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  useImperativeHandle<MonacoCodeEditor | null, MonacoCodeEditor | null>(ref, () => editor, [
    editor,
  ]);

  // Mount once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const model = monaco.editor.createModel(
      value ?? defaultValue ?? "",
      language,
      path ? monaco.Uri.parse(`inmemory://brand/${path}`) : undefined,
    );
    const instance = monaco.editor.create(container, {
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
    const sub = instance.onDidChangeModelContent(() => {
      onChangeRef.current?.(instance.getValue());
    });
    // `setEditor` triggers the theming effect below; keeping theme application
    // there (not here) guarantees it never blocks editor setup.
    setEditor(instance);
    onMountRef.current?.(instance, monaco);

    return () => {
      sub.dispose();
      instance.dispose();
      model.dispose();
      setEditor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled value sync (only when it diverges, to preserve cursor/undo).
  useEffect(() => {
    if (!editor || value === undefined) return;
    if (value !== editor.getValue()) editor.setValue(value);
  }, [editor, value]);

  useEffect(() => {
    const model = editor?.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
  }, [editor, language]);

  useEffect(() => {
    editor?.updateOptions({ readOnly, contextmenu: contextMenu === "monaco" });
  }, [editor, readOnly, contextMenu]);

  useEffect(() => {
    if (!editor) return;
    try {
      applyBrandTheme(monaco, theme);
    } catch (err) {
      console.error("[@qlik-coe-emea/qlabs-components-editor] failed to apply brand theme", err);
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
