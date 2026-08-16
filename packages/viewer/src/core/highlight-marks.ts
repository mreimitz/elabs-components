/**
 * The MAP + PAINT half of the highlight funnel, for adapters whose document IS
 * its own text projection — plain text, code, and anything else that renders
 * `document.text` verbatim.
 *
 * The shell has already done LOCATE (every quote is now a character range). All
 * that is left is to hand those ranges to `MatchHighlight` and say which one is
 * current. An adapter with a richer model (pages, blocks, cells) maps the same
 * ranges through its own `textIndex` instead and does not use this.
 */

import { normalizeRanges, type MatchRange } from "@qlik-coe-emea/qlabs-components-ui";

import type { ResolvedHighlight } from "./highlight";

/** What `MatchHighlight` takes: merged ranges, plus which merged mark is current. */
export interface MarkRanges {
  /** Clamped, sorted and merged — the same ranges `MatchHighlight` will paint. */
  readonly ranges: readonly MatchRange[];
  /** Index into {@link MarkRanges.ranges}, or `-1` when none is current. */
  readonly activeIndex: number;
}

const EMPTY: MarkRanges = { ranges: [], activeIndex: -1 };

/**
 * Fold resolved highlights into the ranges a `<mark>` layer paints.
 *
 * Merging happens HERE rather than being left to `MatchHighlight`, because the
 * two would otherwise disagree about what "the third mark" is: overlapping
 * citations collapse into one mark, and an `activeIndex` counted against the
 * unmerged list would then point at the wrong one — or past the end. The active
 * entry is located by which merged range CONTAINS its start, so it stays right
 * no matter how many requests collapsed into that mark.
 *
 * Non-`range` addresses and unresolved entries are skipped: an adapter paints
 * what it can and the shell is what tells the reader about the rest.
 */
export function toMarkRanges(
  highlights: readonly ResolvedHighlight[] | undefined,
  textLength: number,
): MarkRanges {
  if (!highlights || highlights.length === 0) return EMPTY;

  const located = highlights.filter(
    (highlight): highlight is ResolvedHighlight & { range: MatchRange } =>
      highlight.status === "resolved" && highlight.range !== undefined,
  );
  if (located.length === 0) return EMPTY;

  const ranges = normalizeRanges(
    located.map((highlight) => highlight.range),
    textLength,
  );

  const active = located.find((highlight) => highlight.active);
  const activeStart = active?.range[0];
  const activeIndex =
    activeStart === undefined
      ? -1
      : ranges.findIndex(([start, end]) => activeStart >= start && activeStart < end);

  return { ranges, activeIndex };
}

/**
 * Re-express document ranges relative to one slice of the document — a code
 * token, a table cell, a block of prose.
 *
 * A renderer that draws its text in pieces cannot hand whole-document offsets to
 * a `<mark>` layer that only knows about the piece in front of it. Ranges are
 * clipped to the slice and rebased to 0; the ones that miss it entirely drop
 * out, which is also how a caller learns there is nothing to mark here (an empty
 * `ranges`). A range spanning several slices survives in each of them, so a
 * citation crossing a line break stays one visual run.
 */
export function localizeRanges(
  { ranges, activeIndex }: MarkRanges,
  start: number,
  end: number,
): MarkRanges {
  if (ranges.length === 0 || start >= end) return EMPTY;

  const local: MatchRange[] = [];
  let localActive = -1;
  ranges.forEach(([from, to], index) => {
    const clippedFrom = Math.max(from, start);
    const clippedTo = Math.min(to, end);
    if (clippedFrom >= clippedTo) return;
    if (index === activeIndex) localActive = local.length;
    local.push([clippedFrom - start, clippedTo - start]);
  });

  return local.length === 0 ? EMPTY : { ranges: local, activeIndex: localActive };
}
