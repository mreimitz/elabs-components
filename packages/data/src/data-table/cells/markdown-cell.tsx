"use client";

import { Fragment, forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * Safe inline markdown for a table cell: `**bold**`, `*italic*` / `_italic_`,
 * `` `code` ``, `[link](url)`, `^sup^` / `<sup>sup</sup>`, and — only with
 * `images: true` — `![alt](src)`. Built as React elements, never HTML: there is
 * no `innerHTML` sink, and a link or image URL that is not `http(s):`,
 * `mailto:`, a path or a fragment renders as plain text.
 */
const TOKEN =
  /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\^([^^]+)\^|<sup>(.*?)<\/sup>/g;

/** `true` for a URL a cell may link to or load. */
export function isSafeCellUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#|\.{1,2}\/)/i.test(url.trim());
}

/** Parses `text` into React nodes. Exported for tests. */
export function parseCellMarkdown(text: string, images = false, keyPrefix = "md"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyPrefix}-${n++}`;
    const [, bold, em1, em2, code, alt, src, linkText, href, sup1, sup2] = m;
    if (bold !== undefined)
      out.push(<strong key={key}>{parseCellMarkdown(bold, images, key)}</strong>);
    else if ((em1 ?? em2) !== undefined)
      out.push(<em key={key}>{parseCellMarkdown((em1 ?? em2) as string, images, key)}</em>);
    else if (code !== undefined)
      out.push(
        <code key={key} className="rounded-sm bg-muted px-1 font-mono text-code">
          {code}
        </code>,
      );
    else if (src !== undefined)
      out.push(
        images && isSafeCellUrl(src) ? (
          // media-reuse-exempt: 16px inline glyph in a sanitised parser hot path; a skeleton or fallback is wrong at glyph scale
          <img
            key={key}
            src={src}
            alt={alt ?? ""}
            className="inline-block h-4 w-auto align-text-bottom"
          />
        ) : (
          <Fragment key={key}>{alt}</Fragment>
        ),
      );
    else if (href !== undefined && linkText !== undefined)
      out.push(
        isSafeCellUrl(href) ? (
          <a
            key={key}
            href={href}
            className="rounded-sm text-link underline underline-offset-2 hover:text-foreground focus-ring"
          >
            {parseCellMarkdown(linkText, images, key)}
          </a>
        ) : (
          <Fragment key={key}>{parseCellMarkdown(linkText, images, key)}</Fragment>
        ),
      );
    else out.push(<sup key={key}>{(sup1 ?? sup2) as string}</sup>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface MarkdownCellProps extends HTMLAttributes<HTMLSpanElement> {
  text: string;
  /** Render `![alt](src)` as an image. Default `false` (the alt text prints). */
  images?: boolean;
}

/** A cell rendered from safe inline markdown (see {@link parseCellMarkdown}). */
export const MarkdownCell = forwardRef<HTMLSpanElement, MarkdownCellProps>(function MarkdownCell(
  { text, images = false, className, ...props },
  ref,
) {
  return (
    <span ref={ref} data-slot="markdown-cell" className={cn("break-words", className)} {...props}>
      {parseCellMarkdown(text, images)}
    </span>
  );
});
