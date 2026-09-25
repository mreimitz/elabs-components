"use client";

import type { ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useLegend, useLegendItem } from "./legend-context";

export interface LegendItemProps {
  /** Container class name */
  className?: string;
  /** Children components (LegendMarker, LegendLabel, LegendValue, LegendProgress) */
  children: ReactNode;
}

export function LegendItem({ className = "", children }: LegendItemProps) {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered } = useLegendItem();

  // #545: a plain `<div>` with only `onMouseEnter`/`onMouseLeave` is a
  // mouse/touch-only hover highlight — not reachable by Tab at all. A real
  // `<button>` (never a div-with-onClick, see conventions.md "Real elements")
  // with matching `onFocus`/`onBlur` makes Tab reach it and drive the exact
  // same `hoveredIndex` a mouse hover does — same pattern `chart-legend.tsx`
  // already uses for its own hover-only legend rows (#607).
  return (
    <button
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 text-start transition-[background-color,opacity] duration-fast ease-entrance focus-ring motion-reduce:transition-none",
        isHovered && "bg-legend-muted",
        className,
      )}
      data-hovered={isHovered ? "" : undefined}
      onBlur={() => setHoveredIndex(null)}
      onFocus={() => setHoveredIndex(index)}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
      type="button"
    >
      {children}
    </button>
  );
}

LegendItem.displayName = "LegendItem";
