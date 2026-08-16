/**
 * Unit tests for `MonacoSlashMenu`'s run-only command selection (#299) —
 * `runInSource` appears alongside `snippet` in the source-pane menu, wins over
 * `snippet` when both select paths fire (Enter/Tab AND click), strips the
 * typed `/query` trigger first, and a snippet-only command is unaffected.
 *
 * Monaco can't render in jsdom, so `monaco-editor` is mocked (the
 * `markdown-workspace.test.tsx` precedent) and a hand-built editor object
 * stands in for `MonacoCodeEditor` (the `editor-content-access.test.ts`
 * precedent) — `MonacoSlashMenu` only calls a handful of methods on it.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { IRange } from "monaco-editor";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("monaco-editor", () => ({
  Selection: class {},
  Range: class {},
}));

import { MonacoSlashMenu } from "./monaco-slash-menu";
import type { SlashCommand } from "./brand-slash-commands";

function makeEditor() {
  const domNode = document.createElement("div");
  return {
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 5 })),
    getScrolledVisiblePosition: vi.fn(() => ({ top: 20, left: 10, height: 20 })),
    getDomNode: vi.fn(() => domNode),
    onDidScrollChange: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidBlurEditorText: vi.fn(() => ({ dispose: vi.fn() })),
    executeEdits: vi.fn(),
    getModel: vi.fn(() => ({ getValue: vi.fn(() => ""), getValueInRange: vi.fn(() => "") })),
    getSelection: vi.fn(() => null),
    focus: vi.fn(),
    domNode,
  };
}

const triggerRange: IRange = {
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 1,
  endColumn: 2,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("MonacoSlashMenu — run-only commands (#299)", () => {
  it("renders a run-only command (no snippet) alongside snippet commands", () => {
    const editor = makeEditor();
    const runOnly: SlashCommand = {
      id: "ask-ai",
      label: "Ask AI",
      run: () => {},
      runInSource: vi.fn(),
    };
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[runOnly]}
        open
        onOpenChange={vi.fn()}
        triggerRange={triggerRange}
      />,
    );
    expect(screen.getByText("Ask AI")).toBeInTheDocument();
  });

  it("Enter strips the typed trigger, calls runInSource with editor+range+content, closes, and refocuses", () => {
    const editor = makeEditor();
    const runInSource = vi.fn();
    const runOnly: SlashCommand = { id: "ask-ai", label: "Ask AI", run: () => {}, runInSource };
    const onOpenChange = vi.fn();
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[runOnly]}
        open
        onOpenChange={onOpenChange}
        triggerRange={triggerRange}
      />,
    );

    fireEvent.keyDown(editor.domNode, { key: "Enter" });

    // The `/query` trigger is stripped BEFORE runInSource fires.
    expect(editor.executeEdits).toHaveBeenCalledWith("brand-slash-typed", [
      { range: triggerRange, text: "" },
    ]);
    expect(runInSource).toHaveBeenCalledTimes(1);
    const ctx = runInSource.mock.calls[0]?.[0];
    expect(ctx?.editor).toBe(editor);
    expect(ctx?.range).toBe(triggerRange);
    expect(typeof ctx?.content.getText).toBe("function");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(editor.focus).toHaveBeenCalledTimes(1);
  });

  it("clicking the option (the mouse path) calls runInSource identically to Enter", () => {
    const editor = makeEditor();
    const runInSource = vi.fn();
    const runOnly: SlashCommand = { id: "ask-ai", label: "Ask AI", run: () => {}, runInSource };
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[runOnly]}
        open
        onOpenChange={vi.fn()}
        triggerRange={triggerRange}
      />,
    );

    fireEvent.mouseDown(screen.getByText("Ask AI"));

    expect(editor.executeEdits).toHaveBeenCalledWith("brand-slash-typed", [
      { range: triggerRange, text: "" },
    ]);
    expect(runInSource).toHaveBeenCalledTimes(1);
  });

  it("on the hotkey path (no triggerRange), runInSource still fires with range: null and nothing is stripped", () => {
    const editor = makeEditor();
    const runInSource = vi.fn();
    const runOnly: SlashCommand = { id: "ask-ai", label: "Ask AI", run: () => {}, runInSource };
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[runOnly]}
        open
        onOpenChange={vi.fn()}
        triggerRange={null}
      />,
    );

    fireEvent.keyDown(editor.domNode, { key: "Enter" });

    expect(editor.executeEdits).not.toHaveBeenCalled();
    expect(runInSource).toHaveBeenCalledTimes(1);
    expect(runInSource.mock.calls[0]?.[0]?.range).toBeNull();
  });

  it("a snippet-only command is unaffected — Enter still inserts the snippet via executeEdits", () => {
    const editor = makeEditor();
    const snippetOnly: SlashCommand = {
      id: "brand-card",
      label: "Card",
      snippet: ":::card\ntext\n:::",
      run: () => {},
    };
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[snippetOnly]}
        open
        onOpenChange={vi.fn()}
        triggerRange={triggerRange}
      />,
    );

    fireEvent.keyDown(editor.domNode, { key: "Enter" });

    expect(editor.executeEdits).toHaveBeenCalledWith("brand-slash-typed", [
      { range: triggerRange, text: ":::card\ntext\n:::", forceMoveMarkers: true },
    ]);
  });

  it("runInSource wins over snippet when a command carries both", () => {
    const editor = makeEditor();
    const runInSource = vi.fn();
    const both: SlashCommand = {
      id: "both",
      label: "Both",
      snippet: "should not be inserted",
      run: () => {},
      runInSource,
    };
    render(
      <MonacoSlashMenu
        editor={editor as never}
        commands={[both]}
        open
        onOpenChange={vi.fn()}
        triggerRange={triggerRange}
      />,
    );

    fireEvent.keyDown(editor.domNode, { key: "Enter" });

    expect(runInSource).toHaveBeenCalledTimes(1);
    expect(editor.executeEdits).toHaveBeenCalledWith("brand-slash-typed", [
      { range: triggerRange, text: "" },
    ]);
  });
});
