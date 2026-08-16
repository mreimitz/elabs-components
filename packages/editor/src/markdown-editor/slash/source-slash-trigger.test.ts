import { describe, expect, it } from "vitest";

import { slashTriggerRange } from "./source-slash-trigger";

describe("slashTriggerRange", () => {
  it("triggers at the start of a line (column 1)", () => {
    expect(slashTriggerRange(3, "/", 1)).toEqual({
      startLineNumber: 3,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: 2,
    });
  });

  it("triggers right after whitespace", () => {
    // "hello /" → the "/" is at column 7, preceded by a space.
    expect(slashTriggerRange(1, "hello /", 7)).toEqual({
      startLineNumber: 1,
      startColumn: 7,
      endLineNumber: 1,
      endColumn: 8,
    });
  });

  it("does NOT trigger inside a word", () => {
    // "ab/" → the "/" is at column 3, preceded by "b".
    expect(slashTriggerRange(1, "ab/", 3)).toBeNull();
  });

  it("does NOT trigger inside a path / URL", () => {
    expect(slashTriggerRange(1, "http://", 6)).toBeNull(); // preceded by ":"
    expect(slashTriggerRange(1, "a/b/", 4)).toBeNull(); // preceded by "b"
  });

  it("returns null when the column does not actually hold a slash", () => {
    expect(slashTriggerRange(1, "hello", 3)).toBeNull();
  });

  it("treats a tab as whitespace", () => {
    expect(slashTriggerRange(1, "\t/", 2)).not.toBeNull();
  });
});
