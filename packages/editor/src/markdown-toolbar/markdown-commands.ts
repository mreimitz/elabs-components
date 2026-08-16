/**
 * Markdown editing commands that operate on a Monaco editor instance (the source
 * pane). Pure functions over the editor — the toolbar UI wires buttons to these.
 */
import * as monaco from "monaco-editor";

import type { MonacoCodeEditor } from "../code-editor";

/** Wrap the current selection (or insert a placeholder) with `before`/`after`. */
export function wrapSelection(
  editor: MonacoCodeEditor,
  before: string,
  after: string = before,
  placeholder = "text",
): void {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;

  const selected = model.getValueInRange(selection) || placeholder;
  editor.executeEdits("markdown-toolbar", [
    { range: selection, text: `${before}${selected}${after}`, forceMoveMarkers: true },
  ]);
  // Re-select the inner text so the user can keep typing over the placeholder.
  const startCol = selection.startColumn + before.length;
  editor.setSelection(
    new monaco.Selection(
      selection.startLineNumber,
      startCol,
      selection.startLineNumber,
      startCol + selected.length,
    ),
  );
  editor.focus();
}

/** Toggle a line prefix (`# `, `> `, `- `, `1. `) on every selected line. */
export function toggleLinePrefix(editor: MonacoCodeEditor, prefix: string): void {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;

  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
  const allPrefixed = (() => {
    for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
      if (!model.getLineContent(line).startsWith(prefix)) return false;
    }
    return true;
  })();

  for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
    const content = model.getLineContent(line);
    if (allPrefixed) {
      edits.push({
        range: new monaco.Range(line, 1, line, prefix.length + 1),
        text: "",
      });
    } else if (!content.startsWith(prefix)) {
      edits.push({ range: new monaco.Range(line, 1, line, 1), text: prefix });
    }
  }
  editor.executeEdits("markdown-toolbar", edits);
  editor.focus();
}

/** Insert `[selection](url)` (or a placeholder link). */
export function insertLink(editor: MonacoCodeEditor): void {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;
  const label = model.getValueInRange(selection) || "label";
  editor.executeEdits("markdown-toolbar", [
    { range: selection, text: `[${label}](https://)`, forceMoveMarkers: true },
  ]);
  editor.focus();
}

/** Insert a horizontal rule on its own line below the cursor. */
export function insertHorizontalRule(editor: MonacoCodeEditor): void {
  const selection = editor.getSelection();
  if (!selection) return;
  const line = selection.endLineNumber;
  const col = editor.getModel()?.getLineMaxColumn(line) ?? 1;
  editor.executeEdits("markdown-toolbar", [
    { range: new monaco.Range(line, col, line, col), text: `\n\n---\n`, forceMoveMarkers: true },
  ]);
  editor.focus();
}

/** Insert a brand directive block at the cursor (e.g. card/callout/metric/timeline). */
export function insertDirective(editor: MonacoCodeEditor, snippet: string): void {
  const selection = editor.getSelection();
  if (!selection) return;
  const line = selection.endLineNumber;
  const col = editor.getModel()?.getLineMaxColumn(line) ?? 1;
  editor.executeEdits("markdown-toolbar", [
    {
      range: new monaco.Range(line, col, line, col),
      text: `\n\n${snippet}\n`,
      forceMoveMarkers: true,
    },
  ]);
  editor.focus();
}
