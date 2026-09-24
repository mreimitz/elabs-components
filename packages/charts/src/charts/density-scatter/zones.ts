/**
 * density-scatter/zones.ts — zones on the axes, classified once.
 *
 * Framework-free. A zone is a rectangle (`min`/`max` per axis) or an envelope
 * that varies along x (`upper`/`lower` polylines). Both resolve to the same
 * test — is `y` between two piecewise-linear functions of `x`? — so a rectangle
 * is just the two-vertex envelope. Classification is O(log m) per point over
 * the vertex list and runs once per data/zones identity into a `Uint8Array`,
 * never per frame.
 */

import { DENSITY_MAX_CLASSES, type DensityPoints, type DensityZone } from "./types";

type Vertex = readonly [number, number];

interface ResolvedZone {
  id: string;
  upper: Vertex[];
  lower: Vertex[];
  /** x extent the envelope covers (outside it, the zone does not apply). */
  x0: number;
  x1: number;
}

function sorted(poly: ReadonlyArray<Vertex>): Vertex[] {
  return [...poly].sort((a, b) => a[0] - b[0]);
}

/** Resolves the two bound shapes to one envelope shape. */
export function resolveZone(zone: DensityZone): ResolvedZone {
  if ("upper" in zone.bounds) {
    const upper = sorted(zone.bounds.upper);
    const lower = sorted(zone.bounds.lower);
    const x0 = Math.max(upper[0]?.[0] ?? -Infinity, lower[0]?.[0] ?? -Infinity);
    const x1 = Math.min(
      upper[upper.length - 1]?.[0] ?? Infinity,
      lower[lower.length - 1]?.[0] ?? Infinity,
    );
    return { id: zone.id, upper, lower, x0, x1 };
  }
  const [xa, xb] = zone.bounds.x ?? [-Infinity, Infinity];
  const [ya, yb] = zone.bounds.y;
  const lo = Math.min(ya, yb);
  const hi = Math.max(ya, yb);
  return {
    id: zone.id,
    upper: [
      [xa, hi],
      [xb, hi],
    ],
    lower: [
      [xa, lo],
      [xb, lo],
    ],
    x0: Math.min(xa, xb),
    x1: Math.max(xa, xb),
  };
}

/** `y` of a sorted polyline at `x` (binary search + linear interpolation). */
export function evalPolyline(poly: ReadonlyArray<Vertex>, x: number): number {
  const n = poly.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return poly[0]![1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (poly[mid]![0] <= x) lo = mid;
    else hi = mid;
  }
  const [ax, ay] = poly[lo]!;
  const [bx, by] = poly[hi]!;
  // A vertical step, or an unbounded rectangle edge (±Infinity → ∞/∞ = NaN).
  if (bx === ax || ay === by || !Number.isFinite(bx - ax)) return ay;
  const t = (x - ax) / (bx - ax);
  return ay + (by - ay) * t;
}

/** Whether a data point lies inside one resolved zone. */
export function zoneContains(zone: ResolvedZone, x: number, y: number): boolean {
  if (x < zone.x0 || x > zone.x1) return false;
  const top = evalPolyline(zone.upper, x);
  const bottom = evalPolyline(zone.lower, x);
  return y <= Math.max(top, bottom) && y >= Math.min(top, bottom);
}

/**
 * One class index per point: the FIRST zone (in `zones` order — inner to outer)
 * that contains it, else `zones.length` (the outside class).
 */
export function classifyZones(points: DensityPoints, zones: readonly DensityZone[]): Uint8Array {
  if (zones.length >= DENSITY_MAX_CLASSES) {
    throw new RangeError(
      `DensityScatterChart: at most ${DENSITY_MAX_CLASSES - 1} zones are supported (${zones.length} given).`,
    );
  }
  const resolved = zones.map(resolveZone);
  const outside = zones.length;
  const cls = new Uint8Array(points.n);
  const { x, y } = points;
  for (let i = 0; i < points.n; i++) {
    const px = x[i]!;
    const py = y[i]!;
    let k = outside;
    for (let z = 0; z < resolved.length; z++) {
      if (zoneContains(resolved[z]!, px, py)) {
        k = z;
        break;
      }
    }
    cls[i] = k;
  }
  return cls;
}

/** Per-class point counts (the legend's shares). */
export function countClasses(cls: Uint8Array, classCount: number): Uint32Array {
  const out = new Uint32Array(classCount);
  for (let i = 0; i < cls.length; i++) out[cls[i]!]!++;
  return out;
}

/**
 * The outline of a zone as polylines in DATA units: upper edge, lower edge, and
 * the two closing edges — what the foreground paints on top of the dots.
 */
export function zoneOutline(zone: DensityZone): Vertex[][] {
  const r = resolveZone(zone);
  const first = (p: Vertex[]) => p[0]!;
  const last = (p: Vertex[]) => p[p.length - 1]!;
  return [r.upper, r.lower, [first(r.upper), first(r.lower)], [last(r.upper), last(r.lower)]];
}
