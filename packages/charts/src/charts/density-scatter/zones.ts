/**
 * density-scatter/zones.ts — zones on the axes, classified once.
 *
 * Framework-free. A zone is a rectangle (`min`/`max` per axis), an envelope
 * that varies along x (`upper`/`lower` polylines) or a polygon. Rectangles and
 * envelopes resolve to the same test — is `y` between two piecewise-linear
 * functions of `x`? — so a rectangle is just the two-vertex envelope
 * (O(log m) per point). A polygon is a bounding-box reject plus ray casting
 * (O(m) per point inside the box). Classification runs once per data/zones
 * identity into a `Uint8Array`, never per frame.
 */

import { pointInPolygon } from "./selection";
import { DENSITY_MAX_CLASSES, type DensityPoints, type DensityZone } from "./types";

type Vertex = readonly [number, number];

interface ResolvedZone {
  id: string;
  /** The zone covers the points OUTSIDE its shape. */
  invert?: boolean;
  upper: Vertex[];
  lower: Vertex[];
  /** x extent the zone covers (outside it, the zone does not apply). */
  x0: number;
  x1: number;
  /** Ends left open (`extend`): the outline gets no closing edge there. */
  openStart?: boolean;
  openEnd?: boolean;
  /** Set for a line zone: the threshold polyline and which side is covered. */
  line?: Vertex[];
  side?: "above" | "below";
  /** Set for a polygon zone: its vertices and y extent (upper/lower are empty). */
  polygon?: Vertex[];
  y0?: number;
  y1?: number;
}

function sorted(poly: ReadonlyArray<Vertex>): Vertex[] {
  return [...poly].sort((a, b) => a[0] - b[0]);
}

/** Resolves the two bound shapes to one envelope shape. */
export function resolveZone(zone: DensityZone): ResolvedZone {
  return { ...resolveShape(zone), invert: zone.invert === true };
}

function resolveShape(zone: DensityZone): ResolvedZone {
  if ("polygon" in zone.bounds) {
    const polygon = [...zone.bounds.polygon].filter(
      ([x, y]) => Number.isFinite(x) && Number.isFinite(y),
    );
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of polygon) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    // Fewer than 3 vertices encloses nothing: an empty range classifies no point.
    if (polygon.length < 3) return { id: zone.id, upper: [], lower: [], x0: 1, x1: 0, polygon };
    return { id: zone.id, upper: [], lower: [], x0, x1, y0, y1, polygon };
  }
  if ("line" in zone.bounds) {
    const line = sorted(zone.bounds.line);
    const openStart = zone.bounds.extend?.start === true;
    const openEnd = zone.bounds.extend?.end === true;
    const far = zone.bounds.side === "below" ? -Infinity : Infinity;
    const a = line[0]?.[0] ?? 0;
    const b = line[line.length - 1]?.[0] ?? 0;
    const other: Vertex[] = [
      [a, far],
      [b, far],
    ];
    const upper = zone.bounds.side === "below" ? line : other;
    const lower = zone.bounds.side === "below" ? other : line;
    // Under 2 vertices a line bounds nothing: an empty range classifies no point.
    if (line.length < 2)
      return { id: zone.id, upper, lower, x0: 1, x1: 0, line, side: zone.bounds.side };
    return {
      id: zone.id,
      upper,
      lower,
      x0: openStart ? -Infinity : a,
      x1: openEnd ? Infinity : b,
      openStart,
      openEnd,
      line,
      side: zone.bounds.side,
    };
  }
  if ("upper" in zone.bounds) {
    let upper = sorted(zone.bounds.upper);
    let lower = sorted(zone.bounds.lower);
    const openStart = zone.bounds.extend?.start === true;
    const openEnd = zone.bounds.extend?.end === true;
    // An endless end continues each edge at its OWN outermost height. An outline
    // drawn around a region often shares its end vertex between both edges (or
    // stacks several vertices on the end x); left as is, both edges would run
    // on at the same y and the endless part would have no height. Collapse the
    // stacked end vertices to the extreme one: the top of the higher edge, the
    // bottom of the lower edge.
    if ((openStart || openEnd) && upper.length >= 2 && lower.length >= 2) {
      const upperIsHigh = meanY(upper) >= meanY(lower);
      const hi = upperIsHigh ? upper : lower;
      const lo = upperIsHigh ? lower : upper;
      let nh = collapseEnds(hi, openStart, openEnd, true);
      let nl = collapseEnds(lo, openStart, openEnd, false);
      // A pointed tip (both edges meet in one vertex): the endless part starts
      // where the edges have separated, at their next vertices.
      if (openStart && nh.length > 2 && nl.length > 2 && nh[0]![1] <= nl[0]![1]) {
        nh = nh.slice(1);
        nl = nl.slice(1);
      }
      if (
        openEnd &&
        nh.length > 2 &&
        nl.length > 2 &&
        nh[nh.length - 1]![1] <= nl[nl.length - 1]![1]
      ) {
        nh = nh.slice(0, -1);
        nl = nl.slice(0, -1);
      }
      upper = upperIsHigh ? nh : nl;
      lower = upperIsHigh ? nl : nh;
    }
    const x0 = openStart
      ? -Infinity
      : Math.max(upper[0]?.[0] ?? -Infinity, lower[0]?.[0] ?? -Infinity);
    const x1 = openEnd
      ? Infinity
      : Math.min(
          upper[upper.length - 1]?.[0] ?? Infinity,
          lower[lower.length - 1]?.[0] ?? Infinity,
        );
    return { id: zone.id, upper, lower, x0, x1, openStart, openEnd };
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

function meanY(poly: ReadonlyArray<Vertex>): number {
  let s = 0;
  for (const p of poly) s += p[1];
  return s / Math.max(1, poly.length);
}

/**
 * The vertices stacked on a sorted polyline's first / last x, reduced to the
 * one with the highest (`high`) or lowest y — for an open end only.
 */
function collapseEnds(poly: Vertex[], start: boolean, end: boolean, high: boolean): Vertex[] {
  let out = poly;
  const pick = (a: Vertex, b: Vertex) => (high ? (b[1] > a[1] ? b : a) : b[1] < a[1] ? b : a);
  if (start && out.length > 2) {
    const x = out[0]![0];
    let k = 0;
    let best = out[0]!;
    while (k + 1 < out.length - 1 && out[k + 1]![0] === x) best = pick(best, out[++k]!);
    if (k > 0) out = [best, ...out.slice(k + 1)];
  }
  if (end && out.length > 2) {
    const x = out[out.length - 1]![0];
    let k = out.length - 1;
    let best = out[k]!;
    while (k - 1 > 0 && out[k - 1]![0] === x) best = pick(best, out[--k]!);
    if (k < out.length - 1) out = [...out.slice(0, k), best];
  }
  return out;
}

/** `y` of a sorted polyline at `x` (binary search + linear interpolation). */
export function evalPolyline(poly: ReadonlyArray<Vertex>, x: number): number {
  const n = poly.length;
  if (n === 0) return Number.NaN;
  const first = poly[0]!;
  if (n === 1) return first[1];
  // Past either end the edge holds its end value (an open `extend` end).
  if (x <= first[0]) return first[1];
  const last = poly[n - 1]!;
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (poly[mid]![0] <= x) lo = mid;
    else hi = mid;
  }
  // Indexed reads, not destructuring: this runs per point per zone (1M+ calls).
  const a = poly[lo]!;
  const b = poly[hi]!;
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  // A vertical step, or an unbounded rectangle edge (±Infinity → ∞/∞ = NaN).
  if (bx === ax || ay === by || !Number.isFinite(bx - ax)) return ay;
  const t = (x - ax) / (bx - ax);
  return ay + (by - ay) * t;
}

/** Whether a data point lies inside one resolved zone. */
export function zoneContains(zone: ResolvedZone, x: number, y: number): boolean {
  if (x < zone.x0 || x > zone.x1) return false;
  if (zone.polygon) {
    if (y < zone.y0! || y > zone.y1!) return false;
    return pointInPolygon(zone.polygon, x, y);
  }
  const top = evalPolyline(zone.upper, x);
  const bottom = evalPolyline(zone.lower, x);
  return y <= Math.max(top, bottom) && y >= Math.min(top, bottom);
}

/**
 * One class index per point: the FIRST zone (in `zones` order — inner to outer)
 * that covers it (inside its shape, or outside it for an `invert` zone), else
 * `zones.length` (the outside class).
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
      const r = resolved[z]!;
      // An inverted zone owns what lies OUTSIDE its shape.
      if (zoneContains(r, px, py) !== (r.invert === true)) {
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

export interface ClipWindow {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * A data-unit polyline cut to `win` (Liang–Barsky per segment), as the pieces
 * that fall inside it. Cutting — never clamping each coordinate on its own —
 * keeps every segment's slope: a vertex far outside a zoomed window must not be
 * pulled in along one axis only. ±Infinity (an open end, a line's far side) only
 * ever appears on an axis-parallel segment, so it is first pinned just past the
 * window on its own axis, which leaves that segment's direction unchanged.
 */
export function clipPolyline(poly: ReadonlyArray<Vertex>, win: ClipWindow): Vertex[][] {
  const pin = (v: number, lo: number, hi: number) =>
    v === Infinity ? hi + (hi - lo) : v === -Infinity ? lo - (hi - lo) : v;
  const pts = poly.map(([x, y]) => [pin(x, win.x0, win.x1), pin(y, win.y0, win.y1)] as Vertex);
  const out: Vertex[][] = [];
  let cur: Vertex[] = [];
  const flush = () => {
    if (cur.length >= 2) out.push(cur);
    cur = [];
  };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    let visible = true;
    for (const [p, q] of [
      [-dx, ax - win.x0],
      [dx, win.x1 - ax],
      [-dy, ay - win.y0],
      [dy, win.y1 - ay],
    ] as const) {
      if (p === 0) {
        if (q < 0) visible = false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
      if (!visible || t0 > t1) break;
    }
    if (!visible || t0 > t1) {
      flush();
      continue;
    }
    const s: Vertex = [ax + dx * t0, ay + dy * t0];
    const e: Vertex = [ax + dx * t1, ay + dy * t1];
    const prev = cur[cur.length - 1];
    if (!prev || t0 > 0 || prev[0] !== s[0] || prev[1] !== s[1]) {
      flush();
      cur.push(s);
    }
    cur.push(e);
    if (t1 < 1) flush();
  }
  flush();
  return out;
}

/**
 * The outline of a zone as polylines in DATA units: upper edge, lower edge, and
 * the closing edge at each closed end (a line: the line plus its closed-end
 * verticals; a polygon: one closed ring) — what the foreground paints on top of
 * the dots. Open ends run on to ±Infinity.
 */
export function zoneOutline(zone: DensityZone): Vertex[][] {
  const r = resolveZone(zone);
  if (r.polygon) {
    // One closed ring; its first vertex anchors the in-plot zone tag.
    return r.polygon.length >= 3 ? [[...r.polygon, r.polygon[0]!]] : [];
  }
  const first = (p: Vertex[]) => p[0]!;
  const last = (p: Vertex[]) => p[p.length - 1]!;
  // Open ends run on to ±Infinity (the chart clamps to the window) and get no closing edge.
  const run = (p: Vertex[]): Vertex[] => [
    ...(r.openStart && p.length ? [[-Infinity, first(p)[1]] as Vertex] : []),
    ...p,
    ...(r.openEnd && p.length ? [[Infinity, last(p)[1]] as Vertex] : []),
  ];
  if (r.line) {
    if (r.line.length < 2) return [];
    const far = r.side === "below" ? -Infinity : Infinity;
    const out: Vertex[][] = [run(r.line)];
    if (!r.openStart) out.push([first(r.line), [first(r.line)[0], far]]);
    if (!r.openEnd) out.push([last(r.line), [last(r.line)[0], far]]);
    return out;
  }
  const out: Vertex[][] = [run(r.upper), run(r.lower)];
  if (!r.openStart) out.push([first(r.upper), first(r.lower)]);
  if (!r.openEnd) out.push([last(r.upper), last(r.lower)]);
  return out;
}
