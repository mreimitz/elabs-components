"use client";

/**
 * ChartLoadingPlot — the `status="loading"` body of a chart family whose engine
 * has no loading phase of its own (Scatter, Candlestick, LiveLine, Waterfall;
 * RM-182). Internal.
 *
 * The plot box is sized exactly as the ready chart's (the same `plotBox`), so
 * nothing shifts when the data arrives. It holds one polite status region and
 * a skeleton filling the box: the markup `AutoChart` already shows while it is
 * `loading`, with the same localised text.
 *
 * A family whose READY plot box is unset (no `plotHeight`, no `defaultPlotHeight`
 * fallback — it just fills whatever height its parent gives it) omits `plotBox`
 * here too and sets `fillsFrame`, so the loading box is sized the SAME way as
 * the ready one (RM-185): a fallback `defaultPlotHeight` would give the loading
 * box an aspect-ratio height the ready box never had, so the two would differ
 * inside a `ChartFrame` or an unsized parent (`distribution-chart.test.tsx`).
 */

import { type CSSProperties, forwardRef } from "react";

import { cn, Skeleton } from "@elabs-ai/components-ui";

import { type ChartPlotBoxInput, ChartPlotRoot } from "./chart-breakpoint";
import { useChartTranslate } from "./chart-messages";

export interface ChartLoadingPlotProps {
  /** The ready chart's own plot box, so the loading box has the same size. Omit together with `fillsFrame` when the ready box has none of its own. */
  plotBox?: ChartPlotBoxInput;
  /** Forwarded to `ChartPlotRoot` — matches the ready root when `plotBox` is omitted (RM-185). */
  fillsFrame?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const ChartLoadingPlot = forwardRef<HTMLDivElement, ChartLoadingPlotProps>(
  function ChartLoadingPlot({ plotBox, fillsFrame, className, style }, ref) {
    const t = useChartTranslate();
    return (
      <ChartPlotRoot
        aria-live="polite"
        className={cn("relative w-full", className)}
        data-status="loading"
        fillsFrame={fillsFrame}
        plotBox={plotBox}
        ref={ref}
        role="status"
        style={style}
      >
        <span className="sr-only">{t("charts.chart.loading")}</span>
        <Skeleton className="size-full" />
      </ChartPlotRoot>
    );
  },
);
