"use client";

// Type-only — see the matching note in `../code-editor/code-editor.tsx`. The
// engine loads at RUNTIME via `import("monaco-editor")` in the mount effect
// below (`monacoRef`), so importing this module (e.g. transitively, via the
// barrel) never evaluates Monaco.
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
import { applyBrandTheme } from "../lib/monaco-theme-bridge";
import { useDataTheme } from "../lib/use-data-theme";

export type MonacoDiffEditor = monaco.editor.IStandaloneDiffEditor;

/** Same pattern as `code-editor.tsx`'s `MonacoNamespace`. */
type MonacoNamespace = typeof monaco;

export interface DiffEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** Left/original document. */
  original: string;
  /** Right/modified document. */
  modified: string;
  /** Monaco language id applied to both sides. Defaults to "typescript". */
  language?: string;
  /** Read-only (diffs are read-only by default). */
  readOnly?: boolean;
  /** Side-by-side (true) vs inline (false) diff. Defaults to side-by-side. */
  renderSideBySide?: boolean;
  /** Editor height. Number → px. Defaults to "100%". */
  height?: number | string;
  /**
   * Accessible name for the diff. Each side is a Monaco editor with its own focusable
   * screen-reader surface, so both get the name, suffixed " (original)" / " (modified)" —
   * without it axe reports `aria-input-field-name` on both sides. Maps onto Monaco's
   * `originalAriaLabel`/`modifiedAriaLabel` diff options, and is re-sent with every option
   * update the component makes (Monaco resets both names on any update that omits them).
   */
  ariaLabel?: string;
  /** Passthrough Monaco diff options (merged over the defaults). */
  options?: monaco.editor.IStandaloneDiffEditorConstructionOptions;
  /** Called once the diff editor + monaco namespace are ready. */
  onMount?: (editor: MonacoDiffEditor, monacoApi: MonacoNamespace) => void;
}

const BASE_OPTIONS: monaco.editor.IStandaloneDiffEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  ignoreTrimWhitespace: false,
  padding: { top: 12, bottom: 12 },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
};

/**
 * Both sides' accessible names, as the diff editor's own construction options. Every diff-level
 * `updateOptions` call re-derives each side's `ariaLabel` from the CHANGED options only (an
 * update without `originalAriaLabel`/`modifiedAriaLabel` resets both sides to `""`), so every
 * update the component makes spreads these in. The keys are construction options in Monaco's
 * typings but honoured at runtime by `updateOptions` too, hence the cast.
 */
function ariaOptions(ariaLabel: string | undefined): monaco.editor.IDiffEditorOptions {
  if (ariaLabel === undefined) return {};
  return {
    originalAriaLabel: `${ariaLabel} (original)`,
    modifiedAriaLabel: `${ariaLabel} (modified)`,
  } as monaco.editor.IDiffEditorConstructionOptions;
}

/**
 * A token-themed Monaco diff editor (original ↔ modified). Same theming bridge
 * and chrome story as {@link CodeEditor}; reads as a side-by-side or inline diff.
 */
export const DiffEditor = forwardRef<MonacoDiffEditor | null, DiffEditorProps>(function DiffEditor(
  {
    original,
    modified,
    language = "typescript",
    readOnly = true,
    renderSideBySide = true,
    height = "100%",
    ariaLabel,
    options,
    onMount,
    className,
    style,
    ...props
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<MonacoDiffEditor | null>(null);
  const { theme, revision } = useDataTheme();
  // Populated once the dynamic `import("monaco-editor")` below resolves.
  // `editor` (React state) is only ever set AFTER this ref, so every other
  // effect that reads both may assume: `editor` truthy implies this truthy.
  const monacoRef = useRef<MonacoNamespace | null>(null);

  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  useImperativeHandle<MonacoDiffEditor | null, MonacoDiffEditor | null>(ref, () => editor, [
    editor,
  ]);

  // Mount once. Monaco itself loads lazily (see the top-of-file note) — merely
  // importing this module never evaluates the engine.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: MonacoDiffEditor | null = null;
    let originalModel: monaco.editor.ITextModel | null = null;
    let modifiedModel: monaco.editor.ITextModel | null = null;

    import("monaco-editor").then((monacoApi) => {
      if (cancelled) return;
      monacoRef.current = monacoApi;
      instance = monacoApi.editor.createDiffEditor(container, {
        ...BASE_OPTIONS,
        readOnly,
        renderSideBySide,
        ...ariaOptions(ariaLabel),
        ...options,
      });
      originalModel = monacoApi.editor.createModel(original, language);
      modifiedModel = monacoApi.editor.createModel(modified, language);
      instance.setModel({ original: originalModel, modified: modifiedModel });
      // Theme is applied by the effect below once `setEditor` runs.
      setEditor(instance);
      onMountRef.current?.(instance, monacoApi);
    });

    return () => {
      cancelled = true;
      instance?.dispose();
      originalModel?.dispose();
      modifiedModel?.dispose();
      monacoRef.current = null;
      setEditor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const original_ = editor?.getModel()?.original;
    if (original_ && original_.getValue() !== original) original_.setValue(original);
  }, [editor, original]);

  useEffect(() => {
    const modified_ = editor?.getModel()?.modified;
    if (modified_ && modified_.getValue() !== modified) modified_.setValue(modified);
  }, [editor, modified]);

  useEffect(() => {
    const monacoApi = monacoRef.current;
    const models = editor?.getModel();
    if (!models || !monacoApi) return;
    monacoApi.editor.setModelLanguage(models.original, language);
    monacoApi.editor.setModelLanguage(models.modified, language);
  }, [editor, language]);

  useEffect(() => {
    editor?.updateOptions({ readOnly, renderSideBySide, ...ariaOptions(ariaLabel) });
  }, [editor, readOnly, renderSideBySide, ariaLabel]);

  useEffect(() => {
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;
    try {
      applyBrandTheme(monacoApi, theme);
    } catch (err) {
      console.error("[@elabs-ai/components-editor] failed to apply brand theme", err);
    }
    // `revision` re-applies once the data-theme attribute settles. See CodeEditor.
  }, [editor, theme, revision]);

  const resolvedStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      ref={containerRef}
      data-testid="diff-editor"
      className={cn("h-full w-full overflow-hidden bg-background text-foreground", className)}
      style={resolvedStyle}
      {...props}
    />
  );
});
