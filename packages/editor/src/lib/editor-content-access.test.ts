/**
 * Unit tests for monacoContentAccess — the Monaco adapter for EditorContentAccess.
 *
 * Monaco can't render in jsdom, so we mock the editor instance and assert the
 * adapter's pure-logic contract (the markdown-commands.test.ts precedent).
 * Live Monaco behavior (real selection round-trips) is verified in Storybook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock monaco-editor (pure value types only; no rendering engine needed).
vi.mock("monaco-editor", () => ({
  editor: {},
}));

import { monacoContentAccess } from "./editor-content-access";

// ---------------------------------------------------------------------------
// Minimal Monaco editor mock — mirrors the shape used by markdown-commands.test.ts
// ---------------------------------------------------------------------------

function makeMockEditor(selectedText = "", isEmpty = false) {
  const selectionChangeHandlers: Array<() => void> = [];
  const disposable = { dispose: vi.fn() };

  const selection = {
    isEmpty: vi.fn(() => isEmpty),
  };
  const model = {
    getValueInRange: vi.fn(() => selectedText),
  };
  const editor = {
    getModel: vi.fn(() => model),
    getSelection: vi.fn(() => selection),
    getValue: vi.fn(() => "full document text"),
    executeEdits: vi.fn(),
    pushUndoStop: vi.fn(),
    focus: vi.fn(),
    onDidChangeCursorSelection: vi.fn((cb: () => void) => {
      selectionChangeHandlers.push(cb);
      return disposable;
    }),
  };
  return { editor, model, selection, disposable, selectionChangeHandlers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks());

describe("monacoContentAccess — getText", () => {
  it("returns editor.getValue()", () => {
    const { editor } = makeMockEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    expect(access.getText()).toBe("full document text");
    expect(editor.getValue).toHaveBeenCalledTimes(1);
  });
});

describe("monacoContentAccess — getSelection", () => {
  it("maps getValueInRange to text, isEmpty() to empty:false when selected", () => {
    const { editor } = makeMockEditor("bold text", false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    const sel = access.getSelection();
    expect(sel.text).toBe("bold text");
    expect(sel.empty).toBe(false);
  });

  it("returns empty:true and text:'' for a collapsed caret", () => {
    const { editor } = makeMockEditor("", true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    const sel = access.getSelection();
    expect(sel.text).toBe("");
    expect(sel.empty).toBe(true);
  });

  it("returns empty:true when getSelection() returns null", () => {
    const { editor } = makeMockEditor("", false);
    editor.getSelection.mockReturnValue(null as unknown as ReturnType<typeof editor.getSelection>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    expect(access.getSelection()).toEqual({ text: "", empty: true });
  });

  it("returns empty:true when getModel() returns null", () => {
    const { editor } = makeMockEditor("text", false);
    editor.getModel.mockReturnValue(null as unknown as ReturnType<typeof editor.getModel>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    expect(access.getSelection()).toEqual({ text: "", empty: true });
  });
});

describe("monacoContentAccess — replaceSelection / insertAtCursor", () => {
  it("replaceSelection calls executeEdits with the selection range + text", () => {
    const { editor, selection } = makeMockEditor("old", false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    access.replaceSelection("new text");
    expect(editor.executeEdits).toHaveBeenCalledWith("editor-content-access", [
      { range: selection, text: "new text", forceMoveMarkers: true },
    ]);
    expect(editor.pushUndoStop).toHaveBeenCalledTimes(1);
  });

  it("insertAtCursor calls executeEdits identically (same primitive)", () => {
    const { editor, selection } = makeMockEditor("", true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    access.insertAtCursor("inserted");
    expect(editor.executeEdits).toHaveBeenCalledWith("editor-content-access", [
      { range: selection, text: "inserted", forceMoveMarkers: true },
    ]);
    expect(editor.pushUndoStop).toHaveBeenCalledTimes(1);
  });

  it("no-ops when getSelection() returns null", () => {
    const { editor } = makeMockEditor();
    editor.getSelection.mockReturnValue(null as unknown as ReturnType<typeof editor.getSelection>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    access.replaceSelection("x");
    expect(editor.executeEdits).not.toHaveBeenCalled();
  });
});

describe("monacoContentAccess — focus", () => {
  it("calls editor.focus()", () => {
    const { editor } = makeMockEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    access.focus();
    expect(editor.focus).toHaveBeenCalledTimes(1);
  });
});

describe("monacoContentAccess — onSelectionChange", () => {
  it("registers onDidChangeCursorSelection and fires the listener with a fresh snapshot", () => {
    const { editor, selectionChangeHandlers, model, selection } = makeMockEditor("abc", false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    const listener = vi.fn();
    access.onSelectionChange(listener);

    expect(editor.onDidChangeCursorSelection).toHaveBeenCalledTimes(1);

    // Simulate Monaco firing the selection-change event.
    model.getValueInRange.mockReturnValue("xyz");
    selectionChangeHandlers[0]?.();

    expect(listener).toHaveBeenCalledWith({ text: "xyz", empty: false });
    expect(selection.isEmpty).toHaveBeenCalled();
  });

  it("returns an unsubscribe fn that calls disposable.dispose()", () => {
    const { editor, disposable } = makeMockEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    const unsub = access.onSelectionChange(vi.fn());
    expect(disposable.dispose).not.toHaveBeenCalled();
    unsub();
    expect(disposable.dispose).toHaveBeenCalledTimes(1);
  });

  it("calling the unsubscribe calls dispose() on the Monaco IDisposable", () => {
    // Contract: the adapter calls sub.dispose() when the caller unsubscribes.
    // In production Monaco stops firing the handler after dispose(); in jsdom
    // the mock doesn't truly gate on dispose, so we assert the dispose call
    // rather than trying to gate the mock handler.
    const { editor, disposable } = makeMockEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = monacoContentAccess(editor as any);
    const unsub = access.onSelectionChange(vi.fn());
    expect(disposable.dispose).not.toHaveBeenCalled();
    unsub();
    expect(disposable.dispose).toHaveBeenCalledTimes(1);
  });
});
