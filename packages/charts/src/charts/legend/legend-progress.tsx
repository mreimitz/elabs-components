"use client";

import { cn } from "@elabs/components-ui";
import { useLegendItem } from "./legend-context";

export interface LegendProgressProps {
  /** Track class name */
  trackClassName?: string;
  /** Indicator class name */
  indicatorClassName?: string;
  /** Track height. Default: "h-1.5" */
  height?: string;
}

export function LegendProgress({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: LegendProgressProps) {
  const { item } = useLegendItem();

  if (!item.maxValue) {
    return null;
  }

  const pct = Math.max(0, Math.min(100, (item.value / item.maxValue) * 100));

  // A plain tokenized bar (dropped @base-ui Progress): @elabs/components-ui Progress hardcodes the
  // indicator color, but the legend bar must take the per-series `item.color` (dynamic data
  // → inline style; the caller passes a token var). Track uses the --legend-track token.
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={item.maxValue}
      aria-valuenow={item.value}
      className={cn("w-full overflow-hidden rounded-full bg-legend-track", height, trackClassName)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-slow motion-reduce:transition-none",
          indicatorClassName,
        )}
        style={{ width: `${pct}%`, backgroundColor: item.color }}
      />
    </div>
  );
}

LegendProgress.displayName = "LegendProgress";
