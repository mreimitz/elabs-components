/**
 * resolve-intent.ts — a settled gesture + the registered marks → ONE
 * `ChartSelectionIntent` (RM-142, ADR 0040 §3).
 *
 * - `field` is `selectionField ?? xDataKey` (the caller passes the resolved one).
 * - `values` are the DISTINCT categories of the hit marks, in data order. A
 *   measure-axis range (`range-y`) therefore yields the DIMENSION values whose
 *   measure falls in the range (the associative BI suite), not numbers.
 * - `datapoints` reuse the `ChartDatapoint` shape (`toChartDatapoint`).
 * - `gesture` carries the geometry in DATA units, converted through the
 *   family's own axes (`geometry.ts`).
 *
 * Pure: no React, no DOM.
 */

import type { ChartDatapoint } from "../chart-datapoint";
import type { GestureEngineMode, GesturePoint, GestureState } from "./gesture-machine";
import {
  bandCategoriesInRange,
  type GestureAxis,
  normalizeRect,
  pixelRangeToData,
  pixelToData,
  radialToPolygon,
  simplifyPath,
  snapToClose,
} from "./geometry";
import {
  type ChartMarkGeometry,
  hitsInBand,
  hitsInPolygon,
  hitsInRect,
  pointInRect,
  shapeBounds,
  shapeCenter,
  visibleOnly,
} from "./hit-test";
import type {
  ChartSelectionGeometry,
  ChartSelectionHitRule,
  ChartSelectionIntent,
  ChartSelectionValue,
} from "./types";

/** A click within this many px of a point / circle mark still hits it. */
export const CLICK_HIT_RADIUS = 8;

export interface ResolveIntentOptions {
  /** The field intents carry (`selectionField ?? xDataKey`). */
  field: string;
  /** The axis under plot x. */
  xAxis?: GestureAxis;
  /** The axis under plot y. */
  yAxis?: GestureAxis;
  /** Rect / lasso hit rule. Default `"overlap"`. */
  hitRule?: ChartSelectionHitRule;
  /** For a measure-axis range: the series whose measure is read. Default: every series. */
  of?: string;
  /**
   * The field a ROW range (`range-y` over a band axis whose marks carry
   * `crossCategory`, i.e. a heatmap's rows) reports. Unset → rows resolve like
   * any other range, to `field`.
   */
  yField?: string;
  /**
   * Exact data bounds of an axis range emitted from a range bubble or the
   * keyboard thumbs (RM-143) — used instead of inverting the pixel range, so a
   * typed `150` is `150`, never `149.9999`.
   */
  rangeValues?: [ChartSelectionValue, ChartSelectionValue];
  /** Legend label of a series key, for `ChartDatapoint.seriesLabel`. */
  seriesLabel?: (seriesKey: string) => string | undefined;
  source?: "pointer" | "keyboard";
}

/** One registered mark → the cross-family `ChartDatapoint` payload. */
export function toChartDatapoint<TDatum>(
  mark: ChartMarkGeometry<TDatum>,
  source: "pointer" | "keyboard",
  seriesLabel?: (seriesKey: string) => string | undefined,
): ChartDatapoint<TDatum> {
  return {
    datum: mark.datum,
    index: mark.index,
    seriesKey: mark.seriesKey,
    seriesLabel: mark.seriesKey ? (seriesLabel?.(mark.seriesKey) ?? mark.seriesKey) : undefined,
    value: mark.value,
    category: mark.category,
    source,
  };
}

function valueKey(value: ChartSelectionValue): string {
  return value instanceof Date ? `d:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

/** Distinct categories of `marks`, in data (index) order. */
export function distinctCategories(
  marks: readonly ChartMarkGeometry<unknown>[],
): ChartSelectionValue[] {
  const ordered = [...marks].sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: ChartSelectionValue[] = [];
  for (const mark of ordered) {
    if (mark.category === undefined) continue;
    const key = valueKey(mark.category);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mark.category);
  }
  return out;
}

/** The single mark a click lands on: a containing rect, else the nearest point within reach. */
export function hitAtPoint<T extends ChartMarkGeometry<unknown>>(
  marks: readonly T[],
  point: GesturePoint,
): T | undefined {
  let best: T | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const mark of visibleOnly(marks)) {
    if (mark.shape.kind === "rect") {
      if (pointInRect(point.x, point.y, shapeBounds(mark.shape))) return mark;
      continue;
    }
    const c = shapeCenter(mark.shape);
    const reach = Math.max(CLICK_HIT_RADIUS, mark.shape.kind === "circle" ? mark.shape.r : 0);
    const d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d <= reach && d < bestDistance) {
      bestDistance = d;
      best = mark;
    }
  }
  return best;
}

/** The lasso polygon of a settled lasso gesture (simplified, snapped). */
export function lassoPolygon(path: readonly GesturePoint[]): GesturePoint[] {
  return snapToClose(simplifyPath(path)).path;
}

function asNumber(value: ChartSelectionValue | undefined): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : Number.NaN;
}

/** A y pixel range → a numeric `[lo, hi]` (a band y axis yields category indices). */
function yRangeToNumbers(axis: GestureAxis | undefined, range: [number, number]): [number, number] {
  if (!axis) return [Math.min(...range), Math.max(...range)];
  if (axis.kind === "band") {
    const data = pixelRangeToData(axis, range);
    const domain = axis.scale.domain();
    if (!data) return [Number.NaN, Number.NaN];
    return [domain.indexOf(String(data[0])), domain.indexOf(String(data[1]))];
  }
  const a = asNumber(pixelToData(axis, range[0]));
  const b = asNumber(pixelToData(axis, range[1]));
  return a <= b ? [a, b] : [b, a];
}

function xToData(axis: GestureAxis | undefined, px: number): ChartSelectionValue {
  return (axis ? pixelToData(axis, px) : undefined) ?? px;
}
function yToNumber(axis: GestureAxis | undefined, px: number): number {
  if (!axis) return px;
  const v = pixelToData(axis, px);
  if (axis.kind === "band") return axis.scale.domain().indexOf(String(v));
  return asNumber(v);
}

/** True for an axis that carries a MEASURE (a continuous value scale). */
export function isMeasureAxis(axis: GestureAxis | undefined): boolean {
  return axis?.kind === "linear";
}

function sortedNumbers(pair: [ChartSelectionValue, ChartSelectionValue]): [number, number] {
  const a = asNumber(pair[0]);
  const b = asNumber(pair[1]);
  return a <= b ? [a, b] : [b, a];
}

/**
 * An axis range's hits (RM-143, ADR 0040 §3):
 * - a MEASURE axis (`linear`) → the marks whose measure (of `of`, when given)
 *   lies in `[lo, hi]` — so the intent carries the DIMENSION values whose
 *   measure is in range (the associative BI suite), never "rows between";
 * - a BAND axis → every mark in the overlapped categories (the whole band, so
 *   a grouped bar's slot outside the pixel range still comes along);
 * - a TIME axis → every mark in range, visible or not.
 */
function rangeHits<T extends ChartMarkGeometry<unknown>>(
  marks: readonly T[],
  axisName: "x" | "y",
  axis: GestureAxis | undefined,
  px: [number, number],
  options: Pick<ResolveIntentOptions, "of" | "rangeValues">,
): T[] {
  if (axis?.kind === "linear") {
    const [lo, hi] = options.rangeValues
      ? sortedNumbers(options.rangeValues)
      : yRangeToNumbers(axis, px);
    const pxLo = Math.min(px[0], px[1]);
    const pxHi = Math.max(px[0], px[1]);
    return visibleOnly(marks).filter((mark) => {
      if (options.of && mark.seriesKey !== undefined && mark.seriesKey !== options.of) {
        return false;
      }
      if (typeof mark.value === "number" && Number.isFinite(lo) && Number.isFinite(hi)) {
        return mark.value >= lo && mark.value <= hi;
      }
      const c = shapeCenter(mark.shape);
      const at = axisName === "x" ? c.x : c.y;
      return at >= pxLo && at <= pxHi;
    });
  }
  let range = px;
  if (axis?.kind === "band") {
    const categories = bandCategoriesInRange(axis.scale, px);
    if (categories.length === 0) return [];
    const starts = categories.map((category) => axis.scale(category) as number);
    // Inset by a hair: two bands with no padding touch, and the overlap test
    // is closed on both ends.
    range = [Math.min(...starts) + 0.01, Math.max(...starts) + axis.scale.bandwidth() - 0.01];
  }
  return hitsInBand(marks, axisName, range, { includeHidden: axis?.kind === "time" });
}

/** Which marks a settled gesture hits, in plot pixels. */
export function resolveGestureHits<T extends ChartMarkGeometry<unknown>>(
  state: Pick<GestureState, "activeMode" | "origin" | "current" | "path" | "isClick">,
  marks: readonly T[],
  options: Pick<ResolveIntentOptions, "hitRule" | "xAxis" | "yAxis" | "of" | "rangeValues"> = {},
): T[] {
  const { origin, current } = state;
  if (!origin || !current) return [];
  if (state.isClick) {
    const hit = hitAtPoint(marks, current);
    return hit ? [hit] : [];
  }
  const rule = options.hitRule ?? "overlap";
  switch (state.activeMode) {
    case "rect":
      return hitsInRect(marks, normalizeRect(origin, current), { rule });
    case "lasso":
      return hitsInPolygon(marks, lassoPolygon(state.path), { rule });
    case "radial":
      return hitsInPolygon(
        marks,
        radialToPolygon(origin, Math.hypot(current.x - origin.x, current.y - origin.y)),
        { rule },
      );
    case "range-x":
      return rangeHits(marks, "x", options.xAxis, [origin.x, current.x], options);
    case "range-y":
      return rangeHits(marks, "y", options.yAxis, [origin.y, current.y], options);
    default:
      return [];
  }
}

/** First and last hit category in data order — the x span when no invertible x axis exists. */
function hitCategorySpan(
  hits: readonly ChartMarkGeometry<unknown>[],
): [ChartSelectionValue, ChartSelectionValue] | undefined {
  const values = distinctCategories(hits);
  if (values.length === 0) return undefined;
  return [values[0] as ChartSelectionValue, values[values.length - 1] as ChartSelectionValue];
}

/** The gesture's geometry in DATA units. */
export function gestureGeometry(
  state: Pick<GestureState, "activeMode" | "origin" | "current" | "path" | "isClick">,
  hits: readonly ChartMarkGeometry<unknown>[],
  options: Pick<ResolveIntentOptions, "xAxis" | "yAxis" | "of" | "rangeValues"> = {},
): ChartSelectionGeometry | undefined {
  const { origin, current } = state;
  if (!origin || !current) return undefined;
  const { xAxis, yAxis } = options;
  if (state.isClick) {
    const hit = hits[0];
    if (!hit || hit.category === undefined) return undefined;
    return { kind: "click", category: hit.category, seriesKey: hit.seriesKey };
  }
  const mode: GestureEngineMode = state.activeMode;
  switch (mode) {
    case "range-x":
    case "range-y": {
      const axisName = mode === "range-x" ? "x" : "y";
      const axis = axisName === "x" ? xAxis : yAxis;
      const px: [number, number] = [origin[axisName], current[axisName]];
      let bounds: [ChartSelectionValue, ChartSelectionValue] | undefined = options.rangeValues;
      if (!bounds) bounds = axis ? pixelRangeToData(axis, px) : hitCategorySpan(hits);
      const [from, to] = bounds ?? [Math.min(...px), Math.max(...px)];
      const of = isMeasureAxis(axis) && options.of ? { of: options.of } : {};
      return { kind: "range", axis: axisName, from, to, ...of };
    }
    case "rect": {
      const rect = normalizeRect(origin, current);
      const x = xAxis ? pixelRangeToData(xAxis, [rect.x, rect.x + rect.w]) : hitCategorySpan(hits);
      return {
        kind: "rect",
        x: x ?? [rect.x, rect.x + rect.w],
        y: yRangeToNumbers(yAxis, [rect.y, rect.y + rect.h]),
      };
    }
    case "lasso":
      return {
        kind: "lasso",
        path: lassoPolygon(state.path).map((p) => ({
          x: xToData(xAxis, p.x),
          y: yToNumber(yAxis, p.y),
        })),
      };
    case "radial": {
      const r = Math.hypot(current.x - origin.x, current.y - origin.y);
      const cx = xToData(xAxis, origin.x);
      const cy = yToNumber(yAxis, origin.y);
      const rx = Math.abs(asNumber(xToData(xAxis, origin.x + r)) - asNumber(cx));
      const ry = Math.abs(yToNumber(yAxis, origin.y + r) - cy);
      return {
        kind: "radial",
        center: { x: cx, y: cy },
        rx: Number.isFinite(rx) ? rx : r,
        ry: Number.isFinite(ry) ? ry : r,
      };
    }
    default:
      return undefined;
  }
}

/**
 * A settled gesture (`committed` or `provisional`) → the intent, or `null`
 * when it hit nothing or is not a selection gesture (`pointer`-mode drags).
 */
export function resolveSelectionIntent<TDatum = Record<string, unknown>>(
  state: GestureState,
  marks: readonly ChartMarkGeometry<TDatum>[],
  options: ResolveIntentOptions,
): ChartSelectionIntent<TDatum> | null {
  if (state.phase !== "committed" && state.phase !== "provisional") return null;
  if (state.activeMode === "pointer" && !state.isClick) return null;
  const hits = resolveGestureHits(state, marks, options);
  // A heatmap ROW range reports the rows, under the row field.
  const byRow =
    state.activeMode === "range-y" &&
    !state.isClick &&
    options.yField !== undefined &&
    hits.some((mark) => mark.crossCategory !== undefined);
  const values = byRow
    ? distinctCategories(hits.map((mark) => ({ ...mark, category: mark.crossCategory })))
    : distinctCategories(hits);
  if (values.length === 0) return null;
  const gesture = gestureGeometry(state, hits, options);
  if (!gesture) return null;
  const source = options.source ?? "pointer";
  return {
    field: byRow ? (options.yField as string) : options.field,
    values,
    mode: state.selectionMode ?? "replace",
    gesture,
    datapoints: [...hits]
      .sort((a, b) => a.index - b.index)
      .map((mark) => toChartDatapoint(mark, source, options.seriesLabel)),
    source,
  };
}
