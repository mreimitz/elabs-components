"use client";

/**
 * DocumentOutline (#L6) — the quiet table-of-contents rail for a markdown
 * document. Pure presentation: pass `items` from `parseMarkdownOutline` /
 * `useMarkdownOutline`, drive `activeId` from your scroll observer, and handle
 * `onSelect` (e.g. scroll the matching `data-sourcepos` block into view).
 */
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { forwardRef, useMemo, type HTMLAttributes, type ReactNode } from "react";

import { parseMarkdownOutline, type MarkdownOutlineItem } from "./markdown-outline";

/** Memoized outline of a markdown source. */
export function useMarkdownOutline(markdown: string): MarkdownOutlineItem[] {
  return useMemo(() => parseMarkdownOutline(markdown), [markdown]);
}

export interface DocumentOutlineProps extends Omit<HTMLAttributes<HTMLElement>, "onSelect"> {
  items: MarkdownOutlineItem[];
  /** The outline item currently in view. */
  activeId?: string;
  onSelect?: (item: MarkdownOutlineItem) => void;
  /**
   * Per-entry hover affordances (pin/copy-link…), rendered at the row end.
   * Revealed on row hover/focus; stays visible while it contains a pressed
   * toggle (`aria-pressed="true"`).
   */
  itemActions?: (item: MarkdownOutlineItem) => ReactNode;
}

export const DocumentOutline = forwardRef<HTMLElement, DocumentOutlineProps>(
  function DocumentOutline({ items, activeId, onSelect, itemActions, className, ...props }, ref) {
    const minLevel = items.reduce<number>((min, it) => Math.min(min, it.level), 6);
    return (
      <nav
        ref={ref}
        aria-label="Document outline"
        className={cn("text-body", className)}
        {...props}
      >
        {/* TOC grammar: a structural hairline rail; each entry overlays it with a
            2px segment — primary for the active heading, visible on hover — so
            position-in-document reads at a glance (the accent-rail channel from
            the separation grammar, not a generic list). */}
        <ul className="m-0 list-none border-s border-border p-0">
          {items.map((item) => {
            const actions = itemActions?.(item);
            return (
              <li key={item.id} className={cn(actions && "group/outline-item relative")}>
                <button
                  type="button"
                  aria-current={item.id === activeId ? "true" : undefined}
                  onClick={() => onSelect?.(item)}
                  className={cn(
                    "-ms-px block w-full truncate border-s-2 py-1 pe-2 text-start text-caption",
                    "transition-colors duration-fast ease-standard motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    item.id === activeId
                      ? "border-s-primary font-medium text-foreground"
                      : "border-s-transparent text-muted-foreground hover:border-s-border-strong hover:text-foreground",
                    actions && "pe-8",
                  )}
                  style={{ paddingInlineStart: `${(item.level - minLevel) * 0.875 + 0.75}rem` }}
                >
                  {item.text}
                </button>
                {actions ? (
                  <span className="absolute end-0.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-fast ease-standard focus-within:opacity-100 group-hover/outline-item:opacity-100 has-[[aria-pressed=true]]:opacity-100 motion-reduce:transition-none">
                    {actions}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {items.length === 0 ? (
          <p className="px-2 py-1 text-caption text-muted-foreground">No headings yet.</p>
        ) : null}
      </nav>
    );
  },
);
