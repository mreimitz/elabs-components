/**
 * `markdown-academic` — the opt-in academic layer for `MarkdownPreview`:
 * footnotes, citations + bibliography, math (KaTeX), and a generated TOC. Each
 * piece is enabled by a prop on `MarkdownPreview` (`footnotes` / `resolveCitation`
 * / `math` / `toc`); the standalone components + types below are exported for
 * direct composition and consumer typing.
 *
 * The remark transforms + tag constants are wired internally by `MarkdownPreview`
 * and are intentionally NOT part of the public surface (drive them with the props).
 */

// Citations + bibliography.
export {
  Bibliography,
  collectCitations,
  type BibliographyProps,
  type CitationData,
  type CitationStyle,
  type CiteItem,
  type CollectedCitations,
  type ResolveCitation,
  type ResolvedCitation,
} from "./citations";

// Math (KaTeX) — standalone renderers for direct use.
export { MathBlock, MathInline, type MathProps } from "./math";

// Footnotes — the branded definition section (standalone).
export { FootnoteList, type FootnoteListProps } from "./footnotes";

// Table of contents.
export { TableOfContents, type TableOfContentsProps } from "./toc";
