import { describe, expect, it } from "vitest";

import { createTextIndexBuilder, spanAt, spansForRange } from "./text-index";

/** Three blocks, the shape every text-bearing adapter builds. */
function blocks() {
  const builder = createTextIndexBuilder<number>();
  builder.push("first block", 0);
  builder.push("second", 1);
  builder.push("third one", 2);
  return builder.build();
}

describe("createTextIndexBuilder", () => {
  it("produces the projection AND its map from the same pass", () => {
    // The point of the builder: the text an adapter reports and the offsets it
    // maps back cannot disagree, because one is built out of the other.
    const index = blocks();
    expect(index.text).toBe("first block\nsecond\nthird one");
    for (const span of index.spans) {
      expect(index.text.slice(span.start, span.end)).not.toBe("");
    }
    expect(index.text.slice(11, 12)).toBe("\n");
  });

  it("gives the separator to nobody, so no highlight spans a joint", () => {
    const index = blocks();
    // The gap between block 0's end and block 1's start is the separator.
    expect(index.spans[0]?.end).toBe(11);
    expect(index.spans[1]?.start).toBe(12);
    expect(spanAt(index, 11)).toBeUndefined();
  });

  it("skips an empty chunk rather than emitting a span that matches nothing", () => {
    const builder = createTextIndexBuilder<string>();
    builder.push("a", "kept");
    builder.push("", "dropped");
    builder.push("b", "kept-too");
    const index = builder.build();
    expect(index.text).toBe("a\nb");
    expect(index.spans.map((span) => span.ref)).toEqual(["kept", "kept-too"]);
  });

  it("honours a custom separator", () => {
    const builder = createTextIndexBuilder<number>({ separator: "\n\n" });
    builder.push("a", 0);
    builder.push("b", 1);
    expect(builder.build().text).toBe("a\n\nb");
  });

  it("builds an empty index from no chunks at all", () => {
    expect(createTextIndexBuilder<number>().build()).toEqual({ text: "", spans: [] });
  });
});

describe("spansForRange", () => {
  it("clips the overlap to each chunk's OWN offsets", () => {
    // What a renderer needs: not "812–847 of the document" but "characters 6–11
    // of block 0", which is the only thing it can pass to its own markup.
    const index = blocks();
    expect(spansForRange(index, [6, 11])).toEqual([{ span: index.spans[0], start: 6, end: 11 }]);
  });

  it("splits a range that crosses a block boundary", () => {
    const index = blocks();
    const overlaps = spansForRange(index, [6, 15]);
    expect(overlaps.map((overlap) => overlap.span.ref)).toEqual([0, 1]);
    expect(overlaps[0]).toMatchObject({ start: 6, end: 11 });
    // Block 1 starts at 12; the range reaches 15, so three of its characters.
    expect(overlaps[1]).toMatchObject({ start: 0, end: 3 });
  });

  it("returns nothing for an empty or inverted range", () => {
    const index = blocks();
    expect(spansForRange(index, [5, 5])).toEqual([]);
    expect(spansForRange(index, [9, 4])).toEqual([]);
  });

  it("returns nothing for a range past the end", () => {
    expect(spansForRange(blocks(), [500, 600])).toEqual([]);
  });
});

describe("spanAt", () => {
  it("finds the chunk an offset lands in", () => {
    const index = blocks();
    expect(spanAt(index, 0)?.ref).toBe(0);
    expect(spanAt(index, 12)?.ref).toBe(1);
    expect(spanAt(index, 27)?.ref).toBe(2);
  });

  it("is undefined past the last chunk", () => {
    expect(spanAt(blocks(), 999)).toBeUndefined();
  });
});
