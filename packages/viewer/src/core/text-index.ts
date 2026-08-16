/**
 * The map from a document's flat text projection back into its own model.
 *
 * `AdapterDocument.text` is the address space every text-based highlight is
 * expressed in — but a renderer does not draw a flat string. It draws Word
 * blocks, PDF pages, spreadsheet cells, code lines. So "characters 812–847 of
 * the projection" has to become "the second half of block 14" before anything
 * can be painted, and only the adapter knows how.
 *
 * That translation is the same bookkeeping every time — running offsets, a
 * separator between chunks, a lookup by position — so it is written once here
 * and each adapter supplies only its own `ref` type: a block index, a page
 * number, a `{ sheet, row, column }` triple. The builder is what guarantees the
 * projection and the index can never disagree, because the projection is its
 * output rather than a second thing assembled by hand.
 */

import type { MatchRange } from "@elabs-ai/components-ui";

/** One chunk of the projection, and what it came from. */
export interface TextSpan<TRef> {
  /** Half-open `[start, end)` into the projection's text. */
  start: number;
  end: number;
  /** The adapter's own pointer back into its model. */
  ref: TRef;
}

/** A flat text projection plus the way back into the model that produced it. */
export interface TextIndex<TRef> {
  text: string;
  /** Sorted by `start`, non-overlapping. Gaps are the separators between chunks. */
  spans: readonly TextSpan<TRef>[];
}

export interface TextIndexBuilderOptions {
  /**
   * Written between chunks and owned by no span, so a highlight can never be
   * reported as covering the joint between two blocks. `"\n"` by default.
   */
  separator?: string;
}

export interface TextIndexBuilder<TRef> {
  /**
   * Append a chunk. Empty chunks are skipped — an empty span matches nothing.
   *
   * `separator` overrides the builder's default for THIS joint only, which is
   * how a multi-level projection stays one index: a workbook joins cells with a
   * tab, rows with a newline and sheets with a blank line, and stitching three
   * separate indexes together afterwards is exactly the offset bookkeeping this
   * module exists to do once.
   */
  push(chunk: string, ref: TRef, separator?: string): void;
  build(): TextIndex<TRef>;
}

/** Assemble a projection and its index together, so they cannot drift apart. */
export function createTextIndexBuilder<TRef>(
  options: TextIndexBuilderOptions = {},
): TextIndexBuilder<TRef> {
  const fallback = options.separator ?? "\n";
  const parts: string[] = [];
  const spans: TextSpan<TRef>[] = [];
  let cursor = 0;

  return {
    push(chunk, ref, separator = fallback) {
      if (chunk.length === 0) return;
      if (parts.length > 0) {
        parts.push(separator);
        cursor += separator.length;
      }
      parts.push(chunk);
      spans.push({ start: cursor, end: cursor + chunk.length, ref });
      cursor += chunk.length;
    },
    build() {
      return { text: parts.join(""), spans };
    },
  };
}

/** A span a range touches, with the overlap expressed in the CHUNK's own offsets. */
export interface SpanOverlap<TRef> {
  span: TextSpan<TRef>;
  /** Offset into the chunk, not into the projection. */
  start: number;
  end: number;
}

/** Index of the first span ending after `offset`, or `spans.length`. */
function lowerBound<TRef>(spans: readonly TextSpan<TRef>[], offset: number): number {
  let lo = 0;
  let hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((spans[mid] as TextSpan<TRef>).end <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Every chunk a projection range touches, clipped to that chunk.
 *
 * Binary search rather than a scan: a highlighted sentence in a 5,000-cell
 * spreadsheet touches one or two spans, and walking all 5,000 to find them —
 * once per highlight, on every render — is what makes a find-as-you-type box
 * stutter.
 */
export function spansForRange<TRef>(
  index: TextIndex<TRef>,
  [start, end]: MatchRange,
): SpanOverlap<TRef>[] {
  if (end <= start) return [];
  const out: SpanOverlap<TRef>[] = [];
  for (let i = lowerBound(index.spans, start); i < index.spans.length; i += 1) {
    const span = index.spans[i] as TextSpan<TRef>;
    if (span.start >= end) break;
    out.push({
      span,
      start: Math.max(start, span.start) - span.start,
      end: Math.min(end, span.end) - span.start,
    });
  }
  return out;
}

/**
 * Where the `index`-th part of a joined string begins, given where the join
 * begins.
 *
 * The counterpart of pushing a whole row as one chunk: the REF can be the row
 * while the MARK is still the character, because a cell's offset is the sum of
 * the cells before it plus their separators. Used by every renderer that draws
 * one chunk in several pieces — a Word table row, a spreadsheet row, a
 * paragraph's styled runs. `undefined` in, `undefined` out, so a caller with no
 * index does not need a branch.
 */
export function chunkOffset(
  parts: readonly string[],
  index: number,
  start: number | undefined,
  separator: string,
): number | undefined {
  if (start === undefined) return undefined;
  let offset = start;
  for (let i = 0; i < index; i += 1) {
    offset += (parts[i]?.length ?? 0) + separator.length;
  }
  return offset;
}

/** The chunk containing `offset`, or `undefined` when it lands on a separator. */
export function spanAt<TRef>(index: TextIndex<TRef>, offset: number): TextSpan<TRef> | undefined {
  const span = index.spans[lowerBound(index.spans, offset)];
  return span && span.start <= offset ? span : undefined;
}
