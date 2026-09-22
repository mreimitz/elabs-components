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

/** Which marks a settled gesture hits, in plot pixels. */
export function resolveGestureHits<T extends ChartMarkGeometry<unknown>>(
  state: Pick<GestureState, "activeMode" | "origin" | "current" | "path" | "isClick">,
  marks: readonly T[],
  options: Pick<ResolveIntentOptions, "hitRule" | "xAxis" | "yAxis" | "of"> = {},
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
      // A time-axis range selects every value in range, visible or not (the associative BI suite).
      return hitsInBand(marks, "x", [origin.x, current.x], {
        includeHidden: options.xAxis?.kind === "time",
      });
    case "range-y": {
      // A MEASURE range: the marks whose measure falls in it (the associative BI suite) — read
      // off `value` when the mark carries one, else its centre.
      const [lo, hi] = yRangeToNumbers(options.yAxis, [origin.y, current.y]);
      const pxLo = Math.min(origin.y, current.y);
      const pxHi = Math.max(origin.y, current.y);
      return visibleOnly(marks).filter((mark) => {
        if (options.of && mark.seriesKey !== options.of) return false;
        if (
          typeof mark.value === "number" &&
          options.yAxis &&
          options.yAxis.kind !== "band" &&
          Number.isFinite(lo)
        ) {
          return mark.value >= lo && mark.value <= hi;
        }
        const c = shapeCenter(mark.shape);
        return c.y >= pxLo && c.y <= pxHi;
      });
    }
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
  options: Pick<ResolveIntentOptions, "xAxis" | "yAxis" | "of"> = {},
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
    case "range-x": {
      const range = xAxis ? pixelRangeToData(xAxis, [origin.x, current.x]) : hitCategorySpan(hits);
      const [from, to] = range ?? [Math.min(origin.x, current.x), Math.max(origin.x, current.x)];
      return { kind: "range", axis: "x", from, to };
    }
    case "range-y": {
      const [from, to] = yRangeToNumbers(yAxis, [origin.y, current.y]);
      return { kind: "range", axis: "y", from, to, ...(options.of ? { of: options.of } : {}) };
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
  const values = distinctCategories(hits);
  if (values.length === 0) return null;
  const gesture = gestureGeometry(state, hits, options);
  if (!gesture) return null;
  const source = options.source ?? "pointer";
  return {
    field: options.field,
    values,
    mode: state.selectionMode ?? "replace",
    gesture,
    datapoints: [...hits]
      .sort((a, b) => a.index - b.index)
      .map((mark) => toChartDatapoint(mark, source, options.seriesLabel)),
    source,
  };
}
