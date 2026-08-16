"use client";

import type { scaleBand } from "@visx/scale";
import type { Transition } from "motion/react";
import { motion } from "motion/react";
import { memo, useId, useMemo } from "react";
import { chartCssVars, type Margin, useChart, useChartStable, useYScale } from "./chart-context";
import {
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { useChartLegendHover } from "./chart-legend-hover";
import { transitionWithDelay } from "./motion-utils";
import { useHighDecoration } from "./use-high-decoration";
import { useResolvedRadius } from "./use-resolved-radius";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { isLoadingChromePhase } from "./y-domain-utils";

type ScaleBand<Domain extends { toString(): string }> = ReturnType<typeof scaleBand<Domain>>;

/** Stable empty array so a non-interactive BarChart never re-registers targets. */
const EMPTY_BAR_TARGETS: ChartDatapointTarget[] = [];

interface BarGeometry {
  index: number;
  value: number;
  categoryValue: string;
  datum: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A bar's drill-down target (#349). The rect is the bar's own box shifted into
 * container coordinates (the bars live inside a `translate(margin)` group) and
 * padded up to the WCAG 2.5.8 minimum, so a 4px-tall bar is still clickable.
 */
function barTarget(
  bar: BarGeometry,
  dataKey: string,
  seriesIndex: number,
  margin: Margin,
): ChartDatapointTarget {
  return {
    id: `${dataKey}:${bar.index}`,
    index: bar.index,
    seriesIndex,
    seriesKey: dataKey,
    seriesLabel: dataKey,
    datum: bar.datum,
    value: bar.value,
    category: bar.categoryValue,
    rect: padDatapointRect({
      x: bar.x + margin.left,
      y: bar.y + margin.top,
      width: bar.width,
      height: bar.height,
    }),
  };
}

export type BarLineCap = "round" | "butt" | number;
export type BarAnimationType = "grow" | "fade";

export interface BarProps {
  /** Key in data to use for y values */
  dataKey: string;
  /** Y-scale group id for vertical bars (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Fill color for the bar. Can be a color, gradient url, or pattern url. Default: var(--chart-line-primary) */
  fill?: string;
  /** Color for tooltip dot. Use when fill is a gradient/pattern. Default: uses fill value */
  stroke?: string;
  /** Line cap style for bar ends: "round", "butt", or a number for custom radius. Default: "round" */
  lineCap?: BarLineCap;
  /** Whether to animate the bars. Default: true */
  animate?: boolean;
  /** Animation type: "grow" (height) or "fade" (opacity + blur). Default: "grow" */
  animationType?: BarAnimationType;
  /** Opacity when not hovered (when another bar is hovered). Default: 0.3 */
  fadedOpacity?: number;
  /** Stagger delay between bars in seconds. Auto-calculated if not provided. */
  staggerDelay?: number;
  /** Gap between stacked bars in pixels. Default: 0 */
  stackGap?: number;
  /** Gap between grouped bars in pixels. Default: 4 */
  groupGap?: number;
}

interface BarInnerProps extends BarProps {
  barScale: ScaleBand<string>;
  bandWidth: number;
  barXAccessor: (d: Record<string, unknown>) => string;
}

interface AnimatedBarProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rx: number;
  ry: number;
  index: number;
  isFaded: boolean;
  animationType: BarAnimationType;
  innerHeight: number;
  fadedOpacity: number;
  staggerDelay: number;
  enterTransition?: Transition;
  revealEpoch: number;
  isHorizontal: boolean;
  /** Loading-chrome pulse class, applied instead of a real fill while data is fabricated. */
  className?: string;
  /** Pointer drill-down (#349); the keyboard path is the sibling target layer. */
  onClick?: (event: React.MouseEvent) => void;
}

function AnimatedBar({
  x,
  y,
  width,
  height,
  fill,
  rx,
  ry,
  index,
  isFaded,
  animationType,
  innerHeight,
  fadedOpacity,
  staggerDelay,
  enterTransition,
  revealEpoch,
  isHorizontal,
  className,
  onClick,
}: AnimatedBarProps) {
  const enterAnim = transitionWithDelay(enterTransition, index * staggerDelay);

  if (animationType === "fade") {
    return (
      <motion.rect
        animate={{
          opacity: isFaded ? fadedOpacity : 1,
          filter: "blur(0px)",
        }}
        className={className}
        fill={fill}
        height={height}
        initial={{ opacity: 0, filter: "blur(2px)" }}
        key={`fade-${index}-${revealEpoch}`}
        onClick={onClick}
        rx={rx}
        ry={ry}
        transition={enterAnim}
        width={width}
        x={x}
        y={y}
      />
    );
  }

  const initial = isHorizontal
    ? { width: 0, height, x: 0, y }
    : { width, height: 0, x, y: innerHeight };
  const target = isHorizontal ? { width, height, x: 0, y } : { width, height, x, y };

  return (
    <g
      opacity={isFaded ? fadedOpacity : 1}
      style={{ transition: "opacity var(--t-fast) var(--ease-standard)" }}
    >
      <motion.rect
        animate={target}
        className={className}
        fill={fill}
        initial={initial}
        key={`grow-${index}-${revealEpoch}`}
        onClick={onClick}
        rx={rx}
        ry={ry}
        transition={enterAnim}
      />
    </g>
  );
}

const BarInner = memo(function BarInner({
  dataKey,
  yAxisId,
  fill = chartCssVars.linePrimary,
  lineCap = "round",
  animate = true,
  animationType = "grow",
  fadedOpacity = 0.3,
  staggerDelay,
  stackGap = 0,
  groupGap = 4,
  barScale,
  bandWidth,
  barXAccessor,
}: BarInnerProps) {
  const {
    data,
    margin,
    yScale: chartYScale,
    innerHeight,
    isLoaded,
    hoveredBarIndex,
    lines,
    orientation,
    stacked,
    stackOffsets,
    animationDuration,
    enterTransition,
    revealEpoch = 0,
    chartPhase,
  } = useChart();

  // While the chart shows loading chrome, the rendered rows are fabricated
  // placeholder data (generateCategoricalSkeletonData) — paint bars with a
  // neutral skeleton fill + pulse instead of the real series color so they
  // can't be mistaken for real values (mirrors Line/Area's stroke de-emphasis).
  const isLoadingPhase = isLoadingChromePhase(chartPhase);

  // Blueprint pattern fill: active only under high decoration AND for palette fills
  const high = useHighDecoration();
  const patternRawScope = useId().replace(/:/g, "");

  // Calculate stagger delay automatically if not provided
  // Total animation duration is ~1200ms, with 40% for stagger spread and 60% for bar animation
  const totalAnimDuration = animationDuration || 1100;
  const staggerSpread = totalAnimDuration * 0.4; // 40% of time for stagger spread
  const calculatedStaggerDelay =
    staggerDelay ?? (data.length > 1 ? staggerSpread / 1000 / data.length : 0);
  const uniqueId = useId();

  const isHorizontal = orientation === "horizontal";

  // Find the index of this bar series among all bar series
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();

  const seriesIndex = useMemo(() => {
    const idx = lines.findIndex((l) => l.dataKey === dataKey);
    return idx >= 0 ? idx : 0;
  }, [lines, dataKey]);

  // Blueprint: pattern fill when high decoration + palette fill
  const usePattern = high && isPaletteFill(fill);
  const patternId = seriesPatternId(seriesIndex, patternRawScope);
  // Loading chrome overrides the series fill with a neutral skeleton token —
  // the real fill (and pattern) is restored automatically on the loading→ready
  // handoff, since `isLoadingPhase` flips false and this expression re-resolves.
  const resolvedFill = isLoadingPhase ? "var(--muted)" : usePattern ? `url(#${patternId})` : fill;
  const loadingPulseClassName = isLoadingPhase
    ? "animate-pulse motion-reduce:animate-none"
    : undefined;

  const seriesConfig = lines[seriesIndex];
  const valueScale = useYScale(yAxisId ?? seriesConfig?.yAxisId);

  const isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;

  const seriesCount = lines.length;
  const isLastSeries = seriesIndex === seriesCount - 1;

  // Calculate the width for each bar within a group (for non-stacked)
  const barWidth = useMemo(() => {
    if (!bandWidth || seriesCount === 0) {
      return 0;
    }
    if (stacked) {
      // Stacked bars use full band width
      return bandWidth;
    }
    // Leave a gap between grouped bars (controlled by groupGap prop)
    const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
    return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
  }, [bandWidth, seriesCount, stacked, groupGap]);

  // Calculate corner radius based on lineCap. `round` follows the theme's --radius
  // token (resolved to px) so bars square in blueprint/high-decoration and scale
  // with rounder themes — capped at half the bar width so thin bars never lozenge. #165
  const themeRadius = useResolvedRadius();
  const cornerRadius = useMemo(() => {
    if (typeof lineCap === "number") {
      return lineCap;
    }
    if (lineCap === "round" && barWidth) {
      return Math.min(barWidth / 2, themeRadius);
    }
    return 0;
  }, [lineCap, barWidth, themeRadius]);

  // Geometry is computed ONCE and consumed twice — by the rendered rects and by
  // the keyboard target registry (#349). Deriving the drill-down hit boxes from
  // the same numbers the bars are drawn from is what guarantees a keyboard user
  // lands exactly where a mouse user clicks, without any layout reads.
  const barLayout = useMemo(() => {
    const scale = isHorizontal ? chartYScale : valueScale;
    const layout: {
      index: number;
      value: number;
      categoryValue: string;
      datum: Record<string, unknown>;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];

    data.forEach((d, i) => {
      const value = d[dataKey];
      if (typeof value !== "number") {
        return;
      }

      const categoryValue = barXAccessor(d);
      const bandPos = barScale(categoryValue) ?? 0;

      let x: number;
      let y: number;
      let barHeight: number;
      let barW: number;

      if (isHorizontal) {
        // Horizontal bars: category on y-axis, value on x-axis
        const valuePos = scale(value) ?? 0;
        barW = valuePos; // Width is the value position (grows from left)
        barHeight = barWidth;

        if (stacked && stackOffsets) {
          const offset = stackOffsets.get(i)?.get(dataKey) ?? 0;
          x = scale(offset) ?? 0;
          barW = valuePos - x;
          // Apply stack gap for horizontal: shift right and reduce width
          const gapOffset = seriesIndex * stackGap;
          x += gapOffset;
          if (!isLastSeries && stackGap > 0) {
            barW = Math.max(0, barW - stackGap);
          }
        } else {
          x = 0;
        }
        y = stacked
          ? bandPos
          : bandPos + seriesIndex * (barWidth + (seriesCount > 1 ? groupGap : 0));
      } else {
        // Vertical bars: category on x-axis, value on y-axis
        const valuePos = scale(value) ?? 0;
        barHeight = innerHeight - valuePos;
        barW = barWidth;

        if (stacked && stackOffsets) {
          const offset = stackOffsets.get(i)?.get(dataKey) ?? 0;
          const offsetY = scale(offset) ?? innerHeight;
          // Apply stack gap: shift up and reduce height
          const gapOffset = seriesIndex * stackGap;
          y = offsetY - barHeight - gapOffset;
          // Reduce height slightly for non-last bars to create visual gap
          if (!isLastSeries && stackGap > 0) {
            barHeight = Math.max(0, barHeight - stackGap);
          }
        } else {
          y = valuePos;
        }
        x = stacked
          ? bandPos
          : bandPos + seriesIndex * (barWidth + (seriesCount > 1 ? groupGap : 0));
      }

      layout.push({
        index: i,
        value,
        categoryValue,
        datum: d,
        x,
        y,
        width: barW,
        height: barHeight,
      });
    });

    return layout;
  }, [
    barScale,
    barWidth,
    barXAccessor,
    chartYScale,
    data,
    dataKey,
    groupGap,
    innerHeight,
    isHorizontal,
    isLastSeries,
    seriesCount,
    seriesIndex,
    stackGap,
    stackOffsets,
    stacked,
    valueScale,
  ]);

  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();

  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_BAR_TARGETS;
    }
    return barLayout.map((bar) => barTarget(bar, dataKey, seriesIndex, margin));
  }, [barLayout, dataKey, datapointsEnabled, margin, seriesIndex]);

  useRegisterDatapointTargets(`bar:${dataKey}`, datapointTargets);

  return (
    <g className={`bar-series-${uniqueId}`}>
      {usePattern && <defs>{makeSeriesPattern(seriesIndex, patternId, fill)}</defs>}
      {barLayout.map((bar) => {
        const { index: i, categoryValue, x, y, width: barW, height: barHeight } = bar;
        const onBarClick = activateDatapoint
          ? (event: React.MouseEvent) =>
              activateDatapoint(barTarget(bar, dataKey, seriesIndex, margin), event)
          : undefined;

        const isFaded = (hoveredBarIndex !== null && hoveredBarIndex !== i) || isLegendDimmed;

        // Use categoryValue as key since it's the unique identifier from data
        const barKey = `bar-${dataKey}-${categoryValue}`;

        // Apply rounded corners:
        // - For non-stacked: always apply
        // - For stacked with gap: apply to all bars
        // - For stacked without gap: only apply to the last series
        const applyRounding = !stacked || stackGap > 0 || isLastSeries;
        const effectiveRx = applyRounding ? cornerRadius : 0;
        const effectiveRy = applyRounding ? cornerRadius : 0;

        if (animate && !isLoaded) {
          return (
            <AnimatedBar
              animationType={animationType}
              className={loadingPulseClassName}
              enterTransition={enterTransition}
              fadedOpacity={fadedOpacity}
              fill={resolvedFill}
              height={barHeight}
              index={i}
              innerHeight={innerHeight}
              isFaded={isFaded}
              isHorizontal={isHorizontal}
              key={barKey}
              onClick={onBarClick}
              revealEpoch={revealEpoch}
              rx={effectiveRx}
              ry={effectiveRy}
              staggerDelay={calculatedStaggerDelay}
              width={barW}
              x={x}
              y={y}
            />
          );
        }

        // Static bar after animation completes
        return (
          <rect
            className={loadingPulseClassName}
            fill={resolvedFill}
            height={barHeight}
            key={barKey}
            onClick={onBarClick}
            opacity={isFaded ? fadedOpacity : 1}
            rx={effectiveRx}
            ry={effectiveRy}
            style={{
              // The bar itself is aria-hidden and NOT focusable — the keyboard
              // path is the sibling ChartDatapointLayer (#349). The pointer
              // cursor is the only affordance this element carries.
              cursor: onBarClick ? "pointer" : "default",
              transition: "opacity var(--t-fast) var(--ease-standard)",
            }}
            width={barW}
            x={x}
            y={y}
          />
        );
      })}
    </g>
  );
});

export function Bar(props: BarProps) {
  const { barScale, bandWidth, barXAccessor } = useChartStable();

  if (!(barScale && bandWidth && barXAccessor)) {
    console.warn("Bar component must be used within a BarChart");
    return null;
  }

  return (
    <BarInner {...props} bandWidth={bandWidth} barScale={barScale} barXAccessor={barXAccessor} />
  );
}

Bar.displayName = "Bar";

export default Bar;
