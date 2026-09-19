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

import { forwardRef, type HTMLAttributes, type ReactNode, useEffect, useId, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useChartStable } from "../charts/chart-context";
import { type ChartFrameSeriesEntry, useOptionalChartFrame } from "./chart-frame-context";

/**
 * Publishes the enclosing chart's series colours to its frame (RM-117), so an
 * `InlineChip` in the frame's description paints the same ink. Called by the
 * axes — every cartesian chart renders one. No-op outside a frame.
 *
 * It lives here, not in `chart-frame-context.tsx`, because it reads the chart
 * context: the frame context stays free of the chart engine's import graph,
 * which `@elabs-ai/components-charts/test` re-exports.
 */
export function useChartFrameSeriesBridge(): void {
  const frame = useOptionalChartFrame();
  const { lines, legendItems } = useChartStable();
  const id = useId();
  const register = frame?.actions.registerSeries;
  const entries = useMemo<ChartFrameSeriesEntry[]>(
    () => [
      ...lines.map((l) => ({ key: l.dataKey, color: l.stroke })),
      ...(legendItems ?? []).map((e) => ({
        key: e.key,
        color: e.color,
        label: e.label,
      })),
    ],
    [lines, legendItems],
  );
  useEffect(() => {
    if (!register) return undefined;
    return register(id, entries);
  }, [register, id, entries]);
}

export interface InlineChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The series key (`dataKey`) whose colour the chip takes. */
  series: string;
  /**
   * The series' display name, the chip's accessible name. Wins over the name
   * the chart publishes; without either the chip is named by `series`.
   */
  label?: string;
  /** The words the chip introduces — usually the series' name in prose. */
  children?: ReactNode;
}

export const InlineChip = forwardRef<HTMLSpanElement, InlineChipProps>(function InlineChip(
  { series, label, className, children, ...props },
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
        aria-label={label ?? entry?.label ?? series}
        className="inline-block size-2.5 shrink-0 self-center rounded-xs"
        style={{ backgroundColor: entry?.color ?? "currentColor" }}
      />
      {children}
    </span>
  );
});

InlineChip.displayName = "InlineChip";
