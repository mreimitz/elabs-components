"use client";

import { memo, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@elabs-ai/components-ui";
import { HairlineFloor } from "../marks/hairline-floor";
import { AxisTitle, type AxisTitlePlacement } from "./axis-title";
import { CHART_DENSITY_SM_MAX_TICKS, useChartConfig } from "./chart-config-context";
import { useChart, useChartStable } from "./chart-context";
import { shortDateFmt } from "./chart-formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import { useChartValueSetFormatter } from "./chart-formatters";
import { type AxisTickCount, resolveAxisTickTarget, tickTargetForWidth } from "./tick-targets";
import { NumericXRulerContext } from "./x-scale-mode";
import { type AxisDomain, buildValueScale, type ValueScaleType } from "./y-axis-scales";
import { valueAxisTicks } from "./y-axis-ticks";

const X_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

/** A period kind {@link XAxisProps.periodTicks} accepts (`false` disables it). */
export type XAxisPeriodTicks = "day" | "week" | "month";

/**
 * The number of periods a long `HairlineFloor` tick nominally represents for
 * a given period kind (RM-028) — day → weekly, week → ~monthly, month →
 * yearly. Kept for its documentary/numeric meaning (and for non-`Date`
 * `HairlineFloor` callers that still want a plain index stride); `XAxis`
 * itself no longer uses it to pick which tick is long — see
 * {@link isLongPeriodTick} (#253).
 */
export const PERIOD_TICKS_EVERY: Record<XAxisPeriodTicks, number> = {
  day: 7,
  week: 4,
  month: 12,
};

/**
 * Whether `date` is a "long" `HairlineFloor` tick for `kind` — a calendar
 * boundary a reader already holds, not an index stride from wherever the
 * series happens to start (#253: `i % 7 === 0` from the first sample marks a
 * different weekday for every series, which is not a boundary anyone reads
 * off a calendar).
 *
 * - `"day"` — the first day of the ISO week (Monday, `getDay() === 1`),
 *   matching this package's other Monday-aligned week stepping
 *   (`gantt-timescale.tsx`'s `startOf("week")`).
 * - `"week"` — the period lands in a month's first 7 days, i.e. the first
 *   weekly period on/after each month boundary.
 * - `"month"` — January, i.e. a year boundary.
 */
export function isLongPeriodTick(kind: XAxisPeriodTicks, date: Date): boolean {
  switch (kind) {
    case "day":
      return date.getDay() === 1;
    case "week":
      return date.getDate() <= 7;
    case "month":
      return date.getMonth() === 0;
    default:
      return false;
  }
}

/** Normalize to local-midnight so day/week/month stepping never drifts on DST. */
function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** One entry per calendar day from `start` to `end`, inclusive. */
function generateDailyPeriods(start: Date, end: Date): Date[] {
  const periods: Date[] = [];
  const cursor = atLocalMidnight(start);
  const last = atLocalMidnight(end).getTime();
  while (cursor.getTime() <= last) {
    periods.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return periods;
}

/** One entry every 7 days from `start` to `end`, inclusive of the last partial week's start. */
function generateWeeklyPeriods(start: Date, end: Date): Date[] {
  const periods: Date[] = [];
  const cursor = atLocalMidnight(start);
  const last = atLocalMidnight(end).getTime();
  while (cursor.getTime() <= last) {
    periods.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return periods;
}

/** One entry per calendar month (the 1st) from `start` to `end`, inclusive. */
function generateMonthlyPeriods(start: Date, end: Date): Date[] {
  const periods: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1).getTime();
  while (cursor.getTime() <= lastMonth) {
    periods.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

/**
 * Generate one `Date` per calendar period (`kind`) spanning `[start, end]`,
 * inclusive of both ends. Pure — exported (alongside {@link PERIOD_TICKS_EVERY})
 * so `periodTicks`'s calendar math is unit-testable without mounting the axis.
 */
export function generatePeriodTicks(kind: XAxisPeriodTicks, start: Date, end: Date): Date[] {
  switch (kind) {
    case "day":
      return generateDailyPeriods(start, end);
    case "week":
      return generateWeeklyPeriods(start, end);
    case "month":
      return generateMonthlyPeriods(start, end);
    default:
      return [];
  }
}

/** Which edge of the plot the x axis labels sit on (RM-108). */
export type XAxisOrientation = "top" | "bottom";

export interface XAxisProps {
  /**
   * Explicit tick count (including first and last) — the long-standing
   * override; wins over `tickCount`. Default: unset (→ `tickCount`).
   */
  numTicks?: number;
  /**
   * Tick target (RM-108). `"auto"` (default) derives it from the plot width —
   * `tickTargetForWidth(innerWidth)`, about one tick per 90 px, clamped 2–10.
   */
  tickCount?: AxisTickCount;
  /**
   * RM-108 naming, shared with `YAxis`. On a time axis: an alias of
   * `tickValues` (`tickValues` wins). On a numeric x with `domain`/`scale`
   * (ScatterChart): exactly these raw x values.
   */
  ticks?: Date[] | number[];
  /**
   * Numeric x only (ScatterChart with numeric `xDataKey`, RM-108): pin either
   * end of the x domain in raw units; `"auto"` keeps the data-derived end.
   * Read by the chart container, so place `XAxis` as a direct child. Setting
   * `domain` or `scale` also switches the labels from one per data row to a
   * numeric ruler. Ignored on a time axis.
   */
  domain?: AxisDomain;
  /**
   * Numeric x only (RM-108): `"linear"` (default), `"log"` (refuses data or a
   * domain touching 0 — dev warning, renders linear) or `"sqrt"`.
   */
  scale?: ValueScaleType;
  /** Which edge the labels sit on (RM-108). Default: `"bottom"`. */
  orientation?: XAxisOrientation;
  /** Axis title (RM-108). */
  title?: ReactNode;
  /**
   * `"outside"` (default) — in the margin beyond the tick labels, at the far
   * end; `"inside"` — `HaloText` at the far end inside the plot.
   */
  titlePlacement?: AxisTitlePlacement;
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
  /**
   * Draw a `HairlineFloor` (RM-017) below the plot — one hairline tick per
   * calendar period, whether or not a data row falls on it, with the long
   * tick anchored to a real calendar boundary (day → the first day of the
   * week, week → the first week of the month, month → January), not an index
   * stride from wherever the series happens to start (#253). Lieflat
   * provenance: the ruled foot of a ledger page gives a reader the passage of
   * time with no labels and no axis. This is a SEPARATE visual layer from the
   * labelled ticks above (`numTicks` / `tickMode`) — it never changes which
   * labels render or where. `false` (default) draws nothing — today's
   * behaviour.
   */
  periodTicks?: XAxisPeriodTicks | false;
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
  orientation: XAxisOrientation;
}

function XAxisLabel({
  label,
  x,
  crosshairX,
  hoveredLabel,
  isHovering,
  tickerHalfWidth,
  animatePosition,
  orientation,
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
        ...(orientation === "top" ? { top: 12 } : { bottom: 12 }),
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

/** The `Date` entries of a mixed `ticks` prop (the time-axis alias of `tickValues`). */
function dateTicks(ticks: XAxisProps["ticks"]): Date[] | undefined {
  if (!ticks) {
    return undefined;
  }
  const dates = (ticks as Array<Date | number>).filter(
    (value): value is Date => value instanceof Date,
  );
  return dates.length > 0 ? dates : undefined;
}

export function XAxis(props: XAxisProps) {
  const { containerRef } = useChartStable();
  const { density } = useChartConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  // RM-072: `xs` draws no tick labels; `sm` keeps this (category) axis at no
  // more than CHART_DENSITY_SM_MAX_TICKS ticks.
  if (!(mounted && container) || density === "xs") {
    return null;
  }

  if (density === "sm") {
    return (
      <XAxisInner
        {...props}
        container={container}
        maxTickTarget={CHART_DENSITY_SM_MAX_TICKS}
        tickValues={(props.tickValues ?? dateTicks(props.ticks))?.slice(
          0,
          CHART_DENSITY_SM_MAX_TICKS,
        )}
      />
    );
  }

  return <XAxisInner {...props} container={container} />;
}

const XAxisInner = memo(function XAxisInner({
  numTicks: numTicksProp,
  tickCount,
  ticks,
  orientation = "bottom",
  title,
  titlePlacement = "outside",
  maxTickTarget,
  tickerHalfWidth = 50,
  tickMode = "domain",
  tickFormat,
  tickValues: tickValuesProp,
  periodTicks = false,
  container,
}: XAxisProps & { container: HTMLDivElement; maxTickTarget?: number }) {
  const {
    xScale,
    margin,
    tooltipData,
    data,
    xAccessor,
    dateLabels,
    xDomain,
    xScaleType,
    width,
    height,
    innerWidth,
    innerHeight,
  } = useChart();

  const tickValues = tickValuesProp ?? dateTicks(ticks);
  const numericRuler = useContext(NumericXRulerContext);
  // RM-108: explicit `numTicks` > numeric `tickCount` > the width-derived
  // target; a density cap (`sm`) still bounds whichever wins.
  const resolvedTickTarget = resolveAxisTickTarget({
    numTicks: numTicksProp,
    tickCount,
    autoTarget: tickTargetForWidth(innerWidth),
  });
  const numTicks =
    maxTickTarget != null ? Math.min(resolvedTickTarget, maxTickTarget) : resolvedTickTarget;

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
  // RM-028: `periodTicks` generates real calendar Dates (one per day/week/
  // month) and interpolates them through the time scale — the same synthetic-
  // instant problem `tickFormat`/`tickValues` have on a band/linear axis, so
  // it is inert there too.
  const effectivePeriodTicks = isNonTimeScale ? false : periodTicks;

  // RM-028: one hairline tick per calendar period along the plot's bottom
  // edge — a SEPARATE layer from the labelled ticks above; it never affects
  // `labelsToShow`.
  const periodTickDates = useMemo(() => {
    if (!effectivePeriodTicks) {
      return null;
    }
    const [start, end] = xScale.domain();
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return generatePeriodTicks(effectivePeriodTicks, start, end);
  }, [effectivePeriodTicks, xScale]);

  // RM-108: a numeric ruler (ScatterChart numeric x with `domain`/`scale`) —
  // real raw-unit ticks, formatted as ONE set (#250), positioned through the
  // same projection the marks use.
  const rulerTickValues = useMemo(() => {
    if (!(numericRuler && xScaleType === "linear")) {
      return [];
    }
    const explicit = ticks?.filter((value): value is number => typeof value === "number");
    if (explicit && explicit.length > 0) {
      return explicit;
    }
    return valueAxisTicks(
      buildValueScale(numericRuler.scale, numericRuler.domain, [0, 1]),
      numTicks,
    );
  }, [numericRuler, xScaleType, ticks, numTicks]);
  const formatRulerValue = useChartValueSetFormatter(rulerTickValues);

  const labelsToShow = useMemo(() => {
    if (numericRuler && rulerTickValues.length > 0) {
      return rulerTickValues.map((value) => {
        const date = numericRuler.toPosition(value);
        return { date, label: formatRulerValue(value), x: (xScale(date) ?? 0) + margin.left };
      });
    }
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
    numericRuler,
    rulerTickValues,
    formatRulerValue,
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

  const warnedNonTimePeriodTicksRef = useRef(false);
  useEffect(() => {
    if (
      isNonTimeScale &&
      periodTicks &&
      !warnedNonTimePeriodTicksRef.current &&
      process.env.NODE_ENV !== "production"
    ) {
      warnedNonTimePeriodTicksRef.current = true;
      console.warn(
        "[XAxis] `periodTicks` generates real calendar dates and is ignored on a non-time x-scale " +
          '(xScale="band" | "linear"), for the same reason as `tickFormat`/`tickValues` — the scale\'s ' +
          "instants are synthetic positions, not calendar dates.",
      );
    }
  }, [isNonTimeScale, periodTicks]);

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
    <>
      {periodTickDates && periodTickDates.length > 0 ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          data-slot="x-axis-period-ticks"
          height={height}
          width={width}
        >
          <HairlineFloor
            every={(date: Date) => isLongPeriodTick(effectivePeriodTicks as XAxisPeriodTicks, date)}
            longHeight={7}
            // The long tick is the mark's ONLY navigational cue (#253) — give
            // it a rung a reader can actually resolve. Short ticks stay at
            // the default `--chart-grid` weight; this is grid FURNITURE, so
            // a token, never a literal.
            longStroke="var(--chart-foreground-muted)"
            periods={periodTickDates}
            scale={(date: Date) => {
              const x = xScale(date);
              return x === undefined ? undefined : x + margin.left;
            }}
            y={margin.top + innerHeight}
          />
        </svg>
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        data-orientation={orientation}
        data-slot="x-axis"
        data-tick-count={labelsToShow.length}
      >
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
            orientation={orientation}
            tickerHalfWidth={tickerHalfWidth}
            x={item.x}
          />
        ))}
        <AxisTitle
          height={height}
          innerHeight={innerHeight}
          innerWidth={innerWidth}
          margin={margin}
          placement={titlePlacement}
          side={orientation}
          width={width}
        >
          {title}
        </AxisTitle>
      </div>
    </>,
    container,
  );
});

XAxis.displayName = "XAxis";

export default XAxis;
