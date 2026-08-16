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
import { applyBrandTheme } from "../lib/monaco-theme-bridge";
import { useDataTheme } from "../lib/use-data-theme";

export type MonacoDiffEditor = monaco.editor.IStandaloneDiffEditor;

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
  /** Passthrough Monaco diff options (merged over the defaults). */
  options?: monaco.editor.IStandaloneDiffEditorConstructionOptions;
  /** Called once the diff editor + monaco namespace are ready. */
  onMount?: (editor: MonacoDiffEditor, monacoApi: typeof monaco) => void;
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

  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  useImperativeHandle<MonacoDiffEditor | null, MonacoDiffEditor | null>(ref, () => editor, [
    editor,
  ]);

  // Mount once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = monaco.editor.createDiffEditor(container, {
      ...BASE_OPTIONS,
      readOnly,
      renderSideBySide,
      ...options,
    });
    const originalModel = monaco.editor.createModel(original, language);
    const modifiedModel = monaco.editor.createModel(modified, language);
    instance.setModel({ original: originalModel, modified: modifiedModel });
    // Theme is applied by the effect below once `setEditor` runs.
    setEditor(instance);
    onMountRef.current?.(instance, monaco);

    return () => {
      instance.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
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
    const models = editor?.getModel();
    if (!models) return;
    monaco.editor.setModelLanguage(models.original, language);
    monaco.editor.setModelLanguage(models.modified, language);
  }, [editor, language]);

  useEffect(() => {
    editor?.updateOptions({ readOnly, renderSideBySide });
  }, [editor, readOnly, renderSideBySide]);

  useEffect(() => {
    if (!editor) return;
    try {
      applyBrandTheme(monaco, theme);
    } catch (err) {
      console.error("[@qlik-coe-emea/qlabs-components-editor] failed to apply brand theme", err);
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
