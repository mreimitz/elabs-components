import { describe, expect, it } from "vitest";

import { mergeNormalizedEdit } from "./merge";

// Simulated serializer drift: the editor rewrites `*` bullets as `-` but
// keeps headings, blank lines, and prose byte-exact (markdown's blank lines
// are the anchors that make block-granularity merging work).
const O = "# Title\n\n* alpha\n* beta\n\npara one\n\nthe end";
const B = "# Title\n\n- alpha\n- beta\n\npara one\n\nthe end";

describe("mergeNormalizedEdit (WI-1 — lossless WYSIWYG edits)", () => {
  it("returns the original byte-exact when the user changed nothing", () => {
    expect(mergeNormalizedEdit(O, B, B)).toBe(O);
  });

  it("returns the edit untouched when there is no normalization drift", () => {
    const n = O.replace("para one", "para one EDITED");
    expect(mergeNormalizedEdit(O, O, n)).toBe(n);
  });

  it("a one-line edit changes exactly that line — normalized bullets stay original", () => {
    const n = B.replace("para one", "para one EDITED");
    expect(mergeNormalizedEdit(O, B, n)).toBe(O.replace("para one", "para one EDITED"));
  });

  it("an appended paragraph lands at the end, the rest stays original", () => {
    const n = `${B}\n\nbrand new para`;
    expect(mergeNormalizedEdit(O, B, n)).toBe(`${O}\n\nbrand new para`);
  });

  it("deleting a line inside a normalized block keeps the rest of the doc original", () => {
    const n = B.replace("- beta\n", "");
    const merged = mergeNormalizedEdit(O, B, n);
    // The edited block is locally normalized (documented trade-off)…
    expect(merged).toContain("- alpha");
    expect(merged).not.toContain("beta");
    // …but everything outside it keeps original bytes.
    expect(merged).toContain("# Title");
    expect(merged).toContain("para one");
    expect(merged).toContain("the end");
  });

  it("an edit inside a normalized block normalizes only that block", () => {
    const n = B.replace("- beta", "- beeee");
    const merged = mergeNormalizedEdit(O, B, n);
    expect(merged).toContain("- alpha");
    expect(merged).toContain("- beeee");
    expect(merged).toContain("para one\n\nthe end");
    expect(merged.startsWith("# Title")).toBe(true);
  });

  it("an insertion between untouched blocks preserves both neighbors byte-exact", () => {
    const n = B.replace("\npara one", "\ninserted line\n\npara one");
    const merged = mergeNormalizedEdit(O, B, n);
    expect(merged).toContain("* alpha\n* beta");
    expect(merged).toContain("inserted line");
    expect(merged).toContain("para one\n\nthe end");
  });

  it("falls back to the edited text for oversized inputs", () => {
    const big = Array.from({ length: 6000 }, (_, i) => `line ${i}`).join("\n");
    expect(mergeNormalizedEdit(big, "b", "n")).toBe("n");
  });
});
