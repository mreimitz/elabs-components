/**
 * Markdown outline extraction (#L6) — the pure half of `DocumentOutline`.
 *
 * `parseMarkdownOutline` walks ATX headings (`#` … `######`) outside fenced
 * code blocks and returns the document outline. Line numbers are 1-based and
 * relative to the frontmatter-STRIPPED body — the same coordinate space as the
 * `data-sourcepos` attributes `MarkdownPreview` stamps on rendered blocks, so
 * outline → block lookup is a direct equality on the start line.
 */
import { parseFrontmatter } from "../lib/markdown/frontmatter";
import { plainText, slugifyHeading, uniqueSlug } from "../lib/markdown/slugify";

export interface MarkdownOutlineItem {
  /** Stable slug (GitHub-style, deduped with `-n` suffixes). */
  id: string;
  /** Plain heading text (inline markdown stripped). */
  text: string;
  /** Heading level 1–6. */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** 1-based line in the frontmatter-stripped source (matches `data-sourcepos`). */
  line: number;
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^(```|~~~)/;

export function parseMarkdownOutline(markdown: string): MarkdownOutlineItem[] {
  let body = markdown;
  try {
    body = parseFrontmatter(markdown).content;
  } catch {
    // Transient-invalid frontmatter while typing — outline the raw source.
  }
  const lines = body.split("\n");
  const items: MarkdownOutlineItem[] = [];
  const used = new Map<string, number>();
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE_RE.test(line.trimStart())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = HEADING_RE.exec(line);
    if (!match) continue;
    const text = plainText(match[2] ?? "");
    if (!text) continue;
    const base = slugifyHeading(text);
    const id = uniqueSlug(base, used);
    items.push({
      id,
      text,
      level: match[1]!.length as MarkdownOutlineItem["level"],
      line: i + 1,
    });
  }
  return items;
}
