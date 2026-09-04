"use client";

import type { scaleBand } from "@visx/scale";
import type { Transition } from "motion/react";
import { motion } from "motion/react";
import { memo, useId, useMemo } from "react";
import { HaloText, UnitStack, type UnitStackDirection, type UnitStackKind } from "../marks";
import {
  chartCssVars,
  type ChartPalette,
  type Margin,
  resolvePalette,
  useChart,
  useChartStable,
  useYScale,
} from "./chart-context";
import {
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { useChartValueFormatter } from "./chart-formatters";
import { useChartLegendHover } from "./chart-legend-hover";
import { transitionWithDelay } from "./motion-utils";
import { useHighDecoration } from "./use-high-decoration";
import { useResolvedRadius } from "./use-resolved-radius";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { isLoadingChromePhase } from "./y-domain-utils";

/** The Unicode MINUS SIGN (not a hyphen) a negative bar's value label signs with. */
const MINUS_SIGN = "−";

/**
 * A `showValues` label hides below this per-bar pixel width rather than
 * shrinking `text-chart-value` below `text-meta` — styling-and-tokens.md
 * "Type is a role, not a size". Wide enough for a halo'd 2-3 digit compact
 * label ("128", "1.2K") at the role's default size.
 */
const MIN_LABEL_BAR_WIDTH = 20;

/** Gap in px between a bar's far end and an `"outside"` value label. */
const VALUE_LABEL_GAP = 6;

/** Gap in px between a bar's far end and an `"inside"` value label. */
const VALUE_LABEL_INSET = 10;

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
  /**
   * The raw `scale(value)` pixel position along the value axis (RM-027) — the
   * bar's FAR end from the zero baseline regardless of sign. Used to place
   * `showValues` labels and the negative-bar asymmetric radius without
   * re-deriving it from `x`/`y`/`width`/`height` and the sign of `value`.
   */
  valuePos: number;
}

/**
 * Path for a bar whose value is negative: capsule radius on the OUTER end
 * only (the end farthest from the zero baseline), square on the end that
 * meets it — lieflat G10 Diverging Bar. `radius` is clamped to the box.
 */
function negativeBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  isHorizontal: boolean,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0) {
    return `M${x},${y} h${width} v${height} h${-width} Z`;
  }
  if (isHorizontal) {
    // Outer end is the LEFT edge (grows leftward from the zero baseline on
    // the right): round its two corners; the right edge stays square.
    return [
      `M${x + r},${y}`,
      `H${x + width}`,
      `V${y + height}`,
      `H${x + r}`,
      `A${r},${r} 0 0 1 ${x},${y + height - r}`,
      `V${y + r}`,
      `A${r},${r} 0 0 1 ${x + r},${y}`,
      "Z",
    ].join(" ");
  }
  // Vertical: outer end is the BOTTOM edge (grows downward from the zero
  // baseline above): round its two corners; the top edge stays square.
  return [
    `M${x},${y}`,
    `H${x + width}`,
    `V${y + height - r}`,
    `A${r},${r} 0 0 1 ${x + width - r},${y + height}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + height - r}`,
    `V${y}`,
    "Z",
  ].join(" ");
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

/**
 * `true`/`"outside"` place the value label just past the bar's far end;
 * `"inside"` places it just inside. See {@link BarProps.showValues}.
 */
export type BarShowValues = boolean | "outside" | "inside";

/**
 * Identifies the one "hero" bar `highlightKey` picks out. A string/number is
 * matched against the bar's category value (`==`-free, via `String(…)`); a
 * function receives the raw datum and its row index.
 */
export type BarHighlightKey =
  | string
  | number
  | ((datum: Record<string, unknown>, index: number) => boolean);

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
  /**
   * Print each bar's value as a `HaloText` label (the `text-chart-value`
   * role, 800-weight — lieflat G3 Chunky Bars). `true`/`"outside"` place it
   * just past the bar's far end; `"inside"` places it just inside. A
   * negative bar's label is signed with a "−" (U+2212, not a hyphen) glyph.
   * A bar narrower than `MIN_LABEL_BAR_WIDTH` hides its label rather than
   * shrinking below `text-meta`. Default: off.
   */
  showValues?: BarShowValues;
  /**
   * Draw each bar as a countable `UnitStack` of `round(value / unit)` rungs
   * (vertical bars, `kind="rung"`) or ticks (horizontal bars,
   * `kind="tick"`) instead of a solid fill — lieflat F1 Rung Bars. Width and
   * opacity jitter via `seededRnd`, keyed per bar so neighbours never jitter
   * in lockstep; every 5th unit draws heavier so the stack stays countable.
   * Renders instantly (no `animate`/`animationType` grow-in). Default: off
   * (solid fill).
   */
  unit?: number;
  /**
   * Mark ONE bar as this series' "hero": it draws in `--chart-foreground`
   * ink while every OTHER bar draws from `palette` instead of `fill` —
   * lieflat's one-hero-bar-in-ink convention. A string/number is matched
   * against the bar's category value; a function receives `(datum, index)`.
   * Default: off (every bar draws `fill`).
   */
  highlightKey?: BarHighlightKey;
  /**
   * Palette the non-hero bars draw from when `highlightKey` is set, via
   * `resolvePalette` (RM-018). Default: `"categorical"`.
   */
  palette?: ChartPalette;
  /**
   * Draw a 0.8px `--chart-foreground-muted` hairline at the zero baseline
   * across the whole plot. Default: auto — shown whenever ANY bar series in
   * this chart has a negative value; pass `false` to force it off on this
   * series, or `true` to force it on even with all-positive data.
   */
  zeroLine?: boolean;
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
  /**
   * The zero-baseline pixel coordinate along the value axis (RM-027) — where
   * the bar grows FROM. `innerHeight` for a vertical, all-positive series
   * (the pre-RM-027 constant) or `0` for a horizontal one; a diverging
   * series' actual `scale(0)` otherwise, so a negative bar grows from the
   * zero line rather than from the plot's far edge.
   */
  baseline: number;
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
  baseline,
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
    ? { width: 0, height, x: baseline, y }
    : { width, height: 0, x, y: baseline };
  const target = isHorizontal ? { width, height, x, y } : { width, height, x, y };

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
  showValues,
  unit,
  highlightKey,
  palette,
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

  // Decoration pattern fill: active only under high decoration AND for palette fills
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

  // Decoration: pattern fill when high decoration + palette fill
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
  const formatValue = useChartValueFormatter();

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
  // token (resolved to px) so bars square in high decoration and scale
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

  // The zero-baseline pixel coordinate along the value axis (RM-027) — bars
  // draw on EITHER side of it now, not just up from a fixed edge. Falls back
  // to the old fixed edge when the scale can't resolve 0 (never happens for a
  // numeric domain in practice), which is what keeps every all-positive
  // series' geometry byte-identical to pre-RM-027.
  const baseline = useMemo(() => {
    const scale = isHorizontal ? chartYScale : valueScale;
    return scale(0) ?? (isHorizontal ? 0 : innerHeight);
  }, [isHorizontal, chartYScale, valueScale, innerHeight]);

  // Geometry is computed ONCE and consumed twice — by the rendered rects and by
  // the keyboard target registry (#349). Deriving the drill-down hit boxes from
  // the same numbers the bars are drawn from is what guarantees a keyboard user
  // lands exactly where a mouse user clicks, without any layout reads.
  const barLayout = useMemo(() => {
    const scale = isHorizontal ? chartYScale : valueScale;
    const layout: BarGeometry[] = [];

    data.forEach((d, i) => {
      const value = d[dataKey];
      if (typeof value !== "number") {
        return;
      }

      const categoryValue = barXAccessor(d);
      const bandPos = barScale(categoryValue) ?? 0;
      const valuePos = scale(value) ?? 0;

      let x: number;
      let y: number;
      let barHeight: number;
      let barW: number;

      if (isHorizontal) {
        // Horizontal bars: category on y-axis, value on x-axis
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
          // Grows from the zero baseline in EITHER direction — a negative
          // value's bar sits to the LEFT of it (RM-027 diverging).
          x = Math.min(baseline, valuePos);
          barW = Math.abs(valuePos - baseline);
        }
        y = stacked
          ? bandPos
          : bandPos + seriesIndex * (barWidth + (seriesCount > 1 ? groupGap : 0));
      } else {
        // Vertical bars: category on x-axis, value on y-axis
        barW = barWidth;

        if (stacked && stackOffsets) {
          barHeight = innerHeight - valuePos;
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
          // Grows from the zero baseline in EITHER direction — a negative
          // value's bar sits BELOW it (RM-027 diverging).
          y = Math.min(baseline, valuePos);
          barHeight = Math.abs(baseline - valuePos);
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
        valuePos,
      });
    });

    return layout;
  }, [
    barScale,
    barWidth,
    barXAccessor,
    baseline,
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

  // Which bar (if any) is this series' "hero" — matched against the category
  // value for a string/number key, or the raw datum for a function key.
  const isHeroBar = useMemo(() => {
    if (highlightKey === undefined) {
      return () => false;
    }
    if (typeof highlightKey === "function") {
      const test = highlightKey;
      return (bar: BarGeometry) => test(bar.datum, bar.index);
    }
    const key = String(highlightKey);
    return (bar: BarGeometry) => bar.categoryValue === key;
  }, [highlightKey]);

  // Colours the NON-hero bars draw from, resolved once per render rather than
  // per bar — `resolvePalette` is the one place "which colours" is decided
  // (RM-018). `explicit` mirrors whether THIS Bar's caller chose `palette`.
  const restColors = useMemo(() => {
    if (highlightKey === undefined) {
      return null;
    }
    const nonHeroCount = barLayout.filter((bar) => !isHeroBar(bar)).length;
    return resolvePalette(palette, nonHeroCount, { explicit: palette !== undefined });
  }, [highlightKey, palette, barLayout, isHeroBar]);

  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();

  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_BAR_TARGETS;
    }
    return barLayout.map((bar) => barTarget(bar, dataKey, seriesIndex, margin));
  }, [barLayout, dataKey, datapointsEnabled, margin, seriesIndex]);

  useRegisterDatapointTargets(`bar:${dataKey}`, datapointTargets);

  // Imperative counter walked across the render loop below — `restColors` is
  // sized to the NON-hero count, and bars render in the same order it was
  // built from, so each non-hero bar claims the next colour in turn.
  let nonHeroRenderIndex = 0;

  return (
    <g className={`bar-series-${uniqueId}`}>
      {usePattern && <defs>{makeSeriesPattern(seriesIndex, patternId, fill)}</defs>}
      {barLayout.map((bar) => {
        const { index: i, categoryValue, x, y, width: barW, height: barHeight, valuePos } = bar;
        const onBarClick = activateDatapoint
          ? (event: React.MouseEvent) =>
              activateDatapoint(barTarget(bar, dataKey, seriesIndex, margin), event)
          : undefined;

        const isFaded = (hoveredBarIndex !== null && hoveredBarIndex !== i) || isLegendDimmed;

        // Use categoryValue as key since it's the unique identifier from data
        const barKey = `bar-${dataKey}-${categoryValue}`;
        const isNegative = bar.value < 0;

        // Highlight (RM-027): the hero bar draws in --chart-foreground ink;
        // every other bar draws from `restColors` instead of the series fill.
        let barFill = resolvedFill;
        if (highlightKey !== undefined && !isLoadingPhase) {
          if (isHeroBar(bar)) {
            barFill = "var(--chart-foreground)";
          } else if (restColors) {
            barFill = restColors[nonHeroRenderIndex] ?? resolvedFill;
            nonHeroRenderIndex += 1;
          }
        }

        // Apply rounded corners:
        // - For non-stacked: always apply
        // - For stacked with gap: apply to all bars
        // - For stacked without gap: only apply to the last series
        const applyRounding = !stacked || stackGap > 0 || isLastSeries;
        const effectiveRx = applyRounding ? cornerRadius : 0;
        const effectiveRy = applyRounding ? cornerRadius : 0;

        // showValues (RM-027): unit mode always prints its value on top; a
        // solid bar only when `showValues` asks for it. A bar thinner than
        // MIN_LABEL_BAR_WIDTH hides its label rather than shrinking the
        // `text-chart-value` role below `text-meta`.
        const useUnitMode = Boolean(unit && unit > 0) && !isLoadingPhase;
        const labelMode: BarShowValues | undefined = useUnitMode ? "outside" : showValues;
        const thickness = isHorizontal ? barHeight : barW;
        const settled = useUnitMode || !animate || isLoaded;
        const showLabel = Boolean(labelMode) && thickness >= MIN_LABEL_BAR_WIDTH && settled;

        let labelX = 0;
        let labelY = 0;
        let labelAnchor: "start" | "middle" | "end" = "middle";
        if (showLabel) {
          const outside = labelMode !== "inside";
          if (isHorizontal) {
            const crossCenter = y + barHeight / 2;
            labelY = crossCenter;
            if (outside) {
              labelX = isNegative ? valuePos - VALUE_LABEL_GAP : valuePos + VALUE_LABEL_GAP;
              labelAnchor = isNegative ? "end" : "start";
            } else {
              labelX = isNegative ? valuePos + VALUE_LABEL_INSET : valuePos - VALUE_LABEL_INSET;
              labelAnchor = isNegative ? "start" : "end";
            }
          } else {
            labelX = x + barW / 2;
            labelAnchor = "middle";
            labelY = outside
              ? isNegative
                ? valuePos + VALUE_LABEL_GAP
                : valuePos - VALUE_LABEL_GAP
              : isNegative
                ? valuePos - VALUE_LABEL_INSET
                : valuePos + VALUE_LABEL_INSET;
          }
        }
        const labelText = isNegative
          ? `${MINUS_SIGN}${formatValue(Math.abs(bar.value))}`
          : formatValue(bar.value);
        const valueLabel = showLabel && (
          <HaloText
            className="text-chart-value tabular-nums"
            dominantBaseline="middle"
            textAnchor={labelAnchor}
            x={labelX}
            y={labelY}
          >
            {labelText}
          </HaloText>
        );

        // unit mode (RM-027, F1 Rung Bars): a countable UnitStack instead of
        // a solid fill. Renders instantly — no animate/animationType grow-in,
        // there being no single rect to tween.
        if (useUnitMode) {
          const unitLength = unit as number;
          const unitCount = Math.round(Math.abs(bar.value) / unitLength);
          const kind: UnitStackKind = isHorizontal ? "tick" : "rung";
          const direction: UnitStackDirection = isHorizontal
            ? isNegative
              ? "left"
              : "right"
            : isNegative
              ? "down"
              : "up";
          const originX = isHorizontal ? baseline : x + barW / 2;
          const originY = isHorizontal ? y + barHeight / 2 : baseline;
          const pixelSpan = isHorizontal ? barW : barHeight;
          const step = unitCount > 0 ? pixelSpan / unitCount : 0;
          const crossLength = isHorizontal ? barHeight : barW;

          return (
            <g key={barKey}>
              <UnitStack
                direction={direction}
                jitter
                kind={kind}
                length={crossLength}
                markEvery={5}
                n={unitCount}
                seed={i}
                step={step}
                stroke={barFill}
                x={originX}
                y={originY}
              />
              {valueLabel}
            </g>
          );
        }

        if (animate && !isLoaded) {
          return (
            <AnimatedBar
              animationType={animationType}
              baseline={baseline}
              className={loadingPulseClassName}
              enterTransition={enterTransition}
              fadedOpacity={fadedOpacity}
              fill={barFill}
              height={barHeight}
              index={i}
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

        // Negative, non-stacked bars round the OUTER end only (lieflat G10
        // Diverging Bar) — a plain rx/ry rect rounds every corner alike, which
        // reads wrong once the bar no longer sits flush against a fixed edge.
        if (isNegative && !stacked) {
          return (
            <g key={barKey}>
              <path
                className={loadingPulseClassName}
                d={negativeBarPath(x, y, barW, barHeight, cornerRadius, isHorizontal)}
                fill={barFill}
                onClick={onBarClick}
                opacity={isFaded ? fadedOpacity : 1}
                style={{
                  cursor: onBarClick ? "pointer" : "default",
                  transition: "opacity var(--t-fast) var(--ease-standard)",
                }}
              />
              {valueLabel}
            </g>
          );
        }

        // Static bar after animation completes. No label (the common,
        // pre-RM-027 case) renders the bare `<rect>` exactly as before —
        // `showValues`/`highlightKey`/`unit` all left unset is a byte-identical
        // no-op, not just a visual one.
        const rect = (
          <rect
            className={loadingPulseClassName}
            fill={barFill}
            height={barHeight}
            key={valueLabel ? undefined : barKey}
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
        if (!valueLabel) {
          return rect;
        }
        return (
          <g key={barKey}>
            {rect}
            {valueLabel}
          </g>
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
