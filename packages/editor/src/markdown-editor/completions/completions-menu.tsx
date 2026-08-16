"use client";

/**
 * CompletionMenu — the token-styled listbox the WYSIWYG completions widget
 * renders at the caret (`completions-widget.tsx`). Deliberately simpler than
 * `../slash/slash-menu.tsx`'s `SlashMenu`: `EditorCompletionItem` carries only
 * `label`/`detail`/`insertText` (no groups/icons), so there is nothing to group.
 * Same visual grammar (bg-popover, accent selection) for consistency with the
 * slash popup and Monaco's own themed suggest widget.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { forwardRef, type HTMLAttributes } from "react";

import type { EditorCompletionItem } from "../../lib/editor-completions";

export interface CompletionMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** The candidates to show (already resolved by the provider(s)). */
  items: EditorCompletionItem[];
  /** Index of the highlighted candidate. */
  activeIndex: number;
  /** Called when a candidate is chosen (click or the plugin's Enter/Tab). */
  onSelect: (index: number) => void;
  /** DOM id prefix so each option id is stable + unique. */
  idPrefix?: string;
  /** Shown while no candidates have resolved yet (or none matched). */
  emptyLabel?: string;
}

/** Build the stable DOM id for an option element. */
export function completionOptionId(idPrefix: string, index: number): string {
  return `${idPrefix}-${index}`;
}

export const CompletionMenu = forwardRef<HTMLDivElement, CompletionMenuProps>(
  function CompletionMenu(
    {
      items,
      activeIndex,
      onSelect,
      idPrefix = "brand-completions",
      emptyLabel = "No suggestions",
      className,
      ...props
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="listbox"
        aria-label="Suggestions"
        className={cn(
          "max-h-[min(280px,50vh)] w-64 overflow-y-auto overflow-x-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-ring-md",
          className,
        )}
        {...props}
      >
        {items.length === 0 ? (
          <div className="px-2 py-3 text-center text-caption text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          items.map((item, index) => {
            const selected = index === activeIndex;
            return (
              <div
                key={`${item.label}-${String(index)}`}
                id={completionOptionId(idPrefix, index)}
                role="option"
                aria-selected={selected}
                data-selected={selected ? "true" : undefined}
                // The editor keeps focus — select on mousedown (before the editor
                // would steal focus back), mirroring `slash-menu.tsx`.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(index);
                }}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-body outline-none transition-colors duration-fast",
                  "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-meta text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    );
  },
);
