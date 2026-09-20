"use client";

import { memo, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { HairlineFloor } from "../marks/hairline-floor";
import { AxisTitle, type AxisTitlePlacement } from "./axis-title";
import { CHART_DENSITY_SM_MAX_TICKS, useChartConfig } from "./chart-config-context";
import { useChart, useChartStable } from "./chart-context";
import { useChartFrameSeriesBridge } from "../chart-frame/inline-chip";
import { makeDateFmtForPreset, shortDateFmt } from "./chart-formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { dateFormatForSpan, finerDateFormatPreset, type DateFormatPreset } from "./date-format";
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
   * `tickTargetForWidth(innerWidth)`, about one tick per 90 px, clamped 2–10,
   * and never more than the number of data rows on a time axis (6 monthly
   * rows get at most 6 ticks, not 9 labels between them).
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
   * The date-format LADDER (RM-109): a preset from `date-format.ts`
   * (`"year"` → `"yearShort"` → `"month"` → `"day"` → `"weekday"` →
   * `"hour"` → `"minute"`), or a formatter function for full control.
   *
   * Unset (default) — the axis picks a rung itself via `dateFormatForSpan`,
   * from the time domain's span and how many ticks are on screen, instead of
   * the old fixed `"Mon d"` shape whatever the span. A ten-year series reads
   * years; a 36-hour series reads hours.
   *
   * `tickFormat` still wins outright when both are set — it is the raw
   * escape hatch this package has always had; `dateFormat` is the smart
   * default underneath it. Same time-scale-only caveat as `tickFormat` (#352).
   */
  dateFormat?: DateFormatPreset | ((value: Date) => string);
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
  // RM-109: the span/width ladder's fallback when neither `tickFormat` nor a
  // `dateLabels` entry names the label — defaults to the pre-RM-109 shape so
  // an external caller of the (exported) `selectEvenlySpacedIndices` sees no
  // behaviour change unless it opts in.
  dateFormatFn: (value: Date) => string = (value) => shortDateFmt.format(value),
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
      : (dateLabels[index] ?? dateFormatFn(xAccessor(point)));
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
    /** RM-109: the date-ladder fallback threaded to `dedupeIndicesByLabel`. */
    dateFormatFn?: (value: Date) => string;
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

  // RM-127 (a-4): the layout search below walks indices in DATA order and
  // scores the PIXEL gap between neighbours, which only reads as "evenly
  // spaced on screen" while data order matches x order. That holds for a time
  // or band axis (both are built in order) but not for a numeric x
  // (`xScaleType: "linear"`, e.g. a scatter), where the rows arrive in
  // whatever order the caller has them — there `resolveXPx(next) -
  // resolveXPx(prev)` goes negative and the winning layout can put two ticks a
  // few pixels apart. Rank the rows by their painted x first, search in that
  // order, then map the winners back to their real indices. Sorted input is
  // the identity permutation, so every existing axis is byte-identical.
  const byPosition = Array.from({ length }, (_, index) => index).sort(
    (a, b) => resolveXPx(a) - resolveXPx(b),
  );
  if (byPosition.some((index, rank) => index !== rank)) {
    const data = options?.data;
    const dateLabels = options?.dateLabels;
    return selectEvenlySpacedIndices(length, targetCount, {
      ...options,
      data: data ? byPosition.map((index) => data[index] ?? {}) : undefined,
      dateLabels: dateLabels ? byPosition.map((index) => dateLabels[index] ?? "") : undefined,
      resolveXPx: (rank) => resolveXPx(byPosition[rank] ?? rank),
    }).map((rank) => byPosition[rank] ?? rank);
  }

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
              options.dateFormatFn,
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
  dateFormatFn,
  marginLeft,
  targetTickCount,
  tickFormat,
  xAccessor,
  xScale,
}: {
  data: Record<string, unknown>[];
  dateLabels: string[];
  /** RM-109: the date-ladder fallback used once neither `tickFormat` nor `dateLabels` names a label. */
  dateFormatFn?: (value: Date) => string;
  marginLeft: number;
  targetTickCount: number;
  tickFormat?: (value: Date) => string;
  xAccessor: (d: Record<string, unknown>) => Date;
  xScale: (date: Date) => number | undefined;
}): AxisTick[] {
  const seenLabels = new Set<string>();
  const ticks: AxisTick[] = [];
  const resolveDateLabel = dateFormatFn ?? ((value: Date) => shortDateFmt.format(value));

  const resolveXPx = (index: number) => {
    const point = data[index];
    if (!point) {
      return index;
    }
    return xScale(xAccessor(point)) ?? 0;
  };

  for (const index of selectEvenlySpacedIndices(data.length, targetTickCount, {
    data,
    dateFormatFn,
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
    const label = tickFormat ? tickFormat(date) : (dateLabels[index] ?? resolveDateLabel(date));
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

/**
 * Date-ladder round (#478), tick-STEP pass.
 *
 * `xScale.ticks(count)` — d3-time's own "nice" algorithm — only offers a
 * COARSE candidate list per calendar unit (months jump straight from a
 * 1-month step to a 3-month step, with nothing in between; years jump 1 → 2
 * → 5 → 10). RM-108's width-derived tick TARGET moves in much finer
 * increments (roughly one more tick per 90 px), so asking d3 for a count
 * that falls between two of its own steps either undershoots badly (a
 * request of 3 can return 2) or, worse, overshoots straight past the target
 * band in the other direction. {@link chooseCalendarTicks} below picks a
 * STEP directly from a denser ladder instead of asking d3 to infer one from
 * a bare count.
 */
type CalendarStepUnit = "hour" | "day" | "week" | "month" | "year";

interface CalendarStep {
  unit: CalendarStepUnit;
  step: number;
}

/**
 * Finest → coarsest. {@link chooseCalendarTicks} walks this once, scoring
 * every step's resulting tick count against the target band — the ladder
 * itself does not need to be searched in a particular direction.
 */
const CALENDAR_STEP_LADDER: readonly CalendarStep[] = [
  { unit: "hour", step: 1 },
  { unit: "hour", step: 2 },
  { unit: "hour", step: 3 },
  { unit: "hour", step: 6 },
  { unit: "hour", step: 12 },
  { unit: "day", step: 1 },
  { unit: "day", step: 2 },
  { unit: "week", step: 1 },
  { unit: "month", step: 1 },
  { unit: "month", step: 3 },
  { unit: "month", step: 6 },
  { unit: "year", step: 1 },
  { unit: "year", step: 2 },
  { unit: "year", step: 5 },
  { unit: "year", step: 10 },
  { unit: "year", step: 20 },
];

/** A degenerate domain (e.g. a huge span at a 1-hour step) can never spin past this. */
const CALENDAR_STEP_TICK_CAP = 500;

/** Every `step`-hour boundary in `[start, end]`, starting from the first one `>= start`. */
function alignedHourTicks(start: Date, end: Date, step: number): Date[] {
  const dayStart = atLocalMidnight(start);
  let hour = Math.floor(start.getHours() / step) * step;
  let cursor = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), hour);
  while (cursor.getTime() < start.getTime()) {
    hour += step;
    cursor = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), hour);
  }
  const endTime = end.getTime();
  const ticks: Date[] = [];
  while (cursor.getTime() <= endTime && ticks.length < CALENDAR_STEP_TICK_CAP) {
    ticks.push(new Date(cursor));
    hour += step;
    cursor = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), hour);
  }
  return ticks;
}

/** Every `stepDays`-day boundary in `[start, end]`, rooted at `start`'s own local midnight. */
function alignedDayTicks(start: Date, end: Date, stepDays: number): Date[] {
  let cursor = atLocalMidnight(start);
  while (cursor.getTime() < start.getTime()) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays);
  }
  const endTime = end.getTime();
  const ticks: Date[] = [];
  while (cursor.getTime() <= endTime && ticks.length < CALENDAR_STEP_TICK_CAP) {
    ticks.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays);
  }
  return ticks;
}

/**
 * Every `step`-month boundary in `[start, end]`, aligned WITHIN each year
 * (step 3 → Jan/Apr/Jul/Oct, step 6 → Jan/Jul) — the same alignment d3-time's
 * own month interval uses, so a 3- or 6-month step reads as a familiar
 * quarter/half-year cadence rather than an arbitrary offset from `start`.
 */
function alignedMonthTicks(start: Date, end: Date, step: number): Date[] {
  const year = start.getFullYear();
  let month = Math.floor(start.getMonth() / step) * step;
  let cursor = new Date(year, month, 1);
  while (cursor.getTime() < start.getTime()) {
    month += step;
    cursor = new Date(year, month, 1);
  }
  const endTime = end.getTime();
  const ticks: Date[] = [];
  while (cursor.getTime() <= endTime && ticks.length < CALENDAR_STEP_TICK_CAP) {
    ticks.push(new Date(cursor));
    month += step;
    cursor = new Date(year, month, 1);
  }
  return ticks;
}

/**
 * Every `step`-year boundary in `[start, end]`, aligned to a multiple of
 * `step` (step 5 → …2010, 2015, 2020…) — matches d3-time's own year interval
 * alignment (confirmed against `d3-scale`'s `scaleTime().ticks()` output for
 * the same domain).
 */
function alignedYearTicks(start: Date, end: Date, step: number): Date[] {
  let year = Math.floor(start.getFullYear() / step) * step;
  while (new Date(year, 0, 1).getTime() < start.getTime()) {
    year += step;
  }
  const endTime = end.getTime();
  const ticks: Date[] = [];
  while (new Date(year, 0, 1).getTime() <= endTime && ticks.length < CALENDAR_STEP_TICK_CAP) {
    ticks.push(new Date(year, 0, 1));
    year += step;
  }
  return ticks;
}

function calendarStepTicks(start: Date, end: Date, { unit, step }: CalendarStep): Date[] {
  switch (unit) {
    case "hour":
      return alignedHourTicks(start, end, step);
    case "day":
      return alignedDayTicks(start, end, step);
    case "week":
      return alignedDayTicks(start, end, step * 7);
    case "month":
      return alignedMonthTicks(start, end, step);
    case "year":
      return alignedYearTicks(start, end, step);
    default:
      return [];
  }
}

// A deliberately rough per-character width estimate — no canvas metrics are
// available in this pure layout function, and none are needed: the estimate
// only has to tell "obviously too many characters for this plot" from
// "obviously fits", for the label-fit tie-break in `chooseCalendarTicks`.
const CALENDAR_TICK_CHAR_PX = 7;
const CALENDAR_TICK_GAP_PX = 8;

function estimateTickSetWidthPx(count: number, sampleLabel: string): number {
  return count * (sampleLabel.length * CALENDAR_TICK_CHAR_PX + CALENDAR_TICK_GAP_PX);
}

/** The widest label a tick set paints, for {@link estimateTickSetWidthPx}. */
function widestLabel(ticks: Date[], resolveDateLabel: (date: Date) => string): string {
  let widest = "";
  for (const tick of ticks) {
    const label = resolveDateLabel(tick);
    if (label.length > widest.length) {
      widest = label;
    }
  }
  return widest;
}

/**
 * Thins a calendar tick set by an integer STRIDE until its labels fit the plot
 * (RM-127, b-2). `chooseCalendarStep` picks the sparsest step whose COUNT
 * lands in the target band, but on a narrow plot even that step can be too
 * dense and there may be no sparser step in the band at all — a 20-week domain
 * offers a 1-month step (4 ticks) and then nothing until a 3-month step (1
 * tick), so the 4 labels were kept and printed through each other: measured on
 * `patterns-blocks-infographics-annotated-trend--compact`, "May 26"/"Jun 26"
 * overlapped by 110.4 px², "Jun 26"/"Jul 26" by 68.8 px², "Jul 26"/"Aug 26" by
 * 64.0 px².
 *
 * Taking every 2nd (then 3rd, …) tick keeps the cadence calendar-aligned and
 * the step's own UNIT intact (the format rung reads the unit, not the count),
 * which is how an editorial time axis thins. Never goes below two ticks — an
 * axis still names both ends of its domain — and a set that already fits is
 * returned untouched.
 */
function thinTicksToFit(
  ticks: Date[],
  plotWidthPx: number,
  resolveDateLabel: (date: Date) => string,
): Date[] {
  if (ticks.length <= 2 || !Number.isFinite(plotWidthPx) || plotWidthPx <= 0) {
    return ticks;
  }
  const label = widestLabel(ticks, resolveDateLabel);
  const maxStride = Math.ceil(ticks.length / 2);
  for (let stride = 1; stride <= maxStride; stride++) {
    const thinned = ticks.filter((_, index) => index % stride === 0);
    if (thinned.length <= 2 || estimateTickSetWidthPx(thinned.length, label) <= plotWidthPx) {
      return thinned;
    }
  }
  return ticks;
}

/**
 * Picks a calendar STEP (from {@link CALENDAR_STEP_LADDER}) whose resulting
 * tick count lands in a band around `targetCount` — `[targetCount − 1,
 * targetCount + 2]`, clamped to 2–10 (RM-108's own tick-target clamp) —
 * instead of asking d3's `.ticks(count)` to infer one, whose own per-unit
 * step list is coarser and can jump straight past the band. When more than
 * one step's count lands in the band, the DENSER one wins if its labels
 * still fit the plot width (`estimateTickSetWidthPx` — label width × count,
 * plus a gap, under `plotWidthPx`); otherwise the sparser one does. When NO
 * step's count lands in the band (an unusual domain), the step whose count
 * is numerically closest to `targetCount` wins, fewer ticks breaking a tie.
 *
 * Returns the chosen {@link CalendarStep} alongside its ticks — the caller
 * (`XAxisInner`'s ladder-rung resolution, tick-step round #478) reads the
 * STEP's own UNIT directly for the format rung, rather than re-deriving one
 * from the resulting tick count: the two are not interchangeable. A 12-hour
 * step, for example, has the same average gap as `dateFormatForSpan`'s
 * `"weekday"` bucket (6–24 h) by raw arithmetic, but it is still a clock-time
 * cadence, not a multi-day one — `presetForCalendarStep` maps it to `"hour"`
 * directly from its unit instead.
 */
function chooseCalendarStep(
  start: Date,
  end: Date,
  targetCount: number,
  plotWidthPx: number,
  resolveDateLabel: (date: Date) => string,
): { step: CalendarStep; ticks: Date[] } | null {
  const lowerBound = Math.max(2, targetCount - 1);
  const upperBound = Math.min(10, targetCount + 2);
  const candidates = CALENDAR_STEP_LADDER.map((candidateStep) => ({
    step: candidateStep,
    ticks: calendarStepTicks(start, end, candidateStep),
  })).filter((candidate) => candidate.ticks.length > 0);

  if (candidates.length === 0) {
    return null;
  }

  const inBand = candidates.filter(
    (candidate) => candidate.ticks.length >= lowerBound && candidate.ticks.length <= upperBound,
  );

  // b-2: whichever candidate wins below, its labels still have to fit — the
  // ladder's steps are coarse, so the sparsest one IN the band can be denser
  // than the plot can print. `thinTicksToFit` takes every 2nd/3rd tick of the
  // winner, keeping the step (and so the format rung) it chose.
  const fitted = (candidate: { step: CalendarStep; ticks: Date[] }) => ({
    step: candidate.step,
    ticks: thinTicksToFit(candidate.ticks, plotWidthPx, resolveDateLabel),
  });

  if (inBand.length === 0) {
    let closest = candidates[0]!;
    let closestDiff = Math.abs(closest.ticks.length - targetCount);
    for (const candidate of candidates) {
      const diff = Math.abs(candidate.ticks.length - targetCount);
      if (
        diff < closestDiff ||
        (diff === closestDiff && candidate.ticks.length < closest.ticks.length)
      ) {
        closest = candidate;
        closestDiff = diff;
      }
    }
    return fitted(closest);
  }

  const densestFirst = [...inBand].sort((a, b) => b.ticks.length - a.ticks.length);
  for (const candidate of densestFirst) {
    const sampleLabel = resolveDateLabel(candidate.ticks[0] ?? start);
    if (estimateTickSetWidthPx(candidate.ticks.length, sampleLabel) <= plotWidthPx) {
      return candidate;
    }
  }
  return fitted(densestFirst[densestFirst.length - 1]!);
}

/** `chooseCalendarStep`'s ticks only — `buildDomainTicks`'s own entry point. */
function chooseCalendarTicks(
  start: Date,
  end: Date,
  targetCount: number,
  plotWidthPx: number,
  resolveDateLabel: (date: Date) => string,
): Date[] {
  return chooseCalendarStep(start, end, targetCount, plotWidthPx, resolveDateLabel)?.ticks ?? [];
}

/**
 * The {@link DateFormatPreset} rung for a calendar-step UNIT directly (tick-
 * step round, #478) — bypasses `dateFormatForSpan`'s gap-based thresholds on
 * this path, which were built for the old linear-interpolation tick scheme
 * and do not line up with the discrete `CALENDAR_STEP_LADDER` units (see
 * {@link chooseCalendarStep}'s doc comment). `"week"` reads as `"weekday"` —
 * the one rung that names which day of the week a tick lands on, matching a
 * 7-day cadence; every other unit maps to its like-named preset one-to-one.
 */
function presetForCalendarStep(unit: CalendarStepUnit, cramped: boolean): DateFormatPreset {
  switch (unit) {
    case "hour":
      return "hour";
    case "day":
      return "day";
    case "week":
      return "weekday";
    case "month":
      return "month";
    case "year":
      return cramped ? "yearShort" : "year";
    default:
      return "day";
  }
}

function buildDomainTicks({
  marginLeft,
  numTicks,
  plotWidthPx = Number.POSITIVE_INFINITY,
  preferCalendarAlignment = true,
  tickFormat,
  dateFormatFn,
  xScale,
}: {
  marginLeft: number;
  numTicks: number;
  /**
   * The plot's own inner width (RM-108's `innerWidth`) — the label-fit
   * tie-break in `chooseCalendarTicks` needs it. Unset (e.g. a test that
   * builds a bare `xScale` stub) never rejects a denser candidate on
   * width grounds.
   */
  plotWidthPx?: number;
  /**
   * Date-ladder round (#478): prefer a calendar-aligned STEP (see
   * `chooseCalendarTicks`) over the plain interpolation below. `true` (the
   * AUTO count path) by default; an EXPLICIT `numTicks`/`tickCount` pin
   * passes `false` to keep the exact count it asked for — no calendar-step
   * algorithm promises an exact count, only a "nice" one near it, and
   * pinning an exact count is the whole point of the explicit prop.
   */
  preferCalendarAlignment?: boolean;
  tickFormat?: (value: Date) => string;
  /** RM-109: the date-ladder fallback — replaces the old fixed `"Mon d"` shape. */
  dateFormatFn?: (value: Date) => string;
  xScale: {
    domain: () => Date[];
    ticks?: (count?: number) => Date[];
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

  const tickCount = Math.max(2, numTicks);
  const seenLabels = new Set<string>();
  const ticks: AxisTick[] = [];
  const resolveDateLabel = dateFormatFn ?? ((value: Date) => shortDateFmt.format(value));

  // RM-109 date-ladder round, tick-STEP pass (#478): a calendar-aligned STEP
  // from `chooseCalendarTicks` — never the arbitrary instants a straight
  // `startTime + i/(tickCount-1) * timeRange` interpolation produces (which
  // is what this loop did originally — it does not know what a "year" is,
  // so it happily lands on `2019-04-22` and skips `2021`), and denser than
  // `xScale.ticks(count)`'s own coarse per-unit step list (months only offer
  // a 1- or 3-month step; years only 1, 2, 5, 10 — both can jump straight
  // past the width-derived target band). Only taken on the AUTO count path
  // (see `preferCalendarAlignment`); falls back to the old interpolation
  // otherwise, or if the domain is degenerate (`chooseCalendarTicks` found
  // no candidate at all).
  const dateTicksFromScale = preferCalendarAlignment
    ? chooseCalendarTicks(startDate, endDate, tickCount, plotWidthPx, resolveDateLabel)
    : undefined;
  const timeRange = endTime - startTime;
  const candidateDates =
    dateTicksFromScale && dateTicksFromScale.length > 0
      ? dateTicksFromScale
      : Array.from(
          { length: tickCount },
          (_, i) => new Date(startTime + (i / (tickCount - 1)) * timeRange),
        );

  // Tick-step round (#478): the label-collision de-dupe below exists for the
  // FALLBACK interpolation path, whose arbitrary instants can format to an
  // accidentally-identical string (two nearby-but-distinct dates both
  // rounding to the same day, say). Calendar-step ticks are already
  // guaranteed DISTINCT dates by construction (`chooseCalendarStep`/
  // `calendarStepTicks` never repeats a timestamp) — an identical rendered
  // string on that path (two midnights, a day apart, both reading "00:00" on
  // the hour rung) is a legitimate periodic repeat, not a collision, so it
  // is never de-duped away.
  const usingCalendarTicks = dateTicksFromScale != null && dateTicksFromScale.length > 0;
  for (const date of candidateDates) {
    const label = tickFormat ? tickFormat(date) : resolveDateLabel(date);
    if (!usingCalendarTicks) {
      if (seenLabels.has(label)) {
        continue;
      }
      seenLabels.add(label);
    }
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
  // RM-117: hand the chart's series colours to an enclosing ChartFrame
  // (read by InlineChip). No visual change; a no-op outside a frame.
  useChartFrameSeriesBridge();
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
        // RM-107's narrow breakpoint forces `sm` by default (ADR 0039) — the
        // one signal this axis already trusts for "no room" (it is why the
        // value axis and legend disappear here too), so the date-ladder's
        // year rung reads it the same way (date-ladder round, #478).
        cramped
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
  cramped = false,
  tickerHalfWidth = 50,
  tickMode = "domain",
  tickFormat,
  dateFormat,
  tickValues: tickValuesProp,
  periodTicks = false,
  container,
}: XAxisProps & { container: HTMLDivElement; maxTickTarget?: number; cramped?: boolean }) {
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
  const { locale } = useLocale();

  const tickValues = tickValuesProp ?? dateTicks(ticks);
  const numericRuler = useContext(NumericXRulerContext);
  // RM-108: explicit `numTicks` > numeric `tickCount` > the width-derived
  // target; a density cap (`sm`) still bounds whichever wins. Resolved BEFORE
  // the RM-109 date ladder below, which needs this same number for its
  // finer rungs (month/day/weekday/hour/minute) — the year rung's own
  // `"year"`/`"yearShort"` choice reads `cramped` (RM-107's narrow
  // breakpoint) instead; see `dateFormatForSpan`'s doc comment.
  const widthTarget = tickTargetForWidth(innerWidth);
  const resolvedTickTarget = resolveAxisTickTarget({
    numTicks: numTicksProp,
    tickCount,
    autoTarget: numericRuler ? widthTarget : Math.min(widthTarget, Math.max(2, data.length)),
  });
  const numTicks =
    maxTickTarget != null ? Math.min(resolvedTickTarget, maxTickTarget) : resolvedTickTarget;
  // Date-ladder round (#478): a fully AUTO count (neither `numTicks` nor a
  // numeric `tickCount` pinned — `resolveAxisTickTarget`'s own precedence,
  // re-read here) prefers d3's calendar-aligned `.ticks()` in
  // `buildDomainTicks` below; an EXPLICIT pin keeps the exact count it asks
  // for (that IS the point of pinning it — d3's own tick algorithm never
  // promises an exact count, only a "nice" one near it).
  const isAutoTickTarget = numTicksProp == null && (tickCount == null || tickCount === "auto");

  // #352: a band/linear axis' domain holds SYNTHETIC instants (see the full
  // comment where this fed `effectiveTickFormat` etc. below) — read early so
  // the tick-STEP preview right after it can gate on it too.
  const isNonTimeScale = xScaleType != null && xScaleType !== "time";

  // Tick-step round (#478): `buildDomainTicks` picks a calendar STEP
  // (`chooseCalendarStep`/`chooseCalendarTicks`) only on the fully-auto,
  // time-scale, non-data-aligned path — the same gate `labelsToShow` below
  // uses to choose between `buildDomainTicks` and `buildDataAlignedTicks`.
  const usesCalendarStepSelection =
    isAutoTickTarget && !isNonTimeScale && tickMode !== "data" && xDomain == null;

  // RM-109 date-ladder round (#478), tick-step round: the ladder rung this
  // axis paints, resolved once per render — `dateFormat` as an explicit
  // preset wins outright; a function is honoured as-is (same escape hatch as
  // `tickFormat`). Otherwise, on the calendar-step path this reads the rung
  // straight off the STEP `chooseCalendarStep` actually picked
  // (`presetForCalendarStep`) rather than re-deriving one from the raw
  // width-derived target (which can pick a coarser rung than the step
  // actually painted — see `chooseCalendarStep`'s doc comment) or from the
  // resulting tick COUNT (whose average gap can cross `dateFormatForSpan`'s
  // thresholds by a hair on a real, non-uniform calendar span — a 3652-day,
  // 10-tick span is a shade under `dateFormatForSpan`'s idealised 365.25-day
  // year, for example). Every other path (`tickMode="data"`, a pinned
  // `xDomain`, a non-time scale) keeps the original span/target-based
  // `dateFormatForSpan` call. `cramped` (RM-107's narrow breakpoint,
  // `density === "sm"`) is what actually swings the year rung between
  // `"year"` and `"yearShort"` — a ten-year series reads `’16 ’18 …` at
  // narrow (density forces `sm`) and `2016 … 2025` at medium/wide.
  const ladderPreset = useMemo<DateFormatPreset>(() => {
    if (dateFormat != null && typeof dateFormat !== "function") {
      return dateFormat;
    }
    const [start, end] = xScale.domain();
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "day";
    }
    if (usesCalendarStepSelection) {
      const resolved = chooseCalendarStep(start, end, Math.max(2, numTicks), innerWidth, (value) =>
        shortDateFmt.format(value),
      );
      if (resolved) {
        return presetForCalendarStep(resolved.step.unit, cramped);
      }
    }
    return dateFormatForSpan([start, end], numTicks, locale, { cramped });
  }, [dateFormat, xScale, usesCalendarStepSelection, numTicks, innerWidth, cramped, locale]);

  // The axis' own tick formatter for the resolved rung.
  const ladderDateFormat = useMemo(
    () =>
      typeof dateFormat === "function" ? dateFormat : makeDateFmtForPreset(locale, ladderPreset),
    [dateFormat, locale, ladderPreset],
  );
  // Tooltips/hover read the FINER sibling rung (RM-109) — an axis showing
  // "year" ticks still wants a hovered point to read "month", not repeat the
  // same year the visible tick already named.
  const hoveredDateFormat = useMemo(
    () =>
      typeof dateFormat === "function"
        ? dateFormat
        : makeDateFmtForPreset(locale, finerDateFormatPreset(ladderPreset)),
    [dateFormat, locale, ladderPreset],
  );

  // #352: on a band/linear axis the scale's domain holds SYNTHETIC instants, so
  // interpolating dates across it (the `"domain"` tick path) would invent
  // positions that belong to no data row and have no label. Categorical and
  // numeric axes therefore always take the data-aligned path, which reads its
  // labels from `dateLabels` — i.e. the caller's own x values. (`isNonTimeScale`
  // itself is resolved above, alongside `ladderTickCount`, which needs it too.)

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
  // RM-109: the ladder is a Date-shaped default formatter, same #352 exemption
  // as `tickFormat`/`tickValues` — a non-time scale's labels come from
  // `dateLabels` (the caller's own x values), never a fabricated calendar date.
  const effectiveDateFormat = isNonTimeScale ? undefined : ladderDateFormat;
  const effectiveHoveredDateFormat = isNonTimeScale ? undefined : hoveredDateFormat;
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
      const resolveDateLabel =
        effectiveTickFormat ?? effectiveDateFormat ?? ((date: Date) => shortDateFmt.format(date));
      return effectiveTickValues.map((date) => ({
        date,
        label: resolveDateLabel(date),
        x: (xScale(date) ?? 0) + margin.left,
      }));
    }

    // Brush (any extent): snap ticks to data rows with even index spacing.
    if (tickMode === "data" || xDomain != null || isNonTimeScale) {
      return buildDataAlignedTicks({
        data,
        dateFormatFn: effectiveDateFormat,
        dateLabels,
        marginLeft: margin.left,
        targetTickCount: numTicks,
        tickFormat: effectiveTickFormat,
        xAccessor,
        xScale,
      });
    }

    return buildDomainTicks({
      dateFormatFn: effectiveDateFormat,
      marginLeft: margin.left,
      numTicks,
      plotWidthPx: innerWidth,
      preferCalendarAlignment: isAutoTickTarget,
      tickFormat: effectiveTickFormat,
      xScale,
    });
  }, [
    numericRuler,
    rulerTickValues,
    formatRulerValue,
    effectiveTickValues,
    effectiveTickFormat,
    effectiveDateFormat,
    tickMode,
    xDomain,
    isNonTimeScale,
    data,
    dateLabels,
    xAccessor,
    xScale,
    margin.left,
    numTicks,
    isAutoTickTarget,
    innerWidth,
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
        : (dateLabels[tooltipData.index] ??
          (effectiveHoveredDateFormat ?? shortDateFmt.format)(xAccessor(tooltipData.point)))
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
