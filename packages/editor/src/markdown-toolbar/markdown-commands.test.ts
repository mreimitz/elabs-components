import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock monaco's Range/Selection value classes (pure data — no real editor engine).
vi.mock("monaco-editor", () => ({
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
  Selection: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
}));

import { insertHorizontalRule, toggleLinePrefix, wrapSelection } from "./markdown-commands";

type Edit = { text: string; range: { startColumn: number } };

function fakeEditor(lines: string[], selected: string) {
  const edits: Edit[] = [];
  const selection = {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: lines.length,
    endColumn: (lines.at(-1)?.length ?? 0) + 1,
  };
  const model = {
    getValueInRange: () => selected,
    getLineContent: (n: number) => lines[n - 1] ?? "",
    getLineMaxColumn: (n: number) => (lines[n - 1]?.length ?? 0) + 1,
  };
  const editor = {
    getModel: () => model,
    getSelection: () => selection,
    executeEdits: (_src: string, e: Edit[]) => edits.push(...e),
    setSelection: vi.fn(),
    focus: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { editor: editor as any, edits };
}

describe("markdown commands", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("wraps the selection with markers", () => {
    const { editor, edits } = fakeEditor(["Bold me"], "Bold me");
    wrapSelection(editor, "**");
    expect(edits[0]?.text).toBe("**Bold me**");
    warn.mockRestore();
  });

  it("adds a line prefix when absent", () => {
    const { editor, edits } = fakeEditor(["hello"], "hello");
    toggleLinePrefix(editor, "# ");
    expect(edits[0]?.text).toBe("# ");
    warn.mockRestore();
  });

  it("removes the line prefix when already present (toggle)", () => {
    const { editor, edits } = fakeEditor(["# hello"], "# hello");
    toggleLinePrefix(editor, "# ");
    expect(edits[0]?.text).toBe("");
    warn.mockRestore();
  });

  it("inserts a horizontal rule", () => {
    const { editor, edits } = fakeEditor(["para"], "");
    insertHorizontalRule(editor);
    expect(edits[0]?.text).toContain("---");
    warn.mockRestore();
  });
});
