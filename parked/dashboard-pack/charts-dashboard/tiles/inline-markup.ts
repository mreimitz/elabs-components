/**
 * inline-markup.ts — a minimal, safe inline-markup parser for the `text` tile kind
 * (RM-075, analysis §9 risk 9). `charts` cannot import `ai`'s markdown renderer
 * (dashboard-reuse), so a `text` tile body gets a small, purpose-built subset:
 * `**bold**`, `_italic_`, `[label](https://…)` (https only, `rel="noopener"`),
 * line breaks and `- ` bullets.
 *
 * Renders straight to React elements — never a raw HTML string, never
 * `dangerouslySetInnerHTML` — so any markup the author types (`<script>…`, a
 * `javascript:` link) is always a literal text node, never parsed as HTML or
 * turned into a live link.
 */
import { Fragment, createElement, type ReactNode } from "react";

const INLINE_RE = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

/** Parse one line's inline markup into React nodes; unmatched runs stay plain text. */
export function parseInlineMarkup(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null = INLINE_RE.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, bold, italic, linkLabel, linkHref] = match;
    if (bold !== undefined) {
      nodes.push(createElement("strong", { key: key++ }, bold));
    } else if (italic !== undefined) {
      nodes.push(createElement("em", { key: key++ }, italic));
    } else if (linkLabel !== undefined && linkHref !== undefined) {
      nodes.push(
        createElement(
          "a",
          {
            key: key++,
            href: linkHref,
            rel: "noopener",
            target: "_blank",
            className: "text-primary-text underline underline-offset-2",
          },
          linkLabel,
        ),
      );
    }
    lastIndex = INLINE_RE.lastIndex;
    match = INLINE_RE.exec(text);
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** One block of a body: a paragraph line, or a run of consecutive `- ` bullet lines. */
export type MarkupBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] };

/** Split a `text` tile body into paragraph/bullet blocks, one per non-blank line. */
export function parseMarkupBlocks(body: string): MarkupBlock[] {
  const lines = body.split(/\r?\n/);
  const blocks: MarkupBlock[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    if (line.startsWith("- ")) {
      const item = line.slice(2);
      const last = blocks[blocks.length - 1];
      if (last && last.type === "bullets") last.items.push(item);
      else blocks.push({ type: "bullets", items: [item] });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  return blocks;
}

/** Render a `text` tile body: paragraphs + `- ` bullets, each with inline markup applied. */
export function renderInlineMarkup(body: string): ReactNode {
  const blocks = parseMarkupBlocks(body);
  return createElement(
    Fragment,
    null,
    blocks.map((block, i) =>
      block.type === "bullets"
        ? createElement(
            "ul",
            { key: i, className: "list-disc ps-5" },
            block.items.map((item, j) => createElement("li", { key: j }, parseInlineMarkup(item))),
          )
        : createElement("p", { key: i }, parseInlineMarkup(block.text)),
    ),
  );
}
