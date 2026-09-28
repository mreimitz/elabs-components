import { useEffect, useId, useRef, useState } from "react";
import {
  CodeEditor,
  type CodeEditorProps,
  type MonacoCodeEditor,
} from "@elabs-ai/components-editor";
import { Kbd } from "@elabs-ai/components-ui";
import { useLens } from "../shell/lens-store";
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

/**
 * The canvas-selected entry in the text: a wash over its range and a rail in the gutter beside
 * each of its lines. Review-wave3 N4: `--accent` is a hover wash that a neutral theme may set
 * within a hair of the editor's background (qlik-light: 1.02:1), so the wash cannot be the only
 * channel; the rail is the conventions' accent-rail gesture. `primary-text`, not `primary`: the
 * light theme's lime primary is 1.36:1 on the gutter, its text rung is at least 6:1 in light,
 * dark and qlik-light. The class names are literal so Tailwind generates them.
 */
const HIGHLIGHT_OPTIONS = {
  className: "bg-accent",
  isWholeLine: false,
  linesDecorationsClassName: "border-s-2 border-s-primary-text",
} as const;

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
  const loadCount = useDiagram((s) => s.loadCount);
  // The technical file is read-only for exactly the window `canvas-pane.tsx`'s
  // `technicalLensLocked` closes every other technical write path for (the visual lens showing,
  // or a switch to/from it mid-flight): without this, typing here still autosaved the file even
  // though the inspector was already locked for the same document.
  const lensLocked = useLens((s) => s.position !== 0 || s.target !== "technical");
  const editorRef = useRef<MonacoCodeEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  // The editor instance's generation: a loaded document mounts a new one (below), and every
  // effect that touches the editor re-runs against it. 0 until the first mount.
  const [mounted, setMounted] = useState(0);
  // Canvas → editor highlight, one collection per editor instance.
  const highlight = useRef<ReturnType<MonacoCodeEditor["createDecorationsCollection"]> | null>(
    null,
  );

  const onMount: CodeEditorProps["onMount"] = (editor, monacoApi) => {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    highlight.current = editor.createDecorationsCollection();
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
    setMounted((generation) => generation + 1);
  };

  // Markers: every issue, every stage, on its own range.
  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!mounted || !monacoApi || !model) return;
    monacoApi.editor.setModelMarkers(model, MARKER_OWNER, toMarkers(monacoApi, compiled.issues));
    // A replaced editor disposes its model; its markers must not outlive it.
    return () => monacoApi.editor.setModelMarkers(model, MARKER_OWNER, []);
  }, [compiled, mounted]);

  // Canvas → editor: highlight the selected entry; reveal it when the canvas chose it.
  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor || !highlight.current) return;
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
    highlight.current.set([{ range, options: HIGHLIGHT_OPTIONS }]);
    if (!editor.hasTextFocus()) editor.revealRangeInCenterIfOutsideViewport(range);
  }, [selectedId, compiled, mounted]);

  // DG-14: "Show in YAML" (inspector) — put the cursor on the selected entry and focus it.
  const revealRequest = useDiagram((s) => s.revealRequest);
  // The request last handled: a new editor instance (a loaded document) must not replay it.
  const revealed = useRef(0);
  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor || revealRequest === revealed.current) return;
    revealed.current = revealRequest;
    const { compiled: latest, compiledText, selectedId: id } = diagramStore.get();
    const entry = id === null ? undefined : rangesOf(latest, compiledText).find((r) => r.id === id);
    if (!entry) return;
    const { start } = entry.range;
    editor.setPosition({ lineNumber: start.line, column: start.col });
    editor.revealLineInCenter(start.line);
    editor.focus();
  }, [revealRequest, mounted]);

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
      {/* P4: library gap — CodeEditor draws no focus indicator (wave-2 review m2). The ring is
          inset, because the resizable panel clips an outside ring, and drawn on an ::after
          overlay, because Monaco's opaque layers cover the wrapper's own box-shadow and
          outline. docs/findings/DG-13-examples-review.md. */}
      <div className="relative min-h-0 flex-1 after:pointer-events-none after:absolute after:inset-0 has-[textarea:focus-visible]:after:focus-ring-static-inset">
        <CodeEditor
          // Review-wave3 M2: a loaded document (an example, a file, a share link: every
          // `loadText`, the same boundary DG-16's history resets at) gets a new editor, so
          // Monaco's undo stack starts at the load and ⌘Z inside the editor cannot bring the
          // previous document back.
          // P4: library gap — `path` swaps in a fresh model, but seeds it with the OLD model's
          // text; the new `value` then arrives through `executeEdits` and is itself undoable
          // (packages/editor/src/code-editor/code-editor.tsx:291-299, 306-322). A remount is
          // the only way to reset the undo stack from outside. docs/findings/DG-16-undo-share-files.md.
          key={loadCount}
          value={text}
          onChange={diagramActions.setText}
          onMount={onMount}
          language="yaml"
          height="100%"
          readOnly={lensLocked}
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
