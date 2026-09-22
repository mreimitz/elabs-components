/**
 * geometry.ts — pixel ↔ data conversions and path maths for the selection
 * gesture engine (RM-142).
 *
 * - `time` / `linear` axes invert through the scale's own `invert` (d3).
 * - `band` axes have no inverse: a pixel RANGE maps to every category whose
 *   band OVERLAPS it (a rectangle that clips the edge of a bar still takes its
 *   category — the report-builder BI suite's overlap rule, applied to the axis).
 * - A lasso path is simplified with Douglas–Peucker (ε = 1.5 px) and closed
 *   when its end comes back within 12 px of its start (picasso.js'
 *   `snapToClose`).
 *
 * Pure: no React, no DOM.
 */

import type { GesturePoint } from "./gesture-machine";
import type { ChartSelectionValue } from "./types";

/** Douglas–Peucker tolerance for a lasso path, px. */
export const LASSO_SIMPLIFY_EPSILON = 1.5;
/** A lasso whose end is within this distance of its start closes (picasso.js), px. */
export const LASSO_SNAP_DISTANCE = 12;
/** Segments of the polygon a radial gesture is approximated by. */
export const RADIAL_SEGMENTS = 24;

/** A continuous time scale (d3 `scaleTime`). */
export interface TimeScaleLike {
  (value: Date): number | undefined;
  invert(pixel: number): Date;
}
/** A continuous numeric scale (d3 `scaleLinear` / `scaleLog`). */
export interface LinearScaleLike {
  (value: number): number | undefined;
  invert(pixel: number): number;
}
/** A band scale (d3 `scaleBand`). */
export interface BandScaleLike {
  (value: string): number | undefined;
  domain(): string[];
  bandwidth(): number;
}

/** One axis the engine can convert on. */
export type GestureAxis =
  | { kind: "time"; scale: TimeScaleLike }
  | { kind: "linear"; scale: LinearScaleLike }
  | { kind: "band"; scale: BandScaleLike };

/** An axis-aligned rectangle in plot pixels, `w`/`h` ≥ 0. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The rectangle spanned by two corners, normalised so `w`/`h` are never negative. */
export function normalizeRect(a: GesturePoint, b: GesturePoint): PixelRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** The categories whose band overlaps the pixel range `[a, b]` (either order), in domain order. */
export function bandCategoriesInRange(scale: BandScaleLike, range: [number, number]): string[] {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const width = scale.bandwidth();
  const out: string[] = [];
  for (const category of scale.domain()) {
    const start = scale(category);
    if (start === undefined || !Number.isFinite(start)) continue;
    // Closed on both ends: a range touching a band's edge takes it.
    if (start <= hi && start + width >= lo) out.push(category);
  }
  return out;
}

/** The category whose band (or step, for a gap) is nearest a pixel. */
export function bandCategoryAt(scale: BandScaleLike, pixel: number): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  const half = scale.bandwidth() / 2;
  for (const category of scale.domain()) {
    const start = scale(category);
    if (start === undefined || !Number.isFinite(start)) continue;
    const d = Math.abs(start + half - pixel);
    if (d < bestDistance) {
      bestDistance = d;
      best = category;
    }
  }
  return best;
}

/** One pixel on an axis → its data value (a band axis returns the nearest category). */
export function pixelToData(axis: GestureAxis, pixel: number): ChartSelectionValue | undefined {
  switch (axis.kind) {
    case "time": {
      const d = axis.scale.invert(pixel);
      return Number.isFinite(d.getTime()) ? d : undefined;
    }
    case "linear": {
      const v = axis.scale.invert(pixel);
      return Number.isFinite(v) ? v : undefined;
    }
    case "band":
      return bandCategoryAt(axis.scale, pixel);
  }
}

/**
 * A pixel range → `[from, to]` in data units, ascending in DATA order. A
 * band range returns the first and last overlapped category, or `undefined`
 * when it overlaps none.
 */
export function pixelRangeToData(
  axis: GestureAxis,
  range: [number, number],
): [ChartSelectionValue, ChartSelectionValue] | undefined {
  if (axis.kind === "band") {
    const hits = bandCategoriesInRange(axis.scale, range);
    if (hits.length === 0) return undefined;
    return [hits[0] as string, hits[hits.length - 1] as string];
  }
  const a = pixelToData(axis, range[0]);
  const b = pixelToData(axis, range[1]);
  if (a === undefined || b === undefined) return undefined;
  const na = a instanceof Date ? a.getTime() : Number(a);
  const nb = b instanceof Date ? b.getTime() : Number(b);
  return na <= nb ? [a, b] : [b, a];
}

/** Perpendicular distance from `p` to the segment `a`–`b`. */
function segmentDistance(p: GesturePoint, a: GesturePoint, b: GesturePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Douglas–Peucker simplification. Keeps the first and last point; drops every
 * point within `epsilon` px of the chord it would otherwise bend. Iterative
 * (an explicit stack), so a long freehand path cannot overflow the call stack.
 */
export function simplifyPath(
  path: readonly GesturePoint[],
  epsilon: number = LASSO_SIMPLIFY_EPSILON,
): GesturePoint[] {
  if (path.length <= 2) return path.slice();
  const keep = new Uint8Array(path.length);
  keep[0] = 1;
  keep[path.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, path.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let maxDistance = 0;
    let index = -1;
    const a = path[start] as GesturePoint;
    const b = path[end] as GesturePoint;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistance(path[i] as GesturePoint, a, b);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return path.filter((_, i) => keep[i] === 1);
}

/**
 * Closes a lasso whose last point is within `threshold` px of its first by
 * snapping the last point onto the first (picasso.js). `closed: false` leaves
 * the path open — hit-testing still treats it as a polygon (the implicit
 * closing edge), the flag only tells the overlay whether to draw the snap.
 */
export function snapToClose(
  path: readonly GesturePoint[],
  threshold: number = LASSO_SNAP_DISTANCE,
): { path: GesturePoint[]; closed: boolean } {
  if (path.length < 3) return { path: path.slice(), closed: false };
  const first = path[0] as GesturePoint;
  const last = path[path.length - 1] as GesturePoint;
  if (Math.hypot(last.x - first.x, last.y - first.y) > threshold) {
    return { path: path.slice(), closed: false };
  }
  return { path: [...path.slice(0, -1), { x: first.x, y: first.y }], closed: true };
}

/** A circle as a closed polygon of `segments` vertices (first vertex at 3 o'clock). */
export function radialToPolygon(
  center: GesturePoint,
  radius: number,
  segments: number = RADIAL_SEGMENTS,
): GesturePoint[] {
  const n = Math.max(3, Math.floor(segments));
  const out: GesturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    out.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return out;
}

/** An SVG path `d` for a polygon or open polyline. */
export function pathToSvgD(path: readonly GesturePoint[], close = false): string {
  if (path.length === 0) return "";
  const [first, ...rest] = path as GesturePoint[];
  const head = `M${round(first?.x ?? 0)},${round(first?.y ?? 0)}`;
  const body = rest.map((p) => `L${round(p.x)},${round(p.y)}`).join("");
  return `${head}${body}${close ? "Z" : ""}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
