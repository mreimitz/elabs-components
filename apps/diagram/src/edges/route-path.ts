import type { Position } from "@xyflow/react";
import type { RoutePoint } from "./data-flow-edge-data";
import { ZONE_HEADER_HEIGHT } from "../nodes/zone-data";

/** Flow px between a zone's header band and a join leg run beneath it (children start at
 *  header + 16 px padding, so the leg sits in that gap). */
const JOIN_HEADER_GAP = 8;

/**
 * Wave-2 review M2 — drawing ELK's route (`data.route`) as an edge path, and deciding whether
 * it still fits the canvas. Pure geometry; `DataFlowEdge` calls it.
 */

/**
 * How far a route end may sit from the live handle and still be snapped onto it, in flow px.
 * ELK's port is on the node's border, React Flow's handle point a few px outside it (the
 * handle's outer edge); anything further means a node moved since the layout (a drag, a
 * resize) and the route is dropped for the smooth step.
 */
export const SNAP_TOLERANCE = 12;

/** A live node box in flow coordinates, and whether it is a zone (an end may float on it). */
export interface EndBox {
  x: number;
  y: number;
  width: number;
  height: number;
  zone: boolean;
}

const EPSILON = 0.5;

function distance(a: RoutePoint, b: RoutePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The nearest point on `box`'s border, when `point` lies within `SNAP_TOLERANCE` of it —
 * a zone end ELK attached to the border, after auto-fit nudged that border by a few px.
 */
function onBorder(point: RoutePoint, box: EndBox): RoutePoint | undefined {
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
  const clampX = Math.min(right, Math.max(left, point.x));
  const clampY = Math.min(bottom, Math.max(top, point.y));
  const candidates: RoutePoint[] = [
    { x: left, y: clampY },
    { x: right, y: clampY },
    { x: clampX, y: top },
    { x: clampX, y: bottom },
  ];
  let best: RoutePoint | undefined;
  for (const candidate of candidates) {
    if (distance(candidate, point) > SNAP_TOLERANCE) continue;
    if (!best || distance(candidate, point) < distance(best, point)) best = candidate;
  }
  return best;
}

/**
 * Where a route end goes on the live canvas: the live handle when the route end is within
 * `SNAP_TOLERANCE` of it; for a zone end, the nearest point of the zone's live border when
 * the route end is that close to it (ELK attached the edge to the zone's border, wherever
 * along it); otherwise `undefined` — the route no longer matches (a drag, a resize, a
 * collapse before its re-layout).
 */
function resolveEnd(routeEnd: RoutePoint, live: RoutePoint, box: EndBox | undefined) {
  if (distance(routeEnd, live) <= SNAP_TOLERANCE) return live;
  return box?.zone ? onBorder(routeEnd, box) : undefined;
}

/**
 * Moves end `index` (first or last) to `to`, and drags the neighbouring bend point along the
 * axis the segment runs across, so the first/last segment stays horizontal or vertical.
 */
function snapEnd(points: RoutePoint[], index: number, to: RoutePoint): void {
  const neighbour = index === 0 ? 1 : points.length - 2;
  const end = points[index]!;
  const next = points[neighbour]!;
  points[index] = to;
  if (neighbour === 0 || neighbour === points.length - 1) return;
  if (Math.abs(end.y - next.y) < EPSILON) points[neighbour] = { x: next.x, y: to.y };
  else if (Math.abs(end.x - next.x) < EPSILON) points[neighbour] = { x: to.x, y: next.y };
}

/** Any segment left diagonal (a straight route whose ends snapped apart) gets a mid jog. */
function orthogonalize(points: readonly RoutePoint[]): RoutePoint[] {
  const out: RoutePoint[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= EPSILON && Math.abs(dy) >= EPSILON) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        const mx = a.x + dx / 2;
        out.push({ x: mx, y: a.y }, { x: mx, y: b.y });
      } else {
        const my = a.y + dy / 2;
        out.push({ x: a.x, y: my }, { x: b.x, y: my });
      }
    }
    out.push(b);
  }
  return out;
}

/** One end of an edge for `fitRoute`. */
export interface RouteEnd {
  /** The rendered end: the handle point (or a floating zone end's border point). */
  live: RoutePoint;
  /** The side the rendered end leaves or enters by. */
  position: Position;
  /** The end node's live box. */
  box?: EndBox;
  /**
   * The live box of the separate zone ELK routed this end to (`route.via`): the route stops
   * on its border and a step joins it to `live`.
   */
  via?: EndBox;
}

/** A step from `from` to a handle at `to` that is entered from `position`'s side. */
function joinStep(
  from: RoutePoint,
  to: RoutePoint,
  position: Position,
  zone: EndBox,
): RoutePoint[] {
  if (position === "top" || position === "bottom") {
    // Run the horizontal leg below the zone's header band, not through it: an end that
    // crosses the zone's top border would otherwise strike through the zone's title.
    const lo = Math.min(from.y, to.y);
    const hi = Math.max(from.y, to.y);
    const belowHeader = zone.y + ZONE_HEADER_HEIGHT + JOIN_HEADER_GAP;
    const my = belowHeader > lo && belowHeader < hi ? belowHeader : (from.y + to.y) / 2;
    return [from, { x: from.x, y: my }, { x: to.x, y: my }, to];
  }
  const mx = (from.x + to.x) / 2;
  return [from, { x: mx, y: from.y }, { x: mx, y: to.y }, to];
}

/**
 * The route's points fitted to the live ends, or `undefined` when it no longer fits (the
 * caller then draws the smooth step between the handles).
 */
export function fitRoute(
  points: readonly RoutePoint[],
  source: RouteEnd,
  target: RouteEnd,
): RoutePoint[] | undefined {
  if (points.length < 2) return undefined;
  const firstPoint = points[0]!;
  const lastPoint = points[points.length - 1]!;
  const first = source.via
    ? onBorder(firstPoint, source.via)
    : resolveEnd(firstPoint, source.live, source.box);
  const last = target.via
    ? onBorder(lastPoint, target.via)
    : resolveEnd(lastPoint, target.live, target.box);
  if (!first || !last) return undefined;
  const fitted = points.map((point) => ({ ...point }));
  snapEnd(fitted, 0, first);
  snapEnd(fitted, fitted.length - 1, last);
  const head = source.via
    ? joinStep(source.live, first, source.position, source.via).slice(0, -1)
    : [];
  const tail = target.via ? joinStep(last, target.live, target.position, target.via).slice(1) : [];
  return orthogonalize([...head, ...fitted, ...tail]);
}

/** Drops repeated points and the middle of three collinear ones (no zero-length corners). */
function simplify(points: readonly RoutePoint[]): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && distance(last, point) < EPSILON) continue;
    const before = out[out.length - 2];
    if (
      before &&
      last &&
      ((Math.abs(before.x - last.x) < EPSILON && Math.abs(last.x - point.x) < EPSILON) ||
        (Math.abs(before.y - last.y) < EPSILON && Math.abs(last.y - point.y) < EPSILON))
    ) {
      out[out.length - 1] = point;
      continue;
    }
    out.push(point);
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * An SVG path through orthogonal `points` with quadratic corners of `radius` (shortened where
 * a segment is too short) — the same corner `getSmoothStepPath` draws.
 */
export function roundedOrthogonalPath(points: readonly RoutePoint[], radius: number): string {
  const pts = simplify(points);
  const start = pts[0]!;
  let d = `M ${round(start.x)} ${round(start.y)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const r = Math.min(radius, distance(a, b) / 2, distance(b, c) / 2);
    const inX = b.x + (Math.sign(a.x - b.x) * r || 0);
    const inY = b.y + (Math.sign(a.y - b.y) * r || 0);
    const outX = b.x + (Math.sign(c.x - b.x) * r || 0);
    const outY = b.y + (Math.sign(c.y - b.y) * r || 0);
    d += ` L ${round(inX)} ${round(inY)} Q ${round(b.x)} ${round(b.y)} ${round(outX)} ${round(outY)}`;
  }
  const end = pts[pts.length - 1]!;
  return `${d} L ${round(end.x)} ${round(end.y)}`;
}

/** The point halfway along a polyline — the label anchor when ELK placed no label. */
export function polylineMidpoint(points: readonly RoutePoint[]): RoutePoint {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1]!, points[i]!);
  let left = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = distance(a, b);
    if (length >= left && length > 0) {
      return { x: a.x + ((b.x - a.x) * left) / length, y: a.y + ((b.y - a.y) * left) / length };
    }
    left -= length;
  }
  return points[points.length - 1]!;
}
