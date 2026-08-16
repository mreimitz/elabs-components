/**
 * YAML frontmatter parse/serialize. Splits the leading `---` block off a markdown
 * document so the body can be rendered/edited and the metadata can drive a form.
 *
 * `parseFrontmatter` throws on malformed YAML — callers (the app) catch and map it
 * to a typed error for the metadata panel.
 */
import { dump, load } from "js-yaml";

export interface ParsedDocument {
  /** Parsed frontmatter object ({} when there is no frontmatter block). */
  frontmatter: Record<string, unknown>;
  /** Markdown body with the frontmatter block removed. */
  content: string;
  hasFrontmatter: boolean;
}

// Optional leading BOM (\uFEFF), then a `---` … `---` block at the very top.
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseFrontmatter(source: string): ParsedDocument {
  const match = source.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, content: source, hasFrontmatter: false };
  }

  const parsed = load(match[1] ?? "");
  const frontmatter =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  return {
    frontmatter,
    content: source.slice(match[0].length),
    hasFrontmatter: true,
  };
}

export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  const body = content.replace(/^\s+/, "");
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }
  const yaml = dump(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${yaml}\n---\n\n${body}`;
}
