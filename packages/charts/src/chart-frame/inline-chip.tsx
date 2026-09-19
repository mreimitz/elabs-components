"use client";

/**
 * InlineChip (RM-117) — a colour chip inside a frame's description that
 * replaces the legend: "<InlineChip series="ram">short-term RAM</InlineChip>
 * rose while …". The chip's ink is the series' own colour, read from the
 * chart inside the same `ChartFrame` (the chart publishes it on the frame
 * context), so the words and the line share one colour without restating it.
 *
 * Colour is never the only channel: the words beside the chip name the series,
 * and the chip itself carries the series name as its accessible name.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useOptionalChartFrame } from "./chart-frame-context";

export interface InlineChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The series key (`dataKey`) whose colour the chip takes. */
  series: string;
  /** The words the chip introduces — usually the series' name in prose. */
  children?: ReactNode;
}

export const InlineChip = forwardRef<HTMLSpanElement, InlineChipProps>(function InlineChip(
  { series, className, children, ...props },
  ref,
) {
  const frame = useOptionalChartFrame();
  const entry = frame?.meta.series[series];
  return (
    <span
      ref={ref}
      data-slot="inline-chip"
      data-series={series}
      className={cn(
        "inline-flex items-baseline gap-1 font-medium text-chart-foreground",
        className,
      )}
      {...props}
    >
      <span
        data-slot="inline-chip-swatch"
        role="img"
        aria-label={entry?.label ?? series}
        className="inline-block size-2.5 shrink-0 self-center rounded-xs"
        style={{ backgroundColor: entry?.color ?? "currentColor" }}
      />
      {children}
    </span>
  );
});

InlineChip.displayName = "InlineChip";
