/**
 * How one part of a document is addressed.
 *
 * A viewer that can only open a file answers "here is the document". A viewer
 * that can be pointed at a PART of one answers "here is the sentence that
 * claim came from" — the RAG-citation case, and the same machinery behind
 * find-in-document.
 *
 * ## Why this lives in `@qlik-coe-emea/qlabs-components-ui`
 *
 * The producer of an address (a chat answer's citation, in
 * `@qlik-coe-emea/qlabs-components-ai`) and its consumer (the file viewer, in
 * `@qlik-coe-emea/qlabs-components-viewer`) are Layer-2 siblings that may not
 * import each other. `ui` is the only layer both reach, which is exactly why
 * `FileSource` and `MatchRange` already live here. This module is a
 * dependency-free leaf: types plus pure string functions, no React.
 *
 * ## Three kinds, one union
 *
 * Real producers disagree about what they can emit, so the union carries all
 * three rather than forcing everyone through the weakest:
 *
 * - **`quote`** — the snippet text. The only kind that survives crossing a tool
 *   boundary: an indexing pipeline's character offsets are computed against ITS
 *   extraction of the PDF, never against ours, so its numbers are meaningless
 *   here while its text still is. Lossy (a repeated phrase is ambiguous) and the
 *   most useful.
 * - **`range`** — exact character offsets, and exact only against the SAME text
 *   projection: `AdapterDocument.text` as this build's adapter produced it. Use
 *   it when both ends are ours (find-in-document, a second pass over a document
 *   already open).
 * - **`rect`** — page-relative boxes, `0..1` fractions of the page. Needs no
 *   text at all, which is what makes it the answer for a scanned page, a chart,
 *   a photo region, or any layout-analysis model whose output is geometry.
 *
 * ## The rule that lets this union grow
 *
 * A consumer matches only the kinds it declared it honours and reports the rest
 * as unsupported — it never writes an exhaustive `switch` with a `never`
 * fallthrough. That is what lets a fourth kind (a spreadsheet `cell` address,
 * say) be added later without breaking every consumer that predates it.
 */

/** The address kinds, as a value — for capability declarations and iteration. */
export const DOCUMENT_ADDRESS_KINDS = ["quote", "range", "rect"] as const;

/** Which way a part of a document is addressed. */
export type DocumentAddressKind = (typeof DOCUMENT_ADDRESS_KINDS)[number];

/**
 * A box on a page, as fractions of that page's own box.
 *
 * Fractions, not pixels, because the page is not a fixed size: it rescales with
 * zoom, with the pane's width and with the device's pixel ratio. A consumer
 * multiplies by the page element's live measured size at paint time, so the box
 * stays put through every one of those. Origin is top-left (CSS), so `y` grows
 * downward — matching the DOM rather than the PDF's own bottom-left space.
 */
export interface DocumentRect {
  /** Distance from the page's left edge, `0..1`. */
  x: number;
  /** Distance from the page's TOP edge, `0..1`. */
  y: number;
  /** Fraction of the page's width. */
  width: number;
  /** Fraction of the page's height. */
  height: number;
}

/**
 * Address by the text itself — the interoperable kind.
 *
 * Matching is done on the normalized form of both sides
 * ({@link normalizeQuoteText}), so a quote survives the whitespace, quote-glyph
 * and casing differences that every extractor introduces.
 */
export interface QuoteAddress {
  kind: "quote";
  /** The passage to find. Whitespace and quote glyphs need not match exactly. */
  text: string;
  /**
   * Which occurrence to take when the passage appears more than once, 1-based.
   * Omitted means the first — or the one nearest {@link QuoteAddress.near},
   * when that is given.
   */
  occurrence?: number;
  /**
   * A hint about where to look. It disambiguates repeats rather than restricting
   * the search: the occurrence closest to it wins, and a passage that turns out
   * to be elsewhere is still found.
   */
  near?: {
    /**
     * 1-based page (or slide) the passage is expected on.
     *
     * Advisory, and deliberately NOT used to navigate: the viewer turns to the
     * page the passage was actually located on, so a stale hint cannot send a
     * reader to a blank page. Only {@link QuoteAddress.near.offset} takes part in
     * tie-breaking today; a renderer may read this off the address if it wants
     * more.
     */
    page?: number;
    /** Approximate character offset the passage is expected near. */
    offset?: number;
  };
}

/**
 * Address by character offsets into `AdapterDocument.text`, half-open
 * `[start, end)` — the same convention as `MatchRange`.
 *
 * Only meaningful against the text projection THIS build produced. An offset
 * from a foreign pipeline is not this kind; it is a {@link QuoteAddress}.
 */
export interface RangeAddress {
  kind: "range";
  start: number;
  end: number;
  /**
   * 1-based page hint, when the producer knows it. Advisory only — the viewer
   * derives the page from the offsets against its own index, so a hint that
   * disagrees cannot misdirect the pager.
   */
  page?: number;
}

/** Address by geometry — one or more boxes on one page. */
export interface RectAddress {
  kind: "rect";
  /** 1-based page (or slide) number. */
  page: number;
  /**
   * The boxes making up this one addressed part. An array, not a single box,
   * because a real passage wraps: a sentence spanning three lines is three
   * boxes, and a two-column paragraph is more. Painting them as one shape each
   * is what avoids stitching DOM ranges together.
   */
  rects: readonly DocumentRect[];
}

/** Which part of a document something refers to. */
export type DocumentAddress = QuoteAddress | RangeAddress | RectAddress;

/* -------------------------------------------------------------------------- */
/* Quote normalization                                                         */
/* -------------------------------------------------------------------------- */

/** Straightened 1:1 — every one of these is one code unit in and one out. */
const CHARACTER_FOLDS: Readonly<Record<string, string>> = {
  // Curly quotes and primes. A model quoting a PDF re-types these constantly;
  // the file has the other one.
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "″": '"',
  // Dashes. PDF extraction yields the typographic one, prose yields a hyphen.
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "―": "-",
  "−": "-",
};

/**
 * Invisible, and typically present in exactly one of the two strings being
 * compared: soft hyphen (a PDF's line-break artefact), zero-width space, ZWNJ,
 * ZWJ, word joiner. Written as escapes because a literal here is unreviewable —
 * it renders as nothing.
 */
const DROPPED = new Set(["­", "​", "‌", "‍", "⁠"]);

/**
 * Anything that collapses into one space. Plain `\s` is already the full set in
 * JavaScript — it covers NBSP, the `U+2000`–`U+200A` spaces, the line and
 * paragraph separators, narrow NBSP, ideographic space and the BOM.
 */
const WHITESPACE = /\s/u;

/**
 * The result of normalizing, with the way back.
 *
 * `offsets` has one more entry than `text` has characters: `offsets[i]` is the
 * index in the ORIGINAL string where normalized character `i` came from, and
 * the final entry is one past the last character that survived — NOT the
 * original's length, which would drag trailing whitespace into every range that
 * runs to the end. So a normalized range `[a, b)` maps back to
 * `[offsets[a], offsets[b])` with no arithmetic, which is the whole point of
 * building the map rather than searching twice.
 */
export interface NormalizedText {
  text: string;
  offsets: readonly number[];
}

/**
 * Fold a string to its canonical match key, keeping a map back to the original.
 *
 * Every rule is a collapse, a drop or a 1:1 swap — never an expansion — so the
 * map stays monotone and a range maps back exactly. That constraint is why
 * ligatures (`ﬁ`) and the ellipsis character are deliberately left alone: both
 * would be 1:many, and a fuzzier match is not worth an offset map that can no
 * longer be trusted.
 *
 * What it does: collapses every whitespace run to one space and trims; drops
 * zero-width characters and soft hyphens; straightens curly quotes and dashes;
 * folds case — a citation is matched case-insensitively, and that is a property
 * of the match key rather than a flag every caller has to remember.
 */
export function normalizeQuoteTextWithOffsets(input: string): NormalizedText {
  const out: string[] = [];
  const offsets: number[] = [];
  let pendingSpaceAt: number | undefined;
  /** One past the last surviving character — the map's terminal entry. */
  let end = 0;

  for (let i = 0; i < input.length; i += 1) {
    const character = input[i] as string;

    if (WHITESPACE.test(character)) {
      // Held rather than emitted, so a trailing run never reaches the output
      // and a leading one is dropped by the `out.length` test below.
      pendingSpaceAt ??= i;
      continue;
    }
    if (DROPPED.has(character)) continue;

    if (pendingSpaceAt !== undefined) {
      if (out.length > 0) {
        out.push(" ");
        // The single space stands for the whole run, so it points at where the
        // run began — not at the character that ended it.
        offsets.push(pendingSpaceAt);
      }
      pendingSpaceAt = undefined;
    }

    const folded = CHARACTER_FOLDS[character] ?? character;
    const lowered = folded.toLowerCase();
    // Guard the 1:1 invariant: a few code points grow when lowercased
    // (`İ` → `i̇`). Keeping the original is a worse match and a correct map; the
    // reverse trade would silently corrupt every offset after it.
    out.push(lowered.length === folded.length ? lowered : folded);
    offsets.push(i);
    end = i + 1;
  }

  offsets.push(end);
  return { text: out.join(""), offsets };
}

/**
 * The canonical match key for a quote — {@link normalizeQuoteTextWithOffsets}
 * without the map, for comparing or de-duplicating two quotes.
 */
export function normalizeQuoteText(input: string): string {
  return normalizeQuoteTextWithOffsets(input).text;
}
