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

  // issue 545: a real, keyboard-reachable `<button>` — a plain `<div>` with
  // only `onMouseEnter`/`onMouseLeave` left focusOnHover's spotlight/dim
  // unreachable without a pointer. `onFocus`/`onBlur` set/clear the SAME
  // `hoveredIndex` a mouse hover already does, so Tab reaches the identical
  // highlighted state (never a div-as-button, conventions.md "Accessibility").
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
