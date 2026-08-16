/**
 * Engine-agnostic editor content-access interface + Monaco adapter.
 *
 * ISOLATION INVARIANT: this file imports ONLY `monaco-editor` and the
 * `MonacoCodeEditor` type from `../code-editor`. It MUST NOT import
 * `editor-content-access-prose.ts` or anything from `@milkdown`, or the
 * `@milkdown` graph leaks into the `.` barrel (#271-inverse).
 */
import type { MonacoCodeEditor } from "../code-editor";

/** A snapshot of the editor's current selection. Text, not engine positions —
 *  that is what an AI assistant needs and it keeps the interface engine-agnostic. */
export interface EditorSelection {
  /**
   * The selected text. Plain text for Monaco. For the Milkdown WYSIWYG it is the
   * selection SERIALIZED TO MARKDOWN by default (so `**bold**`, links, lists round-trip);
   * pass `{ fidelity: "plainText" }` to the adapter to get `doc.textBetween` instead.
   */
  text: string;
  /** `true` when the selection is collapsed (a bare caret, nothing highlighted). */
  empty: boolean;
}

/**
 * Engine-agnostic, text-oriented access to an editor's content + selection — the
 * uniform surface an external AI assistant drives across the Monaco code editors
 * AND the Milkdown WYSIWYG markdown editor.
 *
 * D5: this manipulates EDITOR CONTENT only. It performs no model calls, no transport,
 * no fetch. The app owns the AI call and APPLIES the result via these methods.
 *
 * `replaceSelection` and `insertAtCursor` are equivalent primitives (both replace the
 * active range; an empty range is the caret) — two names for two reader intents.
 */
export interface EditorContentAccess {
  /** The full document text (Monaco: source; Milkdown: serialized markdown). */
  getText(): string;
  /** A snapshot of the current selection (selected text + whether collapsed). */
  getSelection(): EditorSelection;
  /** Replace the current selection; a collapsed selection inserts at the caret. */
  replaceSelection(text: string): void;
  /**
   * Insert at the caret; a non-empty selection is replaced (platform "typing" semantics).
   * Equivalent to `replaceSelection` — two names for two reader intents (agent-legibility).
   */
  insertAtCursor(text: string): void;
  /** Move focus to the editing surface (so the user can keep typing after an apply). */
  focus(): void;
  /**
   * Subscribe to selection changes. Fires with a fresh `EditorSelection` whenever the
   * selection or caret moves. Returns an unsubscribe function — the caller MUST call it
   * (e.g. in a React effect cleanup) to dispose the underlying engine listener.
   */
  onSelectionChange(listener: (selection: EditorSelection) => void): () => void;
}

/**
 * Wrap a live Monaco `IStandaloneCodeEditor` as the engine-agnostic
 * {@link EditorContentAccess}. The `CodeEditor` / `DiffEditor` / `CodeWorkspace`
 * `ref` already exposes the raw Monaco instance — pass it here to get the
 * uniform shape used by the markdown surfaces.
 *
 * For a `DiffEditor`, pass the modified (editable) side:
 * `monacoContentAccess(diffRef.current!.getModifiedEditor())`.
 *
 * @example
 *   const editorRef = useRef<MonacoCodeEditor>(null);
 *   // ...later
 *   const access = monacoContentAccess(editorRef.current!);
 *   access.insertAtCursor(aiText);
 */
export function monacoContentAccess(editor: MonacoCodeEditor): EditorContentAccess {
  const readSelection = (): EditorSelection => {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return { text: "", empty: true };
    const text = model.getValueInRange(selection);
    return { text, empty: selection.isEmpty() };
  };

  /**
   * Replace the active selection range. An empty selection (caret) inserts at
   * the caret — one path covers both insert & replace (executeEdits over an empty
   * range == insert at that position, exactly the markdown-commands.ts pattern).
   */
  const applyAtSelection = (text: string): void => {
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits("editor-content-access", [
      { range: selection, text, forceMoveMarkers: true },
    ]);
    // An explicit undo stop makes this AI apply independently undoable. The
    // toolbar helpers omit it because they immediately re-select (their own stop);
    // for the AI path an explicit stop is the right call.
    editor.pushUndoStop();
  };

  return {
    getText: () => editor.getValue(),
    getSelection: readSelection,
    replaceSelection: applyAtSelection,
    insertAtCursor: applyAtSelection,
    focus: () => editor.focus(),
    onSelectionChange: (listener) => {
      const sub = editor.onDidChangeCursorSelection(() => listener(readSelection()));
      return () => sub.dispose();
    },
  };
}
