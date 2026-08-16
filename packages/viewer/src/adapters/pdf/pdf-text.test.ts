import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import { toMarkRanges } from "../../core/highlight-marks";
import { createTextIndexBuilder } from "../../core/text-index";
import {
  PDF_PAGE_SEPARATOR,
  pageOfHighlight,
  pageTextChunk,
  rangeBoxes,
  rectBoxes,
  type PdfTextSpan,
} from "./pdf-text";

const ITEMS = [{ str: "Alpha" }, { str: "" }, { str: "Beta" }];

/** The geometry the renderer derives from those items, at scale 1. */
const SPANS: PdfTextSpan[] = [
  { text: "Alpha", left: 72, top: 80, width: 40, fontSize: 12, item: 0 },
  { text: "Beta", left: 72, top: 100, width: 32, fontSize: 12, item: 2 },
];

function resolved(over: Partial<ResolvedHighlight> = {}): ResolvedHighlight {
  return {
    id: "c1",
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: 0, end: 5 },
    active: false,
    ...over,
  };
}

describe("pageTextChunk", () => {
  it("joins items the way the projection does and records where each one landed", () => {
    const chunk = pageTextChunk(ITEMS);
    expect(chunk.text).toBe("Alpha  Beta");
    expect(chunk.spans).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 6 },
      { start: 7, end: 11 },
    ]);
  });

  it("keeps empty items in place, so no following offset shifts", () => {
    // The empty item still consumes its separator. Dropping it would pull "Beta"
    // back by one character and put every mark on this page one glyph off.
    const chunk = pageTextChunk(ITEMS);
    expect(chunk.text.slice(7, 11)).toBe("Beta");
    expect(chunk.spans).toHaveLength(ITEMS.length);
  });

  it("agrees with the projection the loader builds from the same call", () => {
    const builder = createTextIndexBuilder<number>({ separator: PDF_PAGE_SEPARATOR });
    builder.push(pageTextChunk(ITEMS).text, 1);
    builder.push(pageTextChunk([{ str: "Gamma" }]).text, 2);
    const index = builder.build();

    expect(index.text).toBe("Alpha  Beta\n\nGamma");
    // Page 2 begins after the page separator — the offset a citation on that
    // page is expressed against.
    expect(index.spans[1]).toEqual({ start: 13, end: 18, ref: 2 });
  });
});

describe("rangeBoxes", () => {
  const chunk = pageTextChunk(ITEMS);

  it("puts a box over the item the range lands in", () => {
    const marks = toMarkRanges([resolved({ range: [7, 11] })], 11);
    expect(rangeBoxes(SPANS, chunk, 0, marks)).toEqual([
      { left: 72, top: 100, width: 32, height: 12, active: false },
    ]);
  });

  it("cuts a partial match proportionally rather than lighting the whole run", () => {
    // "Al" of "Alpha": two of five characters of a 40-wide item.
    const marks = toMarkRanges([resolved({ range: [0, 2] })], 11);
    const [box] = rangeBoxes(SPANS, chunk, 0, marks);
    expect(box?.left).toBe(72);
    expect(box?.width).toBe(16);
  });

  it("offsets by where the page starts in the projection", () => {
    // Same page, but it is the second one: its chunk begins at 13.
    const marks = toMarkRanges([resolved({ range: [20, 24] })], 24);
    const [box] = rangeBoxes(SPANS, chunk, 13, marks);
    expect(box?.top).toBe(100);
  });

  it("marks the box the viewer is pointed at, and only that one", () => {
    const marks = toMarkRanges(
      [resolved({ id: "a", range: [0, 5] }), resolved({ id: "b", range: [7, 11], active: true })],
      11,
    );
    expect(rangeBoxes(SPANS, chunk, 0, marks).map((box) => box.active)).toEqual([false, true]);
  });

  it("falls back to an em estimate when pdf.js reported no width", () => {
    const spans: PdfTextSpan[] = [{ ...(SPANS[0] as PdfTextSpan), width: 0 }];
    const marks = toMarkRanges([resolved({ range: [0, 5] })], 11);
    // 5 characters × half of a 12pt em.
    expect(rangeBoxes(spans, chunk, 0, marks)[0]?.width).toBe(30);
  });

  it("paints nothing when the marks are on another page", () => {
    const marks = toMarkRanges([resolved({ range: [40, 44] })], 60);
    expect(rangeBoxes(SPANS, chunk, 0, marks)).toEqual([]);
  });
});

describe("rectBoxes", () => {
  const size = { width: 600, height: 800 };

  it("scales fractions to the page's CURRENT rendered size", () => {
    const highlight = resolved({
      address: { kind: "rect", page: 1, rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.05 }] },
      rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.05 }],
    });
    expect(rectBoxes([highlight], size)).toEqual([
      { left: 60, top: 160, width: 300, height: 40, active: false },
    ]);
  });

  it("clamps a foreign document's geometry to the page", () => {
    const rects = [{ x: -1, y: 2, width: 5, height: Number.NaN }];
    const highlight = resolved({ address: { kind: "rect", page: 1, rects }, rects });
    expect(rectBoxes([highlight], size)).toEqual([
      { left: 0, top: 800, width: 600, height: 0, active: false },
    ]);
  });

  it("draws one box per rect, because a chunk can wrap a column break", () => {
    const rects = [
      { x: 0, y: 0, width: 0.5, height: 0.1 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.1 },
    ];
    const highlight = resolved({
      address: { kind: "rect", page: 1, rects },
      rects,
      active: true,
    });
    const boxes = rectBoxes([highlight], size);
    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => box.active)).toBe(true);
  });
});

describe("pageOfHighlight", () => {
  const index = createTextIndexBuilder<number>({ separator: PDF_PAGE_SEPARATOR });
  index.push("Alpha", 1);
  index.push("Gamma", 2);
  const built = index.build();

  it("prefers what the caller said", () => {
    expect(pageOfHighlight(resolved({ page: 4, range: [0, 5] }), built)).toBe(4);
  });

  it("looks a located range up through the document's own index", () => {
    expect(pageOfHighlight(resolved({ range: [7, 12] }), built)).toBe(2);
  });

  it("has no answer for a range on a separator, so the pager stays put", () => {
    expect(pageOfHighlight(resolved({ range: [5, 6] }), built)).toBeUndefined();
  });

  it("has no answer for a highlight that never resolved", () => {
    expect(pageOfHighlight(resolved({ status: "not-found" }), built)).toBeUndefined();
    expect(pageOfHighlight(undefined, built)).toBeUndefined();
  });
});
