import { describe, expect, it } from "vitest";

import {
  annotationForRange,
  computeMarkdownAnnotations,
  removedMarkerAt,
  shiftAnnotations,
} from "./diff";

describe("computeMarkdownAnnotations", () => {
  it("returns [] for identical inputs", () => {
    expect(computeMarkdownAnnotations("a\nb", "a\nb")).toEqual([]);
  });

  it("flags pure additions with after-relative 1-based lines", () => {
    const before = "one\ntwo";
    const after = "one\nnew line\ntwo";
    expect(computeMarkdownAnnotations(before, after)).toEqual([
      { kind: "added", startLine: 2, endLine: 2 },
    ]);
  });

  it("flags replaced runs as modified", () => {
    const before = "# Title\n\nold paragraph\n";
    const after = "# Title\n\nnew paragraph\n";
    expect(computeMarkdownAnnotations(before, after)).toEqual([
      { kind: "modified", startLine: 3, endLine: 3 },
    ]);
  });

  it("anchors pure deletions on the next surviving line", () => {
    const before = "one\ngone\ngone too\ntwo";
    const after = "one\ntwo";
    expect(computeMarkdownAnnotations(before, after)).toEqual([
      { kind: "removed-before", startLine: 2, endLine: 2, removedCount: 2 },
    ]);
  });

  it("clamps a trailing deletion to the last line", () => {
    const before = "one\ntwo\nthree";
    const after = "one";
    const [ann] = computeMarkdownAnnotations(before, after);
    expect(ann).toEqual({ kind: "removed-before", startLine: 1, endLine: 1, removedCount: 2 });
  });

  it("merges adjacent hunks of the same kind", () => {
    const before = "a\nb\nc";
    const after = "a\nx\ny\nb\nz\nc";
    const anns = computeMarkdownAnnotations(before, after);
    expect(anns.every((x) => x.kind === "added")).toBe(true);
  });
});

describe("shiftAnnotations", () => {
  it("shifts by the frontmatter offset and drops swallowed hunks", () => {
    const anns = shiftAnnotations(
      [
        { kind: "added" as const, startLine: 2, endLine: 3 },
        { kind: "added" as const, startLine: 6, endLine: 7 },
      ],
      4,
    );
    expect(anns).toEqual([{ kind: "added", startLine: 2, endLine: 3 }]);
  });
});

describe("annotationForRange / removedMarkerAt", () => {
  const anns = [
    { kind: "added" as const, startLine: 3, endLine: 5 },
    { kind: "removed-before" as const, startLine: 8, endLine: 8, removedCount: 2 },
  ];
  it("finds overlapping wash", () => {
    expect(annotationForRange(anns, 5, 6)?.kind).toBe("added");
    expect(annotationForRange(anns, 6, 7)).toBeUndefined();
  });
  it("finds the removed marker only at its anchor line", () => {
    expect(removedMarkerAt(anns, 8)?.removedCount).toBe(2);
    expect(removedMarkerAt(anns, 9)).toBeUndefined();
  });
});
