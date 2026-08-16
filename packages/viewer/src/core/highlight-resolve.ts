/**
 * Turning a request into a location — the LOCATE step, and the only step that
 * runs outside the adapter.
 *
 * The funnel is three stages with three homes. **Locate** (here) answers "where
 * in the text projection is this?" and produces character offsets. **Map** (the
 * adapter's renderer) turns those offsets into its own model — block 14, page 3,
 * cell B7. **Paint** (also the renderer) draws it and scrolls to it.
 *
 * Locate lives in the shell rather than in each adapter because its OUTCOME is
 * chrome state, not pixels: "3 of 12", "we couldn't find that passage", "this
 * build can't locate a box in a Word file". Every adapter would otherwise write
 * that logic again, slightly differently, and the shell would have no way to
 * count what it is showing. It is also pure — no DOM, no engine — so it is
 * testable without jsdom.
 */

import {
  normalizeQuoteText,
  type MatchRange,
  type NormalizedText,
  type QuoteAddress,
} from "@qlik-coe-emea/qlabs-components-ui";

import type { DocumentHighlight, HighlightSupport, ResolvedHighlight } from "./highlight";

/**
 * Find a quoted passage in a normalized projection and map it back to raw
 * offsets.
 *
 * Both sides are folded first (whitespace, quote glyphs, case), because a
 * citation is re-typed by a model or extracted by a different tool and will
 * essentially never be byte-identical to what our parser produced.
 *
 * Ambiguity is resolved by the caller's own hints and never guessed at: an
 * explicit `occurrence` wins, then proximity to `near.offset`, then the first
 * match. Returning the first match silently would put a citation on the wrong
 * paragraph of a document that repeats a heading.
 */
export function locateQuote(
  normalized: NormalizedText,
  address: QuoteAddress,
): MatchRange | undefined {
  const needle = normalizeQuoteText(address.text);
  if (needle.length === 0) return undefined;

  const starts: number[] = [];
  for (let at = normalized.text.indexOf(needle); at !== -1; ) {
    starts.push(at);
    // Step by one, not by the needle's length: overlapping occurrences of a
    // repeated phrase ("na na na") are still distinct places in the document.
    at = normalized.text.indexOf(needle, at + 1);
  }
  if (starts.length === 0) return undefined;

  const toRange = (start: number): MatchRange => [
    normalized.offsets[start] as number,
    normalized.offsets[start + needle.length] as number,
  ];

  if (address.occurrence !== undefined) {
    const chosen = starts[address.occurrence - 1];
    // An out-of-range occurrence is a miss, not a fallback to the first: the
    // caller asked for the fourth of three, and quietly marking the first would
    // be a confidently wrong citation.
    return chosen === undefined ? undefined : toRange(chosen);
  }

  const near = address.near?.offset;
  if (near !== undefined) {
    let best = starts[0] as number;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const start of starts) {
      const distance = Math.abs((normalized.offsets[start] as number) - near);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = start;
      }
    }
    return toRange(best);
  }

  return toRange(starts[0] as number);
}

export interface HighlightResolveContext {
  /**
   * The document's text projection, folded once with its offset map. Absent
   * when the format has no text projection at all.
   *
   * Pre-folded rather than raw because find-in-document re-resolves on every
   * keystroke, and folding a 2 MB projection per keystroke is what turns a
   * search box into a stutter.
   */
  normalized?: NormalizedText;
  /** Length of the RAW projection, for clamping `range` addresses. */
  textLength?: number;
  /** Whether that projection is capped, which changes what a miss MEANS. */
  truncated?: boolean;
  /** Which address kinds this document's adapter honours. */
  supported: HighlightSupport;
  /** The highlight the viewer is currently pointed at. */
  activeId?: string | null;
}

/** Sort key: where in the document this landed. Unresolved sorts last. */
function positionOf(highlight: ResolvedHighlight): number {
  if (highlight.range) return highlight.range[0];
  if (highlight.page !== undefined) return highlight.page;
  return Number.POSITIVE_INFINITY;
}

function resolveOne(
  highlight: DocumentHighlight,
  context: HighlightResolveContext,
): ResolvedHighlight {
  const source = highlight.source ?? "citation";
  const address = highlight.address;
  const base = { id: highlight.id, label: highlight.label, source, address, active: false };

  // The load-bearing contract: match only the kinds this adapter DECLARED, and
  // report the rest. No exhaustive switch, no `never` fallthrough — that is
  // what lets a fourth address kind be added later without breaking every
  // consumer that predates it.
  if (!context.supported.includes(address.kind)) {
    return { ...base, status: "unsupported" };
  }

  if (address.kind === "rect") {
    // Geometry needs no text and cannot fail to "locate" — whether the page
    // exists is the renderer's business, since only it knows the page count.
    return { ...base, status: "resolved", page: address.page, rects: address.rects };
  }

  const miss = (): ResolvedHighlight => ({
    ...base,
    status: "not-found",
    reason: context.truncated ? "truncated" : "absent",
  });

  if (address.kind === "range") {
    const length = context.textLength;
    if (length === undefined) return miss();
    const start = Math.max(0, Math.min(address.start, length));
    const end = Math.max(start, Math.min(address.end, length));
    // A range clamped to nothing is a miss, not a zero-width mark: the offsets
    // were computed against a longer projection than the one we have.
    if (end === start) return miss();
    // No `page`. A producer's page number is a hint, and a wrong one used as an
    // instruction turns the pager to a blank page while the mark sits elsewhere.
    // Where the range actually landed is knowable from the adapter's own index,
    // so that is what navigation uses; `page` stays authoritative only for
    // `rect`, which has no range to derive it from.
    return { ...base, status: "resolved", range: [start, end] };
  }

  if (!context.normalized) return miss();
  const range = locateQuote(context.normalized, address);
  if (!range) return miss();
  return { ...base, status: "resolved", range };
}

/**
 * Resolve every request, in document order, numbered per source.
 *
 * Document order rather than the caller's, because "next match" has to mean the
 * next one down the page — an app listing citations in relevance order would
 * otherwise send the reader jumping backwards. Numbering is per `source` so the
 * find box's "3 of 12" counts search matches only, and never the citations
 * painted beside them.
 */
export function resolveHighlights(
  highlights: readonly DocumentHighlight[],
  context: HighlightResolveContext,
): ResolvedHighlight[] {
  const resolved = highlights
    .map((highlight) => resolveOne(highlight, context))
    .sort((a, b) => positionOf(a) - positionOf(b));

  const counters = new Map<string, number>();
  return resolved.map((highlight) => {
    const next =
      highlight.status === "resolved" ? (counters.get(highlight.source) ?? 0) + 1 : undefined;
    if (next !== undefined) counters.set(highlight.source, next);
    return {
      ...highlight,
      index: next,
      active: context.activeId != null && context.activeId === highlight.id,
    };
  });
}
