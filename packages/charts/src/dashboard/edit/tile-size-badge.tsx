"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui";

import type { TileLayout } from "../core/spec";
import { useDashboardEdit } from "./edit-context";

export interface TileSizeBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The cells to show — the running gesture's target, else the tile's layout. */
  cell: Pick<TileLayout, "x" | "y" | "w" | "h">;
}

/**
 * `(col,row) ⤢ w × h` in cells at the tile's bottom-right while it is focused, moving or
 * resizing. `aria-hidden`: the edit layer's live region announces the same numbers.
 */
export const TileSizeBadge = forwardRef<HTMLSpanElement, TileSizeBadgeProps>(function TileSizeBadge(
  { cell, className, ...props },
  ref,
) {
  const edit = useDashboardEdit();
  if (!edit) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-slot="tile-size-badge"
      className={cn(
        "pointer-events-none absolute end-7 bottom-1 z-10 rounded-sm border border-ring bg-background px-1 text-meta whitespace-nowrap text-foreground tabular-nums",
        className,
      )}
      {...props}
    >
      {edit.messages.sizeBadge(cell)}
    </span>
  );
});
