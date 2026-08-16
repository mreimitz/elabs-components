/**
 * PowerPoint XML → a slide outline.
 *
 * ## What a deck preview honestly is
 *
 * A `.pptx` slide is absolutely-positioned drawing: shapes at EMU coordinates,
 * theme-driven fills, transitions, embedded media. Reproducing that faithfully
 * is a rendering engine, not a preview — and a half-faithful reproduction is
 * worse than none, because it looks like the deck while quietly lying about it.
 *
 * So this reads the deck as an OUTLINE: per slide, the title, the text in
 * document order (with its indent level), and the speaker notes. That is the
 * content a reader is looking for when they open a deck in a file browser, it
 * renders in this system's typography, and it is honest about what it is.
 * Anything positional — layout, images, charts, transitions — is deliberately
 * absent; the toolbar's download is the answer for the real thing.
 *
 * Parsing goes through namespace URIs rather than `a:t` / `p:sp` tag names,
 * because the prefix is only a convention: a generator is free to bind the same
 * namespace to a different prefix, and tag-name matching would silently return
 * an empty deck.
 */

import { createTextIndexBuilder, type TextIndex } from "../../core/text-index";

/** The DrawingML namespace — text, paragraphs, tables. */
export const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
/** The PresentationML namespace — shapes, placeholders, the shape tree. */
export const PRESENTATION_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";

/** One line of slide text, with the indent level PowerPoint gave it. */
export interface PptxLine {
  text: string;
  /** Outline depth, `0` for a top-level bullet. */
  level: number;
}

export interface PptxSlide {
  /** 1-based position in the deck. */
  index: number;
  /** The title placeholder's text, when the slide has one. */
  title?: string;
  /** Every other line, in document order. */
  lines: PptxLine[];
  /** The slide's speaker notes, when it has any. */
  notes?: string;
}

/**
 * Order slide parts the way the deck does.
 *
 * A zip lists its entries in whatever order they were written, and
 * `slide10.xml` sorts before `slide2.xml` as a string — so the number is pulled
 * out and compared as a number.
 */
export function orderSlidePaths(paths: string[]): string[] {
  return paths
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((left, right) => slideNumber(left) - slideNumber(right));
}

/** The `N` in `…/slideN.xml`, or `0` when there is none. */
export function slideNumber(path: string): number {
  const match = /(\d+)\.xml$/.exec(path);
  return match?.[1] ? Number(match[1]) : 0;
}

/** All text under a node, in document order, as one string. */
function textOf(node: Element): string {
  const runs = node.getElementsByTagNameNS(DRAWING_NS, "t");
  let text = "";
  for (const run of Array.from(runs)) text += run.textContent ?? "";
  return text.trim();
}

/** The paragraphs directly under a shape, as lines. Empty paragraphs are dropped. */
function linesOf(shape: Element): PptxLine[] {
  const lines: PptxLine[] = [];
  for (const paragraph of Array.from(shape.getElementsByTagNameNS(DRAWING_NS, "p"))) {
    const text = textOf(paragraph);
    if (!text) continue;
    // `lvl` is absent for a top-level bullet, which is the common case.
    const properties = paragraph.getElementsByTagNameNS(DRAWING_NS, "pPr")[0];
    const level = Number(properties?.getAttribute("lvl") ?? 0);
    lines.push({ text, level: Number.isFinite(level) ? level : 0 });
  }
  return lines;
}

/** The placeholder type a shape declares (`title`, `ctrTitle`, `body`, …), if any. */
function placeholderType(shape: Element): string | undefined {
  const placeholder = shape.getElementsByTagNameNS(PRESENTATION_NS, "ph")[0];
  return placeholder?.getAttribute("type") ?? undefined;
}

/** Table text, row by row, tab-separated — a table on a slide is usually the point of it. */
function tableLines(frame: Element): PptxLine[] {
  const lines: PptxLine[] = [];
  for (const row of Array.from(frame.getElementsByTagNameNS(DRAWING_NS, "tr"))) {
    const cells = Array.from(row.getElementsByTagNameNS(DRAWING_NS, "tc")).map(textOf);
    const text = cells.join("\t").trim();
    if (text) lines.push({ text, level: 0 });
  }
  return lines;
}

/**
 * Parse one `ppt/slides/slideN.xml` document into a slide.
 *
 * The shape tree is walked in document order, so the outline reads in the order
 * the shapes were authored rather than in the order the file happens to store
 * them. A shape kind this does not name contributes nothing — the same
 * allowlist-by-parse the Word adapter uses.
 */
export function parseSlide(document: Document, index: number): PptxSlide {
  const tree = document.getElementsByTagNameNS(PRESENTATION_NS, "spTree")[0];
  const slide: PptxSlide = { index, lines: [] };
  if (!tree) return slide;

  for (const node of Array.from(tree.children)) {
    if (node.namespaceURI !== PRESENTATION_NS) continue;
    if (node.localName === "sp") {
      const type = placeholderType(node);
      const lines = linesOf(node);
      if ((type === "title" || type === "ctrTitle") && !slide.title) {
        // A title placeholder can hold several paragraphs; they are one heading.
        const title = lines.map((line) => line.text).join(" ");
        if (title) slide.title = title;
        continue;
      }
      slide.lines.push(...lines);
      continue;
    }
    if (node.localName === "graphicFrame") slide.lines.push(...tableLines(node));
  }
  return slide;
}

/** Parse a `ppt/notesSlides/notesSlideN.xml` document into its notes text. */
export function parseNotes(document: Document): string | undefined {
  const tree = document.getElementsByTagNameNS(PRESENTATION_NS, "spTree")[0];
  if (!tree) return undefined;

  const lines: string[] = [];
  for (const shape of Array.from(tree.getElementsByTagNameNS(PRESENTATION_NS, "sp"))) {
    // The notes part repeats the slide's own body as a non-editable copy; only
    // the notes placeholder holds what the presenter actually wrote.
    if (placeholderType(shape) !== "body") continue;
    for (const line of linesOf(shape)) lines.push(line.text);
  }
  const notes = lines.join("\n").trim();
  return notes || undefined;
}

/** The OPC relationships namespace — how a part points at another part. */
export const RELATIONSHIP_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/**
 * Resolve a relationship target (`../notesSlides/notesSlide1.xml`) against the
 * part that declared it (`ppt/slides/slide1.xml`).
 *
 * Zip entry names are plain strings, not URLs, so `..` has to be walked by hand.
 */
export function resolveRelative(fromPart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const segments = fromPart.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

/**
 * The notes part a slide points at, if any.
 *
 * Read from the slide's own `_rels`, not by matching `slideN` to `notesSlideN`:
 * the numbers agree in decks PowerPoint wrote from scratch and drift in decks
 * that have had slides deleted, which would attach the wrong presenter notes to
 * the wrong slide — a quiet, plausible-looking error.
 */
export function notesTarget(rels: Document, slidePath: string): string | undefined {
  for (const relationship of Array.from(
    rels.getElementsByTagNameNS(RELATIONSHIP_NS, "Relationship"),
  )) {
    if (!relationship.getAttribute("Type")?.endsWith("/notesSlide")) continue;
    const target = relationship.getAttribute("Target");
    if (target) return resolveRelative(slidePath, target);
  }
  return undefined;
}

/** Between two lines of the same slide. */
export const PPTX_LINE_SEPARATOR = "\n";
/** Between two slides. */
export const PPTX_SLIDE_SEPARATOR = "\n\n";

/** The `line` of a slide's title. */
export const PPTX_TITLE_LINE = -1;
/** The `line` of a slide's speaker notes. */
export const PPTX_NOTES_LINE = -2;

/** Where a stretch of the projection came from in the outline. */
export interface PptxRef {
  /** 1-based slide position, the same number {@link PptxSlide.index} carries. */
  slide: number;
  /** Body-line index, or {@link PPTX_TITLE_LINE} / {@link PPTX_NOTES_LINE}. */
  line: number;
}

/**
 * Plain-text projection of a deck, plus the map back into the outline.
 *
 * A slide's title, its lines and its notes are each their own chunk, so a
 * citation resolves to the exact line the renderer draws rather than to "slide
 * 4". The blank line between slides is written before whichever chunk turns out
 * to be the next slide's first — a slide with no text at all contributes
 * nothing, instead of a run of empty lines that would shift every offset after
 * it.
 */
export function slidesToTextWithMap(slides: PptxSlide[]): TextIndex<PptxRef> {
  const builder = createTextIndexBuilder<PptxRef>({ separator: PPTX_LINE_SEPARATOR });
  slides.forEach((slide, index) => {
    let separator = index === 0 ? undefined : PPTX_SLIDE_SEPARATOR;
    const push = (chunk: string | undefined, line: number) => {
      if (!chunk) return;
      builder.push(chunk, { slide: slide.index, line }, separator);
      separator = undefined;
    };

    push(slide.title, PPTX_TITLE_LINE);
    slide.lines.forEach((line, lineIndex) => {
      push(line.text, lineIndex);
    });
    push(slide.notes, PPTX_NOTES_LINE);
  });
  return builder.build();
}

/**
 * Plain-text projection of a deck — powers search, copy and the raw view. A thin
 * wrapper so the projection has exactly one definition: it is the index's own
 * text, never a second assembly that could drift from it.
 */
export function slidesToText(slides: PptxSlide[]): string {
  return slidesToTextWithMap(slides).text;
}
