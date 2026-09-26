import { useEffect, useId, useRef, useState } from "react";
import {
  CodeEditor,
  type CodeEditorProps,
  type MonacoCodeEditor,
} from "@elabs-ai/components-editor";
import { Kbd } from "@elabs-ai/components-ui";
import type { CompiledDiagram, DiagramIssue } from "../state/compile-text";
import { diagramActions, diagramStore, useDiagram } from "../state/diagram-store";
import { elementAt, elementRanges, type ElementRange } from "../state/pipeline";
import { IssuesPanel } from "./issues-panel";

/** `onMount`'s second argument. The editor package does not export the name; never import Monaco's global. */
type MonacoApi = Parameters<NonNullable<CodeEditorProps["onMount"]>>[1];

/** Marker owner for `setModelMarkers`: replacing it replaces only our markers. */
const MARKER_OWNER = "arch-diagram";

/** Monaco's `editor.action.toggleTabFocusMode` default chord: Ctrl+Shift+M on macOS, Ctrl+M elsewhere. */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);
const TAB_FOCUS_KEYS = IS_MAC ? ["Ctrl", "Shift", "M"] : ["Ctrl", "M"];

/** Keep Monaco on its <textarea> surface (see the P4 note at the CodeEditor). */
const EDITOR_OPTIONS = { editContext: false } as const;

/** Element ranges per compile, built on first use (a cursor move or a canvas selection). */
const rangeCache = new WeakMap<CompiledDiagram, ElementRange[]>();
function rangesOf(compiled: CompiledDiagram, text: string): ElementRange[] {
  let ranges = rangeCache.get(compiled);
  if (!ranges) {
    ranges = elementRanges(text, compiled);
    rangeCache.set(compiled, ranges);
  }
  return ranges;
}

function toMarkers(monacoApi: MonacoApi, issues: readonly DiagramIssue[]) {
  const severity = {
    error: monacoApi.MarkerSeverity.Error,
    warning: monacoApi.MarkerSeverity.Warning,
    info: monacoApi.MarkerSeverity.Info,
  } as const;
  return issues.map((issue) => {
    const start = issue.range?.start ?? { line: 1, col: 1 };
    const end = issue.range?.end ?? start;
    return {
      severity: severity[issue.severity],
      message: issue.message,
      code: issue.code,
      source: issue.stage,
      startLineNumber: start.line,
      startColumn: start.col,
      endLineNumber: end.line,
      endColumn: end.col,
    };
  });
}

/**
 * The left-hand YAML editor (DG-02), wired to the store (DG-12): validator markers on the
 * text, the issues list below it, and selection kept in step with the canvas.
 */
export function EditorPane() {
  const hintId = useId();
  const text = useDiagram((s) => s.text);
  const compiled = useDiagram((s) => s.compiled);
  const selectedId = useDiagram((s) => s.selectedId);
  const editorRef = useRef<MonacoCodeEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const [mounted, setMounted] = useState(false);

  const onMount: CodeEditorProps["onMount"] = (editor, monacoApi) => {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    // Editor → canvas: the cursor inside an entry selects it. Only while the editor has
    // focus, so a programmatic cursor move (an issue click) is not read as a selection.
    // Disposed with the editor on unmount.
    editor.onDidChangeCursorPosition((event) => {
      const model = editor.getModel();
      if (!model || !editor.hasTextFocus()) return;
      const { compiled: latest, compiledText } = diagramStore.get();
      const offset = model.getOffsetAt(event.position);
      diagramActions.select(elementAt(rangesOf(latest, compiledText), offset));
    });
    setMounted(true);
  };

  // Markers: every issue, every stage, on its own range.
  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!mounted || !monacoApi || !model) return;
    monacoApi.editor.setModelMarkers(model, MARKER_OWNER, toMarkers(monacoApi, compiled.issues));
  }, [compiled, mounted]);

  // Canvas → editor: highlight the selected entry; reveal it when the canvas chose it.
  const highlight = useRef<ReturnType<MonacoCodeEditor["createDecorationsCollection"]> | null>(
    null,
  );
  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor) return;
    highlight.current ??= editor.createDecorationsCollection();
    const { compiledText } = diagramStore.get();
    const entry =
      selectedId === null
        ? undefined
        : rangesOf(compiled, compiledText).find((r) => r.id === selectedId);
    if (!entry) {
      highlight.current.clear();
      return;
    }
    const { start, end } = entry.range;
    const range = {
      startLineNumber: start.line,
      startColumn: start.col,
      endLineNumber: end.line,
      endColumn: end.col,
    };
    highlight.current.set([{ range, options: { className: "bg-accent", isWholeLine: false } }]);
    if (!editor.hasTextFocus()) editor.revealRangeInCenterIfOutsideViewport(range);
  }, [selectedId, compiled, mounted]);

  const reveal = (issue: DiagramIssue) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = issue.range?.start ?? { line: 1, col: 1 };
    editor.setPosition({ lineNumber: start.line, column: start.col });
    editor.revealLineInCenter(start.line);
    editor.focus();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={text}
          onChange={diagramActions.setText}
          onMount={onMount}
          language="yaml"
          height="100%"
          ariaLabel="Diagram YAML"
          ariaInvalid={!compiled.ok}
          // P4: library gap — CodeEditor has no disclosed way to Tab out (Tab indents) and
          // replaces Monaco's own accessibility hint in the label; the caption below advises
          // the chord (WCAG 2.1.2). See docs/findings/DG-02-shell-a11y.md.
          ariaDescribedBy={hintId}
          contextMenu="brand"
          // P4: library gap — CodeEditor stamps aria-invalid/aria-describedby on Monaco's
          // <textarea>, but Monaco 0.55 in Chromium focuses its EditContext <div> and hides
          // the textarea from AT. Off, the textarea is the focused surface again.
          // docs/findings/DG-12-editor-integration.md.
          options={EDITOR_OPTIONS}
        />
      </div>
      <IssuesPanel issues={compiled.issues} onReveal={reveal} />
      <p id={hintId} className="border-t px-3 py-1.5 text-caption text-muted-foreground">
        {TAB_FOCUS_KEYS.map((key, index) => (
          <span key={key}>
            {index > 0 && "+"}
            <Kbd>{key}</Kbd>
          </span>
        ))}{" "}
        switches Tab between indenting and moving focus out of the editor.
      </p>
    </div>
  );
}
