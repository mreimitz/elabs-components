/**
 * Markdown highlights are BLOCK-shaped, and that is a deliberate downgrade.
 *
 * Every other text adapter marks characters, because its `document.text` is the
 * thing on screen. Markdown's is not: `text` is the SOURCE, so offset 12 might
 * land in the middle of `**bold**` — two of whose characters are never drawn at
 * all — or inside a link's URL, which the reader only sees as a word. There is
 * no honest character-level mapping from source offsets to rendered text
 * without re-implementing the parser's own position bookkeeping for inline
 * nodes, and getting that subtly wrong would put marks on the wrong words while
 * looking exactly as confident as a correct one.
 *
 * So a markdown mark says "this passage is in HERE" — the paragraph, heading,
 * list item or fence whose source span the mark touches is plated whole. That
 * is enough for the case the feature exists for (a citation pointing a reader at
 * the passage an answer came from) and it cannot be subtly wrong: a block either
 * contains the source range or it does not.
 *
 * The offsets are trustworthy because the renderer runs Streamdown in
 * `mode="static"`, which hands the WHOLE file to one parse — no per-block
 * splitting, no incomplete-token repair — so every hast node's
 * `position.start.offset` is an offset into `document.text` itself.
 */

import { cn } from "@elabs/components-ui";

import type { MarkRanges } from "../../core/highlight-marks";

/** The subset of a unist `Position` this needs. Structural, so no unist import. */
export interface SourcePosition {
  start?: { offset?: number };
  end?: { offset?: number };
}

/** A hast node as the component overrides receive it. */
export interface PositionedNode {
  position?: SourcePosition;
}

/** Whether a block carries any mark, and whether it carries the current one. */
export interface BlockMark {
  marked: boolean;
  active: boolean;
}

const UNMARKED: BlockMark = { marked: false, active: false };

/**
 * Which marks land inside one block's source span.
 *
 * Half-open on both sides and strict, so a mark ending exactly where a block
 * begins belongs to the block before it — otherwise the paragraph after a
 * marked heading would light up too, on every citation.
 */
export function blockMark(marks: MarkRanges, node: PositionedNode | undefined): BlockMark {
  const start = node?.position?.start?.offset;
  const end = node?.position?.end?.offset;
  if (start === undefined || end === undefined || end <= start) return UNMARKED;

  let marked = false;
  let active = false;
  marks.ranges.forEach(([from, to], index) => {
    if (from >= end || to <= start) return;
    marked = true;
    if (index === marks.activeIndex) active = true;
  });
  return marked ? { marked, active } : UNMARKED;
}

/**
 * The attributes a plated block carries.
 *
 * `data-slot`/`data-active` are the same seam the character marks use, so one
 * selector finds "the current highlight" whatever adapter drew it — that is what
 * `useScrollActiveHighlightIntoView` scrolls to. `aria-current` is the part that
 * is not decoration: the active block is announced as the current one rather
 * than being distinguishable only by a warmer plate (WCAG 1.4.1).
 */
export interface BlockMarkAttributes {
  "data-slot"?: "highlight-block";
  /**
   * Present-or-absent, never `"false"` — the same shape `MatchHighlight`'s marks
   * and the PDF's boxes emit, so one selector (`[data-active]`) finds the current
   * highlight whichever painter drew it.
   */
  "data-active"?: "";
  "aria-current"?: "true";
  className?: string;
}

/**
 * Plate classes.
 *
 * A marked block gets a fill AND a rail; the current one doubles the rail's
 * width on top of warming the fill, so "which one am I on" survives greyscale
 * and a colour-vision difference. The negative margins let the plate bleed into
 * the prose column's own gutter instead of shifting the text when it appears.
 */
const MARKED_CLASS = "bg-highlight/40 border-s-2 border-highlight rounded-e-sm ps-2 -ms-2";
const ACTIVE_CLASS =
  "bg-highlight-active/40 border-s-4 border-highlight-active rounded-e-sm ps-2 -ms-2";

/**
 * Spreadable attributes for a block, given how the marks fell on it.
 *
 * The block's OWN classes are merged last and therefore win, which is the
 * deliberate answer for a fenced code block: `bg-surface-muted` beats the
 * plate's fill, so the code keeps its own ground and the rail alone says it is
 * cited. Leaving the order to CSS source order instead would make that outcome
 * accidental.
 */
export function blockMarkAttributes(mark: BlockMark, className?: string): BlockMarkAttributes {
  if (!mark.marked) return className === undefined ? {} : { className };
  return {
    "data-slot": "highlight-block",
    ...(mark.active ? { "data-active": "" as const, "aria-current": "true" as const } : {}),
    className: cn(mark.active ? ACTIVE_CLASS : MARKED_CLASS, className),
  };
}
