"use client";

import type { Transition } from "motion/react";
import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { chartCssVars, useChart } from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import { transitionWithDelay } from "./motion-utils";
import { computeSeriesBarWidth } from "./series-bar-layout";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useHighDecoration } from "./use-high-decoration";
import { useResolvedRadius } from "./use-resolved-radius";
import { isLoadingChromePhase } from "./y-domain-utils";

function computeSeriesBarLayout(input: {
  stacked: boolean;
  composedStackOffsets: Map<number, Map<string, number>> | undefined;
  rowIndex: number;
  dataKey: string;
  value: number;
  yScale: (n: number) => number | undefined;
  innerHeight: number;
  xCenter: number;
  barWidth: number;
  seriesCount: number;
  gap: number;
  seriesIndex: number;
  stackGap: number;
  isLastSeries: boolean;
  radius: number;
}): {
  barLeft: number;
  barHeight: number;
  effectiveRadius: number;
  valueY: number;
} {
  const {
    stacked,
    composedStackOffsets,
    rowIndex,
    dataKey,
    value,
    yScale,
    innerHeight,
    xCenter,
    barWidth,
    seriesCount,
    gap,
    seriesIndex,
    stackGap,
    isLastSeries,
    radius,
  } = input;

  if (stacked && composedStackOffsets) {
    const offset = composedStackOffsets.get(rowIndex)?.get(dataKey) ?? 0;
    const valuePos = yScale(value) ?? 0;
    let barHeight = innerHeight - valuePos;
    const offsetY = yScale(offset) ?? innerHeight;
    const gapOffset = seriesIndex * stackGap;
    const valueY = offsetY - barHeight - gapOffset;
    if (!isLastSeries && stackGap > 0) {
      barHeight = Math.max(0, barHeight - stackGap);
    }
    const barLeft = xCenter - barWidth / 2;
    const applyRounding = stackGap > 0 || isLastSeries;
    return {
      barLeft,
      barHeight,
      effectiveRadius: applyRounding ? radius : 0,
      valueY,
    };
  }

  const groupWidth = seriesCount * barWidth + (seriesCount > 1 ? (seriesCount - 1) * gap : 0);
  const valueY = yScale(value) ?? innerHeight;
  return {
    barLeft: xCenter - groupWidth / 2 + seriesIndex * (barWidth + gap),
    barHeight: innerHeight - valueY,
    effectiveRadius: radius,
    valueY,
  };
}

export interface SeriesBarProps {
  /** Key in data for bar height (y value) */
  dataKey: string;
  /** Fill color. Default: var(--chart-line-primary) */
  fill?: string;
  /** Tooltip dot color when fill is gradient/pattern. Default: fill */
  stroke?: string;
  /**
   * Corner radius for bar top corners. `"theme"` (default) follows the active
   * theme's `--radius` token (squares in blueprint/high-decoration, scales with
   * rounder themes); a number is an explicit px override. #165
   */
  radius?: number | "theme";
  /** Animate grow from baseline. Default: true */
  animate?: boolean;
  /** Opacity for non-hovered bars when another point is hovered (matches BarChart). Default: 0.3 */
  fadedOpacity?: number;
}

export function SeriesBar({
  dataKey,
  fill = chartCssVars.linePrimary,
  radius = "theme",
  animate = true,
  fadedOpacity = 0.3,
}: SeriesBarProps) {
  const themeRadius = useResolvedRadius();
  const {
    data,
    xScale,
    yScale,
    xAccessor,
    innerHeight,
    innerWidth,
    columnWidth,
    isLoaded,
    animationDuration,
    enterTransition,
    revealEpoch = 0,
    barScale,
    composedBarDataKeys,
    composedBarSize,
    composedMaxBarSize,
    composedBarGap,
    composedStacked,
    composedStackOffsets,
    composedStackGap,
    tooltipData,
    chartPhase,
  } = useChart();

  // While the chart shows loading chrome, rows are fabricated placeholder data
  // (generateChartSkeletonData) — paint bars with a neutral skeleton fill +
  // pulse instead of the real series color (mirrors Line/Area's de-emphasis).
  const isLoadingPhase = isLoadingChromePhase(chartPhase);
  const loadingPulseClassName = isLoadingPhase
    ? "animate-pulse motion-reduce:animate-none"
    : undefined;

  const barKeys = useMemo(() => {
    if (composedBarDataKeys && composedBarDataKeys.length > 0) {
      return composedBarDataKeys;
    }
    return [dataKey];
  }, [composedBarDataKeys, dataKey]);

  const seriesIndex = useMemo(() => {
    const idx = barKeys.indexOf(dataKey);
    return idx >= 0 ? idx : 0;
  }, [barKeys, dataKey]);

  // Blueprint pattern fill: active only under high decoration AND for palette fills
  const high = useHighDecoration();
  const patternRawScope = useId().replace(/:/g, "");
  const usePattern = high && isPaletteFill(fill);
  const patternId = seriesPatternId(seriesIndex, patternRawScope);
  // Loading chrome overrides the series fill with a neutral skeleton token —
  // the real fill (and pattern) is restored automatically on the loading→ready
  // handoff, since `isLoadingPhase` flips false and this expression re-resolves.
  const resolvedFill = isLoadingPhase ? "var(--muted)" : usePattern ? `url(#${patternId})` : fill;

  const n = barKeys.length;
  const gap = composedBarGap ?? 4;
  const stackGap = composedStackGap ?? 0;

  const stacked =
    Boolean(composedStacked) &&
    composedStackOffsets != null &&
    composedBarDataKeys != null &&
    composedBarDataKeys.length > 0;

  const isLastSeries = seriesIndex === n - 1;

  const barWidth = useMemo(
    () =>
      computeSeriesBarWidth({
        innerWidth,
        dataLength: data.length,
        columnWidth,
        seriesCount: n,
        composedBarSize,
        composedMaxBarSize,
        composedBarGap: gap,
        stacked,
      }),
    [columnWidth, composedBarSize, composedMaxBarSize, data.length, gap, innerWidth, n, stacked],
  );

  // Resolve "theme" to the active --radius (px), clamped so thin bars don't lozenge. #165
  const resolvedRadius = radius === "theme" ? Math.min(barWidth / 2, themeRadius) : radius;

  const totalAnimDuration = animationDuration || 1100;
  const staggerSpread = totalAnimDuration * 0.4;
  const calculatedStaggerDelay = data.length > 1 ? staggerSpread / 1000 / data.length : 0;
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;
  const hoveredIndex = tooltipData?.index ?? null;

  if (barScale) {
    console.warn(
      "SeriesBar is for time-based ComposedChart / LineChart context. Use Bar inside BarChart for categorical x.",
    );
    return null;
  }

  return (
    <g className="series-bar">
      {usePattern && <defs>{makeSeriesPattern(seriesIndex, patternId, fill)}</defs>}
      {data.map((d, i) => {
        const value = d[dataKey];
        if (typeof value !== "number") {
          return null;
        }

        const xCenter = xScale(xAccessor(d)) ?? 0;

        const { barLeft, valueY, barHeight, effectiveRadius } = computeSeriesBarLayout({
          stacked,
          composedStackOffsets,
          rowIndex: i,
          dataKey,
          value,
          yScale,
          innerHeight,
          xCenter,
          barWidth,
          seriesCount: n,
          gap,
          seriesIndex,
          stackGap,
          isLastSeries,
          radius: resolvedRadius,
        });

        const categoryLabel = String(xAccessor(d).getTime());
        const isFaded = (hoveredIndex !== null && hoveredIndex !== i) || isLegendDimmed;

        if (animate && !isLoaded) {
          return (
            <SeriesBarRect
              barHeight={barHeight}
              barWidth={barWidth}
              calculatedStaggerDelay={calculatedStaggerDelay}
              className={loadingPulseClassName}
              enterTransition={enterTransition}
              fadedOpacity={fadedOpacity}
              fill={resolvedFill}
              index={i}
              innerHeight={innerHeight}
              isFaded={isFaded}
              key={`${dataKey}-${categoryLabel}-${revealEpoch}`}
              radius={effectiveRadius}
              revealEpoch={revealEpoch}
              x={barLeft}
              y={valueY}
            />
          );
        }

        return (
          <motion.rect
            animate={{ opacity: isFaded ? fadedOpacity : 1 }}
            className={loadingPulseClassName}
            fill={resolvedFill}
            height={barHeight}
            key={`${dataKey}-${categoryLabel}`}
            rx={effectiveRadius}
            ry={effectiveRadius}
            transition={{ opacity: { duration: 0.12 } }}
            width={barWidth}
            x={barLeft}
            y={valueY}
          />
        );
      })}
    </g>
  );
}

SeriesBar.displayName = "SeriesBar";

interface SeriesBarRectProps {
  x: number;
  y: number;
  barWidth: number;
  barHeight: number;
  fill: string;
  radius: number;
  index: number;
  innerHeight: number;
  calculatedStaggerDelay: number;
  enterTransition?: Transition;
  revealEpoch: number;
  isFaded: boolean;
  fadedOpacity: number;
  /** Loading-chrome pulse class, applied instead of a real fill while data is fabricated. */
  className?: string;
}

function SeriesBarRect({
  x,
  y,
  barWidth,
  barHeight,
  fill,
  radius,
  index,
  innerHeight,
  calculatedStaggerDelay,
  enterTransition,
  revealEpoch,
  isFaded,
  fadedOpacity,
  className,
}: SeriesBarRectProps) {
  const enterAnim = transitionWithDelay(enterTransition, index * calculatedStaggerDelay);

  return (
    <motion.rect
      animate={{
        height: barHeight,
        y,
        opacity: isFaded ? fadedOpacity : 1,
      }}
      className={className}
      fill={fill}
      initial={{ height: 0, y: innerHeight, opacity: 1 }}
      key={`series-bar-${index}-${revealEpoch}`}
      rx={radius}
      ry={radius}
      transition={enterAnim}
      width={barWidth}
      x={x}
    />
  );
}

export default SeriesBar;
