"use client";

/**
 * Generated table of contents — an in-flow `::toc` block.
 *
 * Reuses `parseMarkdownOutline` (the same heading extractor `DocumentOutline`
 * uses — no second parser) for slugs + levels, and renders a quiet nav list of
 * same-page anchor links. `MarkdownPreview` provides the outline through
 * `TocProvider`; it also stamps the matching `id` on each rendered heading
 * (`useHeadingId`) so the links resolve.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { createContext, forwardRef, useContext, type HTMLAttributes } from "react";

import type { MarkdownOutlineItem } from "../markdown-outline";

// Per-depth indent on the standard spacing scale (statically scannable so Tailwind
// keeps the classes). Index = heading depth relative to the shallowest in view.
const INDENT = ["ps-0", "ps-3", "ps-6", "ps-9", "ps-12", "ps-12"] as const;

interface TocState {
  items: MarkdownOutlineItem[];
  /** Heading slug keyed by 1-based start line (frontmatter-stripped coords). */
  idByLine: Map<number, string>;
}

const TocContext = createContext<TocState | null>(null);

export interface TocProviderProps {
  items: MarkdownOutlineItem[];
  children: React.ReactNode;
}

export function TocProvider({ items, children }: TocProviderProps) {
  const idByLine = new Map<number, string>();
  for (const it of items) idByLine.set(it.line, it.id);
  return <TocContext.Provider value={{ items, idByLine }}>{children}</TocContext.Provider>;
}

/** The heading `id` for a 1-based source line, or `undefined`. */
export function useHeadingId(line: number | undefined): string | undefined {
  const ctx = useContext(TocContext);
  if (line == null || !ctx) return undefined;
  return ctx.idByLine.get(line);
}

export interface TableOfContentsProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Heading outline; defaults to the outline collected by `MarkdownPreview`. */
  items?: MarkdownOutlineItem[];
  /** Section heading label. Default `"Contents"`. */
  title?: string;
  /** Deepest heading level to include (1–6). Default 3. */
  maxLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Quiet generated TOC. Standalone with an explicit `items` array, or fed from the
 * preview context inside a `::toc` block. Indentation tracks heading depth; no
 * fill or border — the indent + links are the only gestures.
 */
export const TableOfContents = forwardRef<HTMLElement, TableOfContentsProps>(
  function TableOfContents({ items, title = "Contents", maxLevel = 3, className, ...props }, ref) {
    const ctx = useContext(TocContext);
    const source = items ?? ctx?.items ?? [];
    const list = source.filter((it) => it.level <= maxLevel);
    if (list.length === 0) return null;

    const minLevel = Math.min(...list.map((it) => it.level));

    return (
      <nav ref={ref} aria-label={title} className={cn("my-4 text-meta", className)} {...props}>
        <p className="mb-2 font-medium text-muted-foreground">{title}</p>
        <ol className="space-y-1">
          {list.map((it) => (
            <li key={it.id} className={INDENT[Math.min(it.level - minLevel, INDENT.length - 1)]}>
              <a
                href={`#${it.id}`}
                className="text-muted-foreground underline hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    );
  },
);
