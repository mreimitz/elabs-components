import { describe, expect, it } from "vitest";
import { diffLineAccessibleLabel, diffLineMarker, type DiffLineType } from "./diff-line";

describe("diffLineMarker", () => {
  it.each([
    ["add", "+"],
    ["del", "−"],
    ["context", " "],
    ["hunk", ""],
    ["meta", ""],
  ] as const)("returns %s's marker as %s", (type, expected) => {
    expect(diffLineMarker(type)).toBe(expected);
  });

  it("uses a NO-BREAK SPACE (U+00A0) for context, not a plain space — must survive JSX/HTML whitespace collapsing", () => {
    expect(diffLineMarker("context")).toBe(" ");
    expect(diffLineMarker("context").charCodeAt(0)).toBe(0xa0);
  });
});

describe("diffLineAccessibleLabel", () => {
  it("returns the added-line key for an add row", () => {
    expect(diffLineAccessibleLabel("add")).toBe("ai.diffView.addedLine");
  });

  it("returns the removed-line key for a del row", () => {
    expect(diffLineAccessibleLabel("del")).toBe("ai.diffView.removedLine");
  });

  it.each(["context", "hunk", "meta"] as DiffLineType[])(
    "returns undefined for %s (no polarity)",
    (type) => {
      expect(diffLineAccessibleLabel(type)).toBeUndefined();
    },
  );
});
