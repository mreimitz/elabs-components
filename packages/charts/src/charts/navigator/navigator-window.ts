/**
 * navigator-window.ts — the pure window maths behind `ChartNavigator` (RM-140,
 * ADR 0040 §2). Framework-free: every function takes plain numbers.
 *
 * Internally a window is a NUMERIC span — milliseconds for a `time` window, a
 * row index for an `index` window (`start` inclusive, `end` exclusive) — so one
 * set of clamp / shift / zoom rules serves both kinds. `toNumericWindow` /
 * `fromNumericWindow` convert at the edges.
 */

import type { NavigatorWindow } from "./types";

/** A window as two numbers on the navigator's value axis. */
export interface NumericWindow {
  start: number;
  end: number;
}

/** The full data extent on the value axis: `[min, max]`. */
export type NumericExtent = readonly [number, number];

export type NavigatorWindowKind = NavigatorWindow["kind"];

/** Default `minSpan` for an index window, in rows. */
export const DEFAULT_INDEX_MIN_SPAN = 3;

/** the stock-chart library' rule: a time window is never narrower than this many median steps. */
export const TIME_MIN_SPAN_STEPS = 5;

// ── Conversions ──────────────────────────────────────────────────────────────

/** A `NavigatorWindow` as numbers (ms for time, row index for index). */
export function toNumericWindow(window: NavigatorWindow): NumericWindow {
  return window.kind === "time"
    ? { start: window.start.getTime(), end: window.end.getTime() }
    : { start: window.start, end: window.end };
}

/** Numbers back to a `NavigatorWindow`; index windows round to whole rows. */
export function fromNumericWindow(
  kind: NavigatorWindowKind,
  window: NumericWindow,
): NavigatorWindow {
  if (kind === "time") {
    return { kind: "time", start: new Date(window.start), end: new Date(window.end) };
  }
  return { kind: "index", start: Math.round(window.start), end: Math.round(window.end) };
}

/** Two windows cover the same span (index windows compare after rounding). */
export function sameNumericWindow(a: NumericWindow, b: NumericWindow): boolean {
  return a.start === b.start && a.end === b.end;
}

// ── Steps and minSpan ────────────────────────────────────────────────────────

/** The median positive gap between consecutive values; `0` with fewer than two. */
export function medianStep(values: readonly number[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const gap = Math.abs((values[i] as number) - (values[i - 1] as number));
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 === 1
    ? (gaps[mid] as number)
    : ((gaps[mid - 1] as number) + (gaps[mid] as number)) / 2;
}

/**
 * The default smallest window: 5× the median step for time (the stock-chart library), or
 * `DEFAULT_INDEX_MIN_SPAN` rows for index. `times` are the rows' x values in ms.
 */
export function defaultMinSpan(kind: NavigatorWindowKind, times: readonly number[] = []): number {
  if (kind === "index") return DEFAULT_INDEX_MIN_SPAN;
  return medianStep(times) * TIME_MIN_SPAN_STEPS;
}

// ── Clamp / shift / zoom ─────────────────────────────────────────────────────

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The legal window closest to `window`: ordered, at least `minSpan` wide (grown
 * around its centre), never wider than the extent, and inside the extent
 * (shifted in, keeping its span).
 */
export function clampWindow(
  window: NumericWindow,
  extent: NumericExtent,
  minSpan = 0,
): NumericWindow {
  const [lo, hi] = extent[0] <= extent[1] ? extent : [extent[1], extent[0]];
  const full = hi - lo;
  let start = Math.min(window.start, window.end);
  let end = Math.max(window.start, window.end);
  const floor = Math.min(Math.max(0, minSpan), full);
  let span = end - start;
  if (span < floor) {
    const centre = (start + end) / 2;
    span = floor;
    start = centre - span / 2;
    end = centre + span / 2;
  }
  if (span > full) {
    return { start: lo, end: hi };
  }
  if (start < lo) {
    start = lo;
    end = lo + span;
  }
  if (end > hi) {
    end = hi;
    start = hi - span;
  }
  return { start, end };
}

/** Move the window by `delta`, keeping its span, stopping at the extent. */
export function shiftWindow(
  window: NumericWindow,
  delta: number,
  extent: NumericExtent,
): NumericWindow {
  const span = window.end - window.start;
  const [lo, hi] = extent;
  const start = clampNumber(window.start + delta, lo, Math.max(lo, hi - span));
  return { start, end: start + span };
}

/**
 * Scale the window's span by `factor` (< 1 zooms in) around `anchor` (a value on
 * the axis; default the window's centre), then clamp.
 */
export function zoomWindow(
  window: NumericWindow,
  factor: number,
  extent: NumericExtent,
  minSpan = 0,
  anchor = (window.start + window.end) / 2,
): NumericWindow {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const start = anchor - (anchor - window.start) * safeFactor;
  const end = anchor + (window.end - anchor) * safeFactor;
  return clampWindow({ start, end }, extent, minSpan);
}

/**
 * Move ONE edge to `value`, the other edge fixed. The moving edge stops
 * `minSpan` short of the fixed one and at the extent.
 */
export function moveWindowEdge(
  window: NumericWindow,
  edge: "start" | "end",
  value: number,
  extent: NumericExtent,
  minSpan = 0,
): NumericWindow {
  const [lo, hi] = extent;
  const floor = Math.min(Math.max(0, minSpan), hi - lo);
  if (edge === "start") {
    const start = clampNumber(value, lo, Math.max(lo, window.end - floor));
    return { start, end: Math.max(window.end, start + floor) };
  }
  const end = clampNumber(value, Math.min(hi, window.start + floor), hi);
  return { start: Math.min(window.start, end - floor), end };
}

/** A window of `span` centred on `value`, clamped. */
export function centreWindowOn(
  window: NumericWindow,
  value: number,
  extent: NumericExtent,
): NumericWindow {
  const span = window.end - window.start;
  return shiftWindow(window, value - span / 2 - window.start, extent);
}

/**
 * The automatic first window: `span` wide, at the extent's start (`"start"`) or
 * its end (`"end"`, the associative BI suite `scrollStartPos: 1`). No span → the whole extent.
 */
export function initialWindow(
  align: "start" | "end",
  extent: NumericExtent,
  span?: number,
): NumericWindow {
  const [lo, hi] = extent;
  const full = hi - lo;
  const width = span == null || !Number.isFinite(span) || span <= 0 ? full : Math.min(span, full);
  return align === "end" ? { start: hi - width, end: hi } : { start: lo, end: lo + width };
}

// ── Index ↔ time ─────────────────────────────────────────────────────────────

/**
 * The time of row `index` (clamped to the rows). `times` must be ascending. An
 * index at or past the end resolves to the last row — the exclusive end of an
 * index window maps onto the last row it covers.
 */
export function indexToTime(index: number, times: readonly number[]): number {
  if (times.length === 0) return Number.NaN;
  const i = clampNumber(Math.round(index), 0, times.length - 1);
  return times[i] as number;
}

/** The first row whose time is `>= time` (binary search; `times` ascending). */
export function timeToIndex(time: number, times: readonly number[]): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] as number) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** How many rows fall inside `[start, end]` (inclusive; `times` ascending). */
export function countRowsInWindow(window: NumericWindow, times: readonly number[]): number {
  const first = timeToIndex(window.start, times);
  const afterLast = timeToIndex(window.end + 1e-9, times);
  return Math.max(0, afterLast - first);
}

/** A time window in ms → the index window of the rows it covers. */
export function timeWindowToIndexWindow(
  window: NumericWindow,
  times: readonly number[],
): NumericWindow {
  const start = timeToIndex(window.start, times);
  const end = Math.max(start, timeToIndex(window.end + 1e-9, times));
  return { start, end };
}

/** An index window → the time window from its first to its last covered row. */
export function indexWindowToTimeWindow(
  window: NumericWindow,
  times: readonly number[],
): NumericWindow {
  return {
    start: indexToTime(window.start, times),
    end: indexToTime(Math.max(window.start, window.end - 1), times),
  };
}

// ── Pixels ───────────────────────────────────────────────────────────────────

/** A pixel range along the strip's main axis: `[startPx, endPx]`. */
export type PixelRange = readonly [number, number];

/** A value on the axis → its pixel. A zero-width extent maps to the range start. */
export function valueToPixel(value: number, extent: NumericExtent, range: PixelRange): number {
  const span = extent[1] - extent[0];
  if (span === 0) return range[0];
  return range[0] + ((value - extent[0]) / span) * (range[1] - range[0]);
}

/** A pixel → the value under it (not clamped). */
export function pixelToValue(pixel: number, extent: NumericExtent, range: PixelRange): number {
  const px = range[1] - range[0];
  if (px === 0) return extent[0];
  return extent[0] + ((pixel - range[0]) / px) * (extent[1] - extent[0]);
}

/** The window's two edges in pixels. */
export function windowToPixels(
  window: NumericWindow,
  extent: NumericExtent,
  range: PixelRange,
): { x0: number; x1: number } {
  return {
    x0: valueToPixel(window.start, extent, range),
    x1: valueToPixel(window.end, extent, range),
  };
}

/** Two pixels → the window between them (ordered, not clamped). */
export function pixelsToWindow(
  pixels: { x0: number; x1: number },
  extent: NumericExtent,
  range: PixelRange,
): NumericWindow {
  const a = pixelToValue(pixels.x0, extent, range);
  const b = pixelToValue(pixels.x1, extent, range);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}
