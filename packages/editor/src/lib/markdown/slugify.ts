/**
 * Shared heading-slug helpers.
 *
 * The same slug algorithm is used by:
 *  - `parseMarkdownOutline` (static markdown → outline items, slug as `id`)
 *  - `MarkdownEditorHandle.scrollToHeading` (ProseMirror doc walk, WYSIWYG)
 *
 * Keeping both on a single helper guarantees the slugs agree so
 * `scrollToHeading(slug)` finds the right node when called with an id produced
 * by `parseMarkdownOutline`. (#273)
 */

/** Strip the inline-markdown syntax that commonly decorates headings. */
export function plainText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

/**
 * GitHub-style heading slug: lowercase, strip non-letter/number/space/hyphen,
 * collapse whitespace to hyphens. Falls back to `"section"` for empty text.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/**
 * Produce a unique slug for a heading, given a Map of already-used base slugs
 * (values are the count seen so far). Mutates `used`.
 *
 * The algorithm matches `parseMarkdownOutline`: first occurrence is the bare
 * slug; duplicates get a `-n` numeric suffix starting at 1.
 */
export function uniqueSlug(base: string, used: Map<string, number>): string {
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}
