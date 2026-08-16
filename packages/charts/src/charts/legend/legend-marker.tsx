"use client";

import { useId, useRef } from "react";
import { cn } from "@elabs-ai/components-ui";
import { makeSeriesPattern, seriesDashArray, seriesPatternId } from "../series-pattern";
import { useHighDecorationOf } from "../use-high-decoration";
import { useLegendItem } from "./legend-context";

export interface LegendMarkerProps {
  /** Marker size class. Default: "h-2.5 w-2.5" */
  className?: string;
}

export function LegendMarker({ className = "h-2.5 w-2.5" }: LegendMarkerProps) {
  const { item } = useLegendItem();
  const ref = useRef<HTMLDivElement>(null);
  const high = useHighDecorationOf(ref);
  const patternId = seriesPatternId(item.seriesIndex ?? 0, useId().replace(/:/g, ""));
  const size = 10;

  // Under high decoration with a seriesIndex, render a decoration pattern swatch
  if (high && item.seriesIndex !== undefined) {
    const dash = seriesDashArray(item.seriesIndex);
    return (
      <div ref={ref} className="shrink-0">
        <svg aria-hidden="true" width={size} height={size} overflow="visible">
          <defs>{makeSeriesPattern(item.seriesIndex, patternId, item.color)}</defs>
          <rect width={size} height={size} fill={`url(#${patternId})`} />
          {dash && (
            <line
              x1={0}
              y1={size / 2}
              x2={size}
              y2={size / 2}
              stroke={item.color}
              strokeWidth={1.5}
              strokeDasharray={dash}
            />
          )}
        </svg>
      </div>
    );
  }

  // Note: backgroundColor must remain inline style as item.color is dynamic data
  return (
    <div
      ref={ref}
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: item.color }}
    />
  );
}

LegendMarker.displayName = "LegendMarker";
