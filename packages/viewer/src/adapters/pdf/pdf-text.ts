/**
 * PDF text ↔ page geometry — the MAP half of the highlight funnel for a raster.
 *
 * A PDF page is pixels. There is no DOM text to wrap in a `<mark>`, so the paint
 * step here is a layer of BOXES over the canvas, and this module is what turns
 * "characters 812–847 of the projection" into those boxes.
 *
 * ## Why the projection is rebuilt rather than remembered
 *
 * `AdapterDocument.text` is assembled at LOAD time, one page at a time; the
 * renderer re-fetches the current page's text content anyway (it needs the same
 * items to position the selectable text layer). So both sides call
 * {@link pageTextChunk}, and the projection and the geometry agree by
 * construction instead of by two hand-kept copies of the same join rule.
 *
 * ## Why the boxes are proportional, and what that costs
 *
 * pdf.js reports one box per text ITEM — a run of glyphs — and no per-character
 * geometry. When a range covers only part of an item, the box is cut
 * proportionally by character count. That is a linear approximation of a
 * proportional font, so it can be off by a glyph or two inside a long run; PDF
 * items are usually a word or a line fragment, where the error is invisible.
 *
 * The alternative — DOM ranges over the transparent text layer — would be WORSE
 * here, not better: that layer renders in a generic font at pdf.js's transform,
 * so its glyph advances do not match the raster underneath it at all. The item
 * box comes from the file itself and does.
 */

import type { DocumentRect } from "@qlik-coe-emea/qlabs-components-ui";

import type { ResolvedHighlight } from "../../core/highlight";
import { localizeRanges, type MarkRanges } from "../../core/highlight-marks";
import { spanAt, type TextIndex } from "../../core/text-index";

/** Written between two text items of the same page. */
export const PDF_ITEM_SEPARATOR = " ";

/** Written between two pages of the projection. */
export const PDF_PAGE_SEPARATOR = "\n\n";

/** The part of a pdf.js text item this module needs. */
export interface PdfTextItemLike {
  str: string;
}

/** Half-open `[start, end)` into the page's own chunk, one per item. */
export interface PdfItemSpan {
  start: number;
  end: number;
}

/** One page's contribution to the projection, plus where each item landed in it. */
export interface PdfPageChunk {
  text: string;
  /** Index-aligned with the items passed in — including the empty ones. */
  spans: readonly PdfItemSpan[];
}

/**
 * Join a page's text items the way the projection does, and record each item's
 * offsets.
 *
 * Empty items keep their place: they still consume a separator, so an item's
 * index into this array is the same index pdf.js handed back. Dropping them
 * would shift every following offset by one and put every mark a character off.
 */
export function pageTextChunk(items: readonly PdfTextItemLike[]): PdfPageChunk {
  const spans: PdfItemSpan[] = [];
  const parts: string[] = [];
  let cursor = 0;

  items.forEach((item, index) => {
    if (index > 0) cursor += PDF_ITEM_SEPARATOR.length;
    parts.push(item.str);
    spans.push({ start: cursor, end: cursor + item.str.length });
    cursor += item.str.length;
  });

  return { text: parts.join(PDF_ITEM_SEPARATOR), spans };
}

/** A positioned text item, in CSS pixels relative to the rendered page. */
export interface PdfTextSpan {
  text: string;
  left: number;
  top: number;
  /** The item's own advance width. `0` when pdf.js did not report one. */
  width: number;
  fontSize: number;
  /** Index into the page's original items — the seam back to the projection. */
  item: number;
}

/** A rectangle to paint over the page, in CSS pixels. */
export interface PdfHighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Whether this box is the highlight the viewer is currently pointed at. */
  active: boolean;
}

/**
 * Fallback advance per character when pdf.js reports no width.
 *
 * Half an em is the rough mean advance of Latin text; it only ever decides how
 * wide a box is drawn, never where the reader is taken.
 */
const FALLBACK_ADVANCE = 0.5;

/**
 * Boxes for every marked range that falls on this page.
 *
 * `pageStart` is where this page's chunk begins in the projection, which is what
 * makes a whole-document offset comparable with a per-page item offset.
 */
export function rangeBoxes(
  spans: readonly PdfTextSpan[],
  chunk: PdfPageChunk,
  pageStart: number,
  marks: MarkRanges,
): PdfHighlightBox[] {
  if (marks.ranges.length === 0) return [];

  const boxes: PdfHighlightBox[] = [];
  for (const span of spans) {
    const item = chunk.spans[span.item];
    if (!item || item.end === item.start) continue;

    const local = localizeRanges(marks, pageStart + item.start, pageStart + item.end);
    if (local.ranges.length === 0) continue;

    const length = item.end - item.start;
    const advance = span.width > 0 ? span.width / length : span.fontSize * FALLBACK_ADVANCE;
    local.ranges.forEach(([from, to], index) => {
      boxes.push({
        left: span.left + advance * from,
        top: span.top,
        width: advance * (to - from),
        height: span.fontSize,
        active: index === local.activeIndex,
      });
    });
  }
  return boxes;
}

/**
 * Boxes for `rect` addresses, whose geometry is already the answer.
 *
 * Fractions rather than pixels is what makes them survive zoom and a resize: the
 * same address is correct at 50% and at 300% because it is multiplied by the
 * page's CURRENT rendered size every time.
 */
export function rectBoxes(
  highlights: readonly ResolvedHighlight[],
  size: { width: number; height: number },
): PdfHighlightBox[] {
  const boxes: PdfHighlightBox[] = [];
  for (const highlight of highlights) {
    for (const rect of highlight.rects ?? []) {
      boxes.push({
        left: clampFraction(rect.x) * size.width,
        top: clampFraction(rect.y) * size.height,
        width: clampFraction(rect.width) * size.width,
        height: clampFraction(rect.height) * size.height,
        active: highlight.active,
      });
    }
  }
  return boxes;
}

/** Keep a foreign document's geometry inside the page it claims to be on. */
function clampFraction(value: DocumentRect["x"]): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Which page a highlight is on, so activating it can turn to that page.
 *
 * A `rect` carries its own page — geometry has no range to look up. Everything
 * else is looked up through the document's own index, because the ref type is the
 * adapter's business and this adapter's is the page number. A caller's page HINT
 * is deliberately not consulted: it is the resolver's job to leave it off
 * (`ResolvedHighlight.page`), since a stale hint would turn to a page the mark is
 * not on. A range landing on a page separator, or past the extraction cap, has no
 * page and the pager stays put rather than jumping somewhere arbitrary.
 */
export function pageOfHighlight(
  highlight: ResolvedHighlight | undefined,
  index: TextIndex<unknown> | undefined,
): number | undefined {
  if (!highlight || highlight.status !== "resolved") return undefined;
  if (highlight.page !== undefined) return highlight.page;
  if (!highlight.range || !index) return undefined;
  const span = spanAt(index, highlight.range[0]);
  return typeof span?.ref === "number" ? span.ref : undefined;
}
