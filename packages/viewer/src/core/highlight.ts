/**
 * What the viewer is pointed AT — the vocabulary shared by citations and
 * find-in-document.
 *
 * A {@link DocumentHighlight} is what a caller asks for; a
 * {@link ResolvedHighlight} is what the viewer worked out and what an adapter's
 * `Renderer` is handed. Keeping the two apart is what lets "we could not find
 * that passage" be a rendered STATE rather than a silent no-op: the request
 * survives even when the location does not, so the chrome still has something
 * to name.
 *
 * The address vocabulary itself lives in `@elabs-ai/components-ui`
 * (`DocumentAddress`) because the producer of a citation and this consumer are
 * sibling packages that may not import each other. Everything here is
 * adapter-protocol detail and stays in this package.
 */

import type {
  DocumentAddress,
  DocumentAddressKind,
  DocumentRect,
  MatchRange,
} from "@elabs-ai/components-ui";

/**
 * Where a highlight came from. Both paint identically — only which one is
 * ACTIVE differs — but the origin decides who owns the list: citations are a
 * controlled prop the app supplies, search matches are the viewer's own.
 */
export type HighlightSource = "citation" | "search";

/** A request to point the viewer at part of the open document. */
export interface DocumentHighlight {
  /**
   * Stable per highlight. It is what `activeHighlightId` names and what React
   * keys on, so a list that renumbers between renders must not renumber ids.
   */
  id: string;
  /** Which part of the document. */
  address: DocumentAddress;
  /**
   * Short human label — the answer's claim, the source's title. Announced when
   * this highlight becomes active, so prefer something a listener can act on
   * over "Citation 3".
   */
  label?: string;
  /** Defaults to `"citation"`. */
  source?: HighlightSource;
}

/**
 * How a request turned out.
 *
 * `unsupported` is a CAPABILITY GAP, not a failure — the same distinction the
 * error panel already draws. "This build can't locate a rect in a Word file"
 * is news about what we shipped; it is not the reader's mistake, and it is not
 * retryable.
 */
export type HighlightStatus = "pending" | "resolved" | "not-found" | "unsupported";

/** Why a passage was not found — the two are genuinely different news. */
export type HighlightMissReason =
  /** Searched the whole projection; the passage is not in it. */
  | "absent"
  /** The projection is capped, and the passage may lie past the cap. */
  | "truncated";

/** A request, plus where it landed. What every adapter `Renderer` receives. */
export interface ResolvedHighlight {
  id: string;
  label?: string;
  source: HighlightSource;
  status: HighlightStatus;
  /** The original request, so a renderer can honour a kind the shell cannot. */
  address: DocumentAddress;
  /** Whether the viewer is currently pointed at this one. */
  active: boolean;
  /**
   * 1-based position among the highlights of the same `source` that resolved —
   * the "3" in "3 of 12". Absent when this one did not resolve, so a miss never
   * silently consumes a number the reader is counting through.
   */
  index?: number;
  /** Offsets into `document.text`, once located. */
  range?: MatchRange;
  /**
   * 1-based page, set only for a `rect` address — the one kind with no range to
   * derive a position from.
   *
   * A `quote` or `range` deliberately leaves this empty even when the caller
   * supplied a page hint: where the passage actually landed is knowable from the
   * adapter's own index, and a stale hint used as an instruction would page the
   * reader somewhere the mark is not.
   */
  page?: number;
  /** Geometry, for a `rect` address. */
  rects?: readonly DocumentRect[];
  /** Only on `not-found`. */
  reason?: HighlightMissReason;
}

/**
 * The most matches find-in-document will paint.
 *
 * A one-letter query against a 2 MB log matches hundreds of thousands of times;
 * every one of those is a DOM element. The cap keeps typing responsive, and the
 * chrome says so rather than quietly showing a wrong total.
 */
export const FIND_MATCH_LIMIT = 2000;

/** Prefix reserved for the viewer's own search matches. */
const FIND_ID_PREFIX = "find:";

/** The id for the nth (0-based) find match. */
export function findMatchId(index: number): string {
  return `${FIND_ID_PREFIX}${String(index)}`;
}

/** Whether an id belongs to find-in-document rather than to a caller. */
export function isFindMatchId(id: string): boolean {
  return id.startsWith(FIND_ID_PREFIX);
}

/** Which address kinds an adapter honours. Absent means none — the safe default. */
export type HighlightSupport = readonly DocumentAddressKind[];
