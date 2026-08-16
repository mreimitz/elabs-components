import { describe, expect, it } from "vitest";

import { normalizeQuoteText, normalizeQuoteTextWithOffsets } from "./document-address";

/** Map a normalized range back and read the slice it names in the original. */
function sliceVia(original: string, from: number, to: number): string {
  const { offsets } = normalizeQuoteTextWithOffsets(original);
  return original.slice(offsets[from], offsets[to]);
}

describe("normalizeQuoteText", () => {
  it("collapses every whitespace run to one space, and trims", () => {
    expect(normalizeQuoteText("  the\n\n  quick\tbrown \r\n fox  ")).toBe("the quick brown fox");
  });

  it("straightens the quotes and dashes an extractor disagrees about", () => {
    // The same sentence out of a PDF and out of a model. Neither side should
    // have to know which glyph the other used.
    expect(normalizeQuoteText("“Don’t”—she said")).toBe(normalizeQuoteText('"Don\'t"-she said'));
  });

  it("folds case, so a citation matches without a caller-set flag", () => {
    expect(normalizeQuoteText("Total Revenue")).toBe(normalizeQuoteText("total revenue"));
  });

  it("drops the invisibles a line break leaves behind", () => {
    // A soft hyphen at a PDF's line wrap, and a zero-width space.
    expect(normalizeQuoteText("re­venue​")).toBe("revenue");
  });

  it("leaves a ligature alone — folding it would be a 1:many expansion", () => {
    // The offset map is only trustworthy while every rule is a collapse, a drop
    // or a 1:1 swap. A fuzzier match is not worth losing that.
    expect(normalizeQuoteText("ﬁnal")).toBe("ﬁnal");
  });
});

describe("normalizeQuoteTextWithOffsets", () => {
  it("ends one past the last SURVIVING character, not at the input's length", () => {
    // Ending at the input's length would drag the trailing space into every
    // range that runs to the end of the document.
    const input = "  hello   world ";
    const { text, offsets } = normalizeQuoteTextWithOffsets(input);
    expect(text).toBe("hello world");
    expect(offsets).toHaveLength(text.length + 1);
    expect(offsets[offsets.length - 1]).toBe(input.lastIndexOf("d") + 1);
  });

  it("maps a normalized range back onto the ORIGINAL characters", () => {
    // "world" in the normalized string is at [6, 11); in the original it sits
    // past a three-space run and a leading pair, at completely different indices.
    const original = "  Hello   World ";
    expect(sliceVia(original, 6, 11)).toBe("World");
  });

  it("points a collapsed space at where its run began", () => {
    // Selecting across the gap must include the whole run, not just its last
    // character — otherwise a highlight starts mid-whitespace.
    const original = "a \n\t b";
    expect(sliceVia(original, 0, 3)).toBe("a \n\t b");
  });

  it("keeps the map monotone across folds, drops and case changes", () => {
    const { offsets } = normalizeQuoteTextWithOffsets(" “Süß”­ — DONE ");
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1] as number);
    }
  });

  it("survives a string that is nothing but whitespace", () => {
    const { text, offsets } = normalizeQuoteTextWithOffsets("   \n  ");
    expect(text).toBe("");
    expect(offsets).toEqual([0]);
  });
});
