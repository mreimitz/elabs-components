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
 */

import { type CSSProperties, forwardRef } from "react";

import { cn, Skeleton, useLocale } from "@elabs-ai/components-ui";

import { type ChartPlotBoxInput, ChartPlotRoot } from "./chart-breakpoint";

export interface ChartLoadingPlotProps {
  /** The ready chart's own plot box, so the loading box has the same size. */
  plotBox: ChartPlotBoxInput;
  className?: string;
  style?: CSSProperties;
}

export const ChartLoadingPlot = forwardRef<HTMLDivElement, ChartLoadingPlotProps>(
  function ChartLoadingPlot({ plotBox, className, style }, ref) {
    const { t } = useLocale();
    return (
      <ChartPlotRoot
        aria-live="polite"
        className={cn("relative w-full", className)}
        data-status="loading"
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
