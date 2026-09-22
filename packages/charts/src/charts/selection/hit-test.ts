/**
 * hit-test.ts — which marks a selection gesture hits (RM-142).
 *
 * Rules (ADR 0040 §3):
 * - Rectangle, `overlap` (default, the report-builder BI suite): a mark is hit when ANY part of it
 *   lies inside the rectangle. `contain`: only when ALL of it does.
 * - Lasso: points / circles are hit when their CENTRE is inside the polygon
 *   (d3-polygon `polygonContains`); a rect is hit under `overlap` when any
 *   corner (or its centre) is inside, under `contain` when every corner is.
 * - Rect and lasso consider VISIBLE marks only (the associative BI suite: "lasso selects visible
 *   points"); an axis range (`hitsInBand`) may opt hidden marks in — a time
 *   axis range selects every value in range, visible or not.
 *
 * Mark geometry is in plot pixels, the arrays the families already compute.
 * Pure: no React, no DOM — the canvas layer's `SpatialGrid` reuses
 * `pointInPolygon` / `pointInRect` for its containment query.
 */

import { polygonContains } from "d3-polygon";
import type { GesturePoint } from "./gesture-machine";
import type { PixelRect } from "./geometry";
import type { ChartSelectionHitRule, ChartSelectionValue } from "./types";

export type ChartMarkShape =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "point"; x: number; y: number };

/** One selectable mark, as a family registers it (`useRegisterMarkGeometry`). */
export interface ChartMarkGeometry<TDatum = Record<string, unknown>> {
  /** Unique within the chart. */
  id: string;
  /** The mark's value of the selection field (its category / x). */
  category: ChartSelectionValue | undefined;
  seriesKey?: string;
  datum: TDatum;
  /** Index into the chart's `data`. */
  index: number;
  /** The measure the mark encodes, when it has one (read by measure-axis ranges and datapoints). */
  value?: number;
  /**
   * The mark's value of the CROSS dimension, when it sits on two (a heatmap
   * cell's row). A row range (`range-y` with `yField`) resolves to these.
   */
  crossCategory?: ChartSelectionValue;
  shape: ChartMarkShape;
  /** `false` for a mark drawn out of view (clipped, filtered, zero-size). */
  visible: boolean;
}

export interface HitRectOptions {
  rule?: ChartSelectionHitRule;
}

/** Marks a rect/lasso may hit. */
export function visibleOnly<T extends Pick<ChartMarkGeometry<unknown>, "visible">>(
  marks: readonly T[],
): T[] {
  return marks.filter((mark) => mark.visible !== false);
}

export function pointInRect(x: number, y: number, rect: PixelRect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** `polygonContains` over `{x, y}` points. A polygon of < 3 vertices contains nothing. */
export function pointInPolygon(x: number, y: number, polygon: readonly GesturePoint[]): boolean {
  if (polygon.length < 3) return false;
  return polygonContains(
    polygon.map((p) => [p.x, p.y] as [number, number]),
    [x, y],
  );
}

/** The axis-aligned box of a shape. */
export function shapeBounds(shape: ChartMarkShape): PixelRect {
  switch (shape.kind) {
    case "rect":
      return {
        x: Math.min(shape.x, shape.x + shape.w),
        y: Math.min(shape.y, shape.y + shape.h),
        w: Math.abs(shape.w),
        h: Math.abs(shape.h),
      };
    case "circle":
      return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
    case "point":
      return { x: shape.x, y: shape.y, w: 0, h: 0 };
  }
}

/** The shape's centre (a lasso tests points and circles here). */
export function shapeCenter(shape: ChartMarkShape): GesturePoint {
  switch (shape.kind) {
    case "rect":
      return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
    case "circle":
      return { x: shape.cx, y: shape.cy };
    case "point":
      return { x: shape.x, y: shape.y };
  }
}

function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

/** Float slack for containment: a rect clamped to the plot edge is `y + (h − y)`, not `h`. */
const CONTAIN_EPSILON = 1e-6;

function rectContains(outer: PixelRect, inner: PixelRect): boolean {
  return (
    inner.x >= outer.x - CONTAIN_EPSILON &&
    inner.y >= outer.y - CONTAIN_EPSILON &&
    inner.x + inner.w <= outer.x + outer.w + CONTAIN_EPSILON &&
    inner.y + inner.h <= outer.y + outer.h + CONTAIN_EPSILON
  );
}

function cross(o: GesturePoint, a: GesturePoint, b: GesturePoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Do the segments `p1–p2` and `q1–q2` touch? */
function segmentsIntersect(
  p1: GesturePoint,
  p2: GesturePoint,
  q1: GesturePoint,
  q2: GesturePoint,
): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  const onSegment = (a: GesturePoint, b: GesturePoint, p: GesturePoint) =>
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y);
  return (
    (d1 === 0 && onSegment(q1, q2, p1)) ||
    (d2 === 0 && onSegment(q1, q2, p2)) ||
    (d3 === 0 && onSegment(p1, p2, q1)) ||
    (d4 === 0 && onSegment(p1, p2, q2))
  );
}

function circleOverlapsRect(cx: number, cy: number, r: number, rect: PixelRect): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - nx, cy - ny) <= r;
}

/** Does one shape hit a rectangle under `rule`? */
export function shapeHitsRect(
  shape: ChartMarkShape,
  rect: PixelRect,
  rule: ChartSelectionHitRule = "overlap",
): boolean {
  switch (shape.kind) {
    case "point":
      return pointInRect(shape.x, shape.y, rect);
    case "circle":
      return rule === "contain"
        ? rectContains(rect, shapeBounds(shape))
        : circleOverlapsRect(shape.cx, shape.cy, shape.r, rect);
    case "rect": {
      const bounds = shapeBounds(shape);
      return rule === "contain" ? rectContains(rect, bounds) : rectsOverlap(rect, bounds);
    }
  }
}

/** Does one shape hit a polygon under `rule`? */
export function shapeHitsPolygon(
  shape: ChartMarkShape,
  polygon: readonly GesturePoint[],
  rule: ChartSelectionHitRule = "overlap",
): boolean {
  if (polygon.length < 3) return false;
  if (shape.kind !== "rect") {
    const c = shapeCenter(shape);
    return pointInPolygon(c.x, c.y, polygon);
  }
  const b = shapeBounds(shape);
  const corners: GesturePoint[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
  ];
  if (rule === "contain") return corners.every((p) => pointInPolygon(p.x, p.y, polygon));
  if (corners.some((p) => pointInPolygon(p.x, p.y, polygon))) return true;
  const c = shapeCenter(shape);
  if (pointInPolygon(c.x, c.y, polygon)) return true;
  // A small lasso drawn entirely INSIDE a big bar has no corner inside it —
  // it still overlaps the bar.
  if (polygon.some((p) => pointInRect(p.x, p.y, b))) return true;
  // A thin lasso band CROSSING a tall bar has neither: its edges cut the bar's.
  const edges: Array<[GesturePoint, GesturePoint]> = [
    [corners[0] as GesturePoint, corners[1] as GesturePoint],
    [corners[1] as GesturePoint, corners[3] as GesturePoint],
    [corners[3] as GesturePoint, corners[2] as GesturePoint],
    [corners[2] as GesturePoint, corners[0] as GesturePoint],
  ];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as GesturePoint;
    const c = polygon[(i + 1) % polygon.length] as GesturePoint;
    for (const [e1, e2] of edges) if (segmentsIntersect(a, c, e1, e2)) return true;
  }
  return false;
}

/** Visible marks hit by a rectangle (plot pixels). */
export function hitsInRect<T extends ChartMarkGeometry<unknown>>(
  marks: readonly T[],
  rect: PixelRect,
  options: HitRectOptions = {},
): T[] {
  const rule = options.rule ?? "overlap";
  return visibleOnly(marks).filter((mark) => shapeHitsRect(mark.shape, rect, rule));
}

/** Visible marks hit by a lasso / radial polygon (plot pixels). */
export function hitsInPolygon<T extends ChartMarkGeometry<unknown>>(
  marks: readonly T[],
  path: readonly GesturePoint[],
  options: HitRectOptions = {},
): T[] {
  const rule = options.rule ?? "overlap";
  return visibleOnly(marks).filter((mark) => shapeHitsPolygon(mark.shape, path, rule));
}

export interface HitBandOptions {
  /** Include `visible: false` marks (a time-axis range selects them too). Default `false`. */
  includeHidden?: boolean;
}

/**
 * Marks whose extent along `axis` overlaps the pixel range `[a, b]` (either
 * order) — an axis range. The cross axis is ignored.
 */
export function hitsInBand<T extends ChartMarkGeometry<unknown>>(
  marks: readonly T[],
  axis: "x" | "y",
  range: [number, number],
  options: HitBandOptions = {},
): T[] {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const pool = options.includeHidden ? marks : visibleOnly(marks);
  return pool.filter((mark) => {
    const b = shapeBounds(mark.shape);
    const start = axis === "x" ? b.x : b.y;
    const end = start + (axis === "x" ? b.w : b.h);
    return start <= hi && end >= lo;
  });
}
