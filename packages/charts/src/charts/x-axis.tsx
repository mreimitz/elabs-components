"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@elabs/components-ui";
import { useChart, useChartStable } from "./chart-context";
import { shortDateFmt } from "./chart-formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";

const X_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

export interface XAxisProps {
  /** Number of ticks to show (including first and last). Default: 5. Used when `tickMode` is `"domain"`. */
  numTicks?: number;
  /** Width of the date ticker box for fade calculation. Default: 50 */
  tickerHalfWidth?: number;
  /**
   * `"domain"` — evenly spaced ticks across the time domain (default).
   * `"data"` — one label per data row at its x value (better with sparse or monthly bars).
   */
  tickMode?: "domain" | "data";
  /**
   * Override the default `Intl`-based tick label formatter. Applied to every
   * tick this axis renders (generated or `tickValues`). #357.
   *
   * **Time scale only.** Ignored (with a dev warning) when the chart runs
   * `xScale="band" | "linear"` — those modes project onto a synthetic instant,
   * so a `Date` formatter would print a fabricated calendar date instead of your
   * x value. Format categorical/numeric x values in your data. #352.
   */
  tickFormat?: (value: Date) => string;
  /**
   * Render exactly these tick positions, bypassing tick generation AND the
   * default label-collision de-dupe entirely — use when the default de-dupe
   * would collapse the axis (e.g. dense data whose formatted labels collide). #357.
   *
   * **Time scale only** — see `tickFormat`. #352.
   */
  tickValues?: Date[];
}

interface AxisTick {
  date: Date;
  x: number;
  label: string;
}

interface XAxisLabelProps {
  label: string;
  x: number;
  crosshairX: number | null;
  hoveredLabel: string | null;
  isHovering: boolean;
  tickerHalfWidth: number;
  animatePosition: boolean;
}

function XAxisLabel({
  label,
  x,
  crosshairX,
  hoveredLabel,
  isHovering,
  tickerHalfWidth,
  animatePosition,
}: XAxisLabelProps) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;

  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (hoveredLabel && label === hoveredLabel) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent: "center",
        transition: animatePosition
          ? `left ${X_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")})`
          : undefined,
      }}
    >
      <span
        className={cn("whitespace-nowrap text-chart-label text-meta")}
        style={{
          opacity,
          transition: "opacity var(--t-slow) var(--ease-standard)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const MAX_GAP_LAYOUTS = 400;

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/** All ways to split `span` into `parts` positive integer gaps. */
function composePositiveSum(sum: number, parts: number): number[][] {
  if (parts === 1) {
    return sum >= 1 ? [[sum]] : [];
  }

  const layouts: number[][] = [];
  for (let gap = 1; gap <= sum - (parts - 1); gap++) {
    for (const tail of composePositiveSum(sum - gap, parts - 1)) {
      layouts.push([gap, ...tail]);
    }
  }
  return layouts;
}

function gapsToIndices(gaps: number[]): number[] {
  const indices = [0];
  let position = 0;
  for (const gap of gaps) {
    position += gap;
    indices.push(position);
  }
  return indices;
}

function indicesForTickCount(length: number, tickCount: number): number[] {
  const span = length - 1;
  if (span <= 0) {
    return [0];
  }

  const rawIndices = Array.from({ length: tickCount }, (_, index) =>
    Math.round((index / (tickCount - 1)) * span),
  );

  const indices = [...new Set(rawIndices)].sort((a, b) => a - b);
  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices.at(-1) !== span) {
    indices.push(span);
  }

  return [...new Set(indices)].sort((a, b) => a - b);
}

function allIndexLayouts(length: number, tickCount: number): number[][] {
  const span = length - 1;
  if (span <= 0) {
    return [[0]];
  }

  const gapCount = tickCount - 1;
  if (gapCount <= 0) {
    return [[0]];
  }

  const layoutCount = binomial(span - 1, gapCount - 1);
  if (layoutCount > MAX_GAP_LAYOUTS) {
    return [indicesForTickCount(length, tickCount)];
  }

  return composePositiveSum(span, gapCount).map(gapsToIndices);
}

function dedupeIndicesByLabel(
  indices: number[],
  data: Record<string, unknown>[],
  dateLabels: string[],
  xAccessor: (d: Record<string, unknown>) => Date,
  tickFormat?: (value: Date) => string,
): number[] {
  const seenLabels = new Set<string>();
  const deduped: number[] = [];

  for (const index of indices) {
    const point = data[index];
    if (!point) {
      continue;
    }
    const label = tickFormat
      ? tickFormat(xAccessor(point))
      : (dateLabels[index] ?? shortDateFmt.format(xAccessor(point)));
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    deduped.push(index);
  }

  return deduped;
}

interface TickLayoutScore {
  score: number;
  symmetryPenalty: number;
  countDistance: number;
  /** 0 = smallest gap at end, 1 = at start, 2 = in the middle */
  edgePreference: number;
}

function indexGaps(indices: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    const current = indices[i];
    const previous = indices[i - 1];
    if (current == null || previous == null) {
      continue;
    }
    gaps.push(current - previous);
  }
  return gaps;
}

function smallestGapEdgePreference(indices: number[]): number {
  const gaps = indexGaps(indices);
  const smallestGap = Math.min(...gaps);
  const smallestGapIndex = gaps.indexOf(smallestGap);
  if (smallestGapIndex === gaps.length - 1) {
    return 0;
  }
  if (smallestGapIndex === 0) {
    return 1;
  }
  return 2;
}

function scoreTickLayout(
  indices: number[],
  resolveXPx: (index: number) => number,
  targetCount: number,
): TickLayoutScore {
  if (indices.length < 2) {
    return {
      score: Number.POSITIVE_INFINITY,
      symmetryPenalty: Number.POSITIVE_INFINITY,
      countDistance: Number.POSITIVE_INFINITY,
      edgePreference: Number.POSITIVE_INFINITY,
    };
  }

  const pixelGaps: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    const current = indices[i];
    const previous = indices[i - 1];
    if (current == null || previous == null) {
      continue;
    }
    pixelGaps.push(resolveXPx(current) - resolveXPx(previous));
  }

  const minGap = Math.min(...pixelGaps);
  const maxGap = Math.max(...pixelGaps);
  const meanGap = pixelGaps.reduce((sum, gap) => sum + gap, 0) / pixelGaps.length;
  const spreadRatio = meanGap > 0 ? (maxGap - minGap) / meanGap : maxGap - minGap;
  const countDistance = Math.abs(indices.length - targetCount);

  const gaps = indexGaps(indices);
  const smallestGap = Math.min(...gaps);
  const smallestGapIndex = gaps.indexOf(smallestGap);
  const interiorPenalty = smallestGapIndex > 0 && smallestGapIndex < gaps.length - 1 ? 0.08 : 0;

  const symmetryPenalty =
    gaps.reduce((penalty, gap, index) => {
      return penalty + Math.abs(gap - (gaps.at(-1 - index) ?? gap));
    }, 0) / gaps.length;

  return {
    score: spreadRatio + 0.1 * countDistance + interiorPenalty + symmetryPenalty * 0.02,
    symmetryPenalty,
    countDistance,
    edgePreference: smallestGapEdgePreference(indices),
  };
}

function isBetterTickLayout(
  next: TickLayoutScore,
  best: TickLayoutScore,
  nextCountDistance: number,
  bestCountDistance: number,
): boolean {
  if (next.score < best.score - 1e-6) {
    return true;
  }
  if (Math.abs(next.score - best.score) > 1e-6) {
    return false;
  }
  if (nextCountDistance < bestCountDistance) {
    return true;
  }
  if (nextCountDistance > bestCountDistance) {
    return false;
  }
  if (next.symmetryPenalty < best.symmetryPenalty - 1e-6) {
    return true;
  }
  if (next.symmetryPenalty > best.symmetryPenalty + 1e-6) {
    return false;
  }
  return next.edgePreference < best.edgePreference;
}

/**
 * Picks tick indices with the most even on-screen spacing. Tries
 * `targetCount ± 1` and evaluates every gap layout when feasible.
 */
export function selectEvenlySpacedIndices(
  length: number,
  targetCount: number,
  options?: {
    data?: Record<string, unknown>[];
    dateLabels?: string[];
    xAccessor?: (d: Record<string, unknown>) => Date;
    resolveXPx?: (index: number) => number;
    tickFormat?: (value: Date) => string;
  },
): number[] {
  if (length <= 0) {
    return [];
  }
  if (length === 1) {
    return [0];
  }
  if (length <= targetCount) {
    return Array.from({ length }, (_, index) => index);
  }

  const resolveXPx = options?.resolveXPx ?? ((index: number) => index);

  const minCount = Math.max(2, targetCount - 1);
  const maxCount = Math.min(length, targetCount + 1);

  let bestIndices = indicesForTickCount(length, targetCount);
  let bestScore = scoreTickLayout(bestIndices, resolveXPx, targetCount);
  let bestCountDistance = bestScore.countDistance;

  for (let tickCount = minCount; tickCount <= maxCount; tickCount++) {
    for (const rawIndices of allIndexLayouts(length, tickCount)) {
      const indices =
        options?.data && options.dateLabels && options.xAccessor
          ? dedupeIndicesByLabel(
              rawIndices,
              options.data,
              options.dateLabels,
              options.xAccessor,
              options.tickFormat,
            )
          : rawIndices;

      if (indices.length < 2) {
        continue;
      }

      const layoutScore = scoreTickLayout(indices, resolveXPx, targetCount);
      const countDistance = Math.abs(indices.length - targetCount);

      if (isBetterTickLayout(layoutScore, bestScore, countDistance, bestCountDistance)) {
        bestIndices = indices;
        bestScore = layoutScore;
        bestCountDistance = countDistance;
      }
    }
  }

  return bestIndices;
}

function buildDataAlignedTicks({
  data,
  dateLabels,
  marginLeft,
  targetTickCount,
  tickFormat,
  xAccessor,
  xScale,
}: {
  data: Record<string, unknown>[];
  dateLabels: string[];
  marginLeft: number;
  targetTickCount: number;
  tickFormat?: (value: Date) => string;
  xAccessor: (d: Record<string, unknown>) => Date;
  xScale: (date: Date) => number | undefined;
}): AxisTick[] {
  const seenLabels = new Set<string>();
  const ticks: AxisTick[] = [];

  const resolveXPx = (index: number) => {
    const point = data[index];
    if (!point) {
      return index;
    }
    return xScale(xAccessor(point)) ?? 0;
  };

  for (const index of selectEvenlySpacedIndices(data.length, targetTickCount, {
    data,
    dateLabels,
    resolveXPx,
    tickFormat,
    xAccessor,
  })) {
    const point = data[index];
    if (!point) {
      continue;
    }
    const date = xAccessor(point);
    const label = tickFormat ? tickFormat(date) : (dateLabels[index] ?? shortDateFmt.format(date));
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    ticks.push({
      date,
      label,
      x: (xScale(date) ?? 0) + marginLeft,
    });
  }

  return ticks;
}

function buildDomainTicks({
  marginLeft,
  numTicks,
  tickFormat,
  xScale,
}: {
  marginLeft: number;
  numTicks: number;
  tickFormat?: (value: Date) => string;
  xScale: {
    domain: () => Date[];
    (date: Date): number | undefined;
  };
}): AxisTick[] {
  const domain = xScale.domain();
  const startDate = domain[0];
  const endDate = domain[1];

  if (!(startDate && endDate)) {
    return [];
  }

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  // #352: a chart whose x values are all non-Date-coercible (e.g. ScatterChart,
  // which derives its domain via `Math.min`/`Math.max` rather than the
  // NaN-skipping `extent()` LineChart/AreaChart use) can hand this an Invalid
  // Date domain (`getTime()` is `NaN`). Interpolating within it below would
  // still produce Invalid Dates, and `shortDateFmt.format()` throws
  // `RangeError: Invalid time value` on one — bail to no ticks instead of
  // crashing the whole chart from inside the axis.
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return [];
  }

  const timeRange = endTime - startTime;
  const tickCount = Math.max(2, numTicks);
  const seenLabels = new Set<string>();
  const ticks: AxisTick[] = [];

  for (let i = 0; i < tickCount; i++) {
    const t = i / (tickCount - 1);
    const date = new Date(startTime + t * timeRange);
    const label = tickFormat ? tickFormat(date) : shortDateFmt.format(date);
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    ticks.push({
      date,
      label,
      x: (xScale(date) ?? 0) + marginLeft,
    });
  }

  return ticks;
}

export function XAxis(props: XAxisProps) {
  const { containerRef } = useChartStable();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  return <XAxisInner {...props} container={container} />;
}

const XAxisInner = memo(function XAxisInner({
  numTicks = 5,
  tickerHalfWidth = 50,
  tickMode = "domain",
  tickFormat,
  tickValues,
  container,
}: XAxisProps & { container: HTMLDivElement }) {
  const { xScale, margin, tooltipData, data, xAccessor, dateLabels, xDomain, xScaleType } =
    useChart();

  // #352: on a band/linear axis the scale's domain holds SYNTHETIC instants, so
  // interpolating dates across it (the `"domain"` tick path) would invent
  // positions that belong to no data row and have no label. Categorical and
  // numeric axes therefore always take the data-aligned path, which reads its
  // labels from `dateLabels` — i.e. the caller's own x values.
  const isNonTimeScale = xScaleType != null && xScaleType !== "time";

  // #352: `tickFormat` (`(value: Date) => string`) and `tickValues` (`Date[]`)
  // are Date-shaped APIs. On a band/linear axis `xAccessor` returns a SYNTHETIC
  // positional instant, so honouring them prints a fabricated calendar date
  // ("1970-01-01T00:00:00.001Z") where the caller's own x value belongs — the
  // exact synthetic-date leak #352 exists to remove, and a direct contradiction
  // of this package's own rule ("read an x label from `dateLabels[index]`, never
  // by formatting `xAccessor(d)`"). Both are therefore INERT on a non-time
  // scale; labels come from `dateLabels`, and a dev warning says so.
  const effectiveTickFormat = isNonTimeScale ? undefined : tickFormat;
  const effectiveTickValues = isNonTimeScale ? undefined : tickValues;

  const labelsToShow = useMemo(() => {
    // Explicit tick positions bypass generation AND the label-collision de-dupe
    // entirely — the caller owns exactly which ticks render (#357).
    if (effectiveTickValues != null) {
      return effectiveTickValues.map((date) => ({
        date,
        label: effectiveTickFormat ? effectiveTickFormat(date) : shortDateFmt.format(date),
        x: (xScale(date) ?? 0) + margin.left,
      }));
    }

    // Brush (any extent): snap ticks to data rows with even index spacing.
    if (tickMode === "data" || xDomain != null || isNonTimeScale) {
      return buildDataAlignedTicks({
        data,
        dateLabels,
        marginLeft: margin.left,
        targetTickCount: numTicks,
        tickFormat: effectiveTickFormat,
        xAccessor,
        xScale,
      });
    }

    return buildDomainTicks({
      marginLeft: margin.left,
      numTicks,
      tickFormat: effectiveTickFormat,
      xScale,
    });
  }, [
    effectiveTickValues,
    effectiveTickFormat,
    tickMode,
    xDomain,
    isNonTimeScale,
    data,
    dateLabels,
    xAccessor,
    xScale,
    margin.left,
    numTicks,
  ]);

  const warnedNonTimeTickPropsRef = useRef(false);
  useEffect(() => {
    if (
      isNonTimeScale &&
      (tickFormat != null || tickValues != null) &&
      !warnedNonTimeTickPropsRef.current &&
      process.env.NODE_ENV !== "production"
    ) {
      warnedNonTimeTickPropsRef.current = true;
      console.warn(
        '[XAxis] `tickFormat`/`tickValues` take a `Date` and are ignored on a non-time x-scale (xScale="band" | "linear"), ' +
          "because the scale's instants are synthetic positions, not calendar dates. Tick labels come from the " +
          "x values you passed. Format them in your data instead.",
      );
    }
  }, [isNonTimeScale, tickFormat, tickValues]);

  // Dev-only, once-per-mount diagnostic (#357, DataTable #227 idiom): the default
  // label-collision de-dupe can silently collapse the axis to a single (or zero)
  // tick when several data rows format to the same label (e.g. dense timestamps
  // under a day-granularity formatter) — surface it instead of a mysteriously
  // empty axis. Doesn't fire when the caller already opted into `tickFormat`/
  // `tickValues`, since a collapsed result is then an explicit choice, not a
  // silent one.
  const warnedCollapsedRef = useRef(false);
  useEffect(() => {
    if (
      tickFormat == null &&
      tickValues == null &&
      data.length >= 2 &&
      labelsToShow.length < 2 &&
      !warnedCollapsedRef.current &&
      process.env.NODE_ENV !== "production"
    ) {
      warnedCollapsedRef.current = true;
      console.warn(
        `[XAxis] Tick labels collapsed to ${labelsToShow.length} after de-duplicating identical ` +
          "formatted labels — the x-axis may look empty. Pass `tickFormat` (e.g. add more date " +
          "precision) or `tickValues` to control tick labels explicitly.",
      );
    }
  }, [tickFormat, tickValues, data.length, labelsToShow.length]);

  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;
  const hoveredLabel =
    isHovering && tooltipData
      ? effectiveTickFormat
        ? effectiveTickFormat(xAccessor(tooltipData.point))
        : (dateLabels[tooltipData.index] ?? shortDateFmt.format(xAccessor(tooltipData.point)))
      : null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      {labelsToShow.map((item) => (
        <XAxisLabel
          animatePosition={xDomain == null}
          crosshairX={crosshairX}
          hoveredLabel={hoveredLabel}
          isHovering={isHovering}
          // `item.label` is included because a non-Date-coercible xDataKey value
          // (#352 — dateLabels' text fallback) produces an Invalid Date whose
          // `.getTime()` is `NaN` for every such tick; `NaN-${x}` alone collided
          // across ticks (React "duplicate key" warning). The label disambiguates.
          key={`${item.label}-${item.date.getTime()}-${item.x}`}
          label={item.label}
          tickerHalfWidth={tickerHalfWidth}
          x={item.x}
        />
      ))}
    </div>,
    container,
  );
});

XAxis.displayName = "XAxis";

export default XAxis;
