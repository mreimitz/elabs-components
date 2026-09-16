/**
 * Pure SVG path sampling — the position maths behind `FlowEdgeTokens`.
 *
 * `SVGGeometryElement.getPointAtLength` would do the same job in a browser, but
 * it needs a mounted element (so a layout effect and a second render) and jsdom
 * implements none of it. Parsing the `d` string here keeps a token's position a
 * plain function of `(path, progress)`: identical on the server, in jsdom and in
 * every browser, and testable without a DOM.
 *
 * Supports every path command (`M L H V C S Q T A Z`, absolute and relative) in
 * the spellings React Flow's path helpers emit (`M0,0 C…`, `M 0,0L …`, `M0 0`).
 * Curves and arcs are flattened into a polyline fine enough that a token sits on
 * the drawn stroke; progress is measured along that polyline's arc length, so a
 * token moves at an even speed regardless of how the curve's control points are
 * spaced.
 */

export interface EdgePathPoint {
  x: number;
  y: number;
}

export interface EdgePathSampler {
  /** Total arc length of the path, in px. */
  length: number;
  /** The point at `progress` (0..1) of the path's arc length. Out-of-range or non-finite progress is clamped. */
  pointAt: (progress: number) => EdgePathPoint;
}

/** Polyline segments per cubic/quadratic curve — enough that the chord error stays sub-pixel at edge scale. */
const CURVE_STEPS = 32;
/** Maximum angle, in radians, spanned by one polyline segment of an elliptical arc. */
const ARC_STEP = Math.PI / 32;

const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/;

/** Cursor-based scanner: SVG path grammar allows `1-2`, `.5.5` and compact arc flags (`0 01`). */
class PathScanner {
  private i = 0;
  constructor(private readonly d: string) {}

  private skipSeparators() {
    while (this.i < this.d.length && /[\s,]/.test(this.d[this.i]!)) this.i++;
  }

  peekCommand(): string | null {
    this.skipSeparators();
    const ch = this.d[this.i];
    return ch !== undefined && COMMAND.test(ch) ? ch : null;
  }

  readCommand(): string {
    const cmd = this.d[this.i]!;
    this.i++;
    return cmd;
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.i >= this.d.length;
  }

  hasNumber(): boolean {
    this.skipSeparators();
    const ch = this.d[this.i];
    return ch !== undefined && /[-+.\d]/.test(ch);
  }

  readNumber(): number {
    this.skipSeparators();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(this.d.slice(this.i));
    if (!m) return Number.NaN;
    this.i += m[0].length;
    return Number(m[0]);
  }

  readFlag(): number {
    this.skipSeparators();
    const ch = this.d[this.i];
    if (ch === "0" || ch === "1") {
      this.i++;
      return Number(ch);
    }
    return Number.NaN;
  }

  /** Skip one unparseable character so a malformed path can never loop forever. */
  skip() {
    this.i++;
  }
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function quadAt(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return sign * Math.acos(Math.min(1, Math.max(-1, dot / len)));
}

/** Flatten an endpoint-parameterised elliptical arc (SVG 1.1 §F.6.5) into points after the start. */
function arcPoints(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): EdgePathPoint[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ x: x2, y: y2 }];

  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const steps = Math.max(1, Math.ceil(Math.abs(delta) / ARC_STEP));
  const out: EdgePathPoint[] = [];
  for (let s = 1; s <= steps; s++) {
    if (s === steps) {
      out.push({ x: x2, y: y2 });
      break;
    }
    const a = theta1 + (delta * s) / steps;
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    out.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
  return out;
}

/**
 * Flatten a path `d` string into subpath polylines. Each subpath starts at its
 * `M`. Parsing stops at the first malformed argument; everything before it is kept.
 */
export function flattenEdgePath(d: string): EdgePathPoint[][] {
  const scan = new PathScanner(d);
  const subpaths: EdgePathPoint[][] = [];
  let current: EdgePathPoint[] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Reflected control point for S/T; reset by any other command.
  let lastCubic: EdgePathPoint | null = null;
  let lastQuad: EdgePathPoint | null = null;
  let cmd: string | null = null;

  const lineTo = (nx: number, ny: number) => {
    if (!current) {
      current = [{ x, y }];
      subpaths.push(current);
    }
    current.push({ x: nx, y: ny });
    x = nx;
    y = ny;
  };

  while (!scan.atEnd()) {
    const next = scan.peekCommand();
    if (next) {
      cmd = scan.readCommand();
    } else if (!cmd || !scan.hasNumber()) {
      scan.skip();
      continue;
    }
    // After an `M`, further coordinate pairs are implicit line-tos.
    const active: string = cmd!;
    const rel = active === active.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const upper = active.toUpperCase();

    if (upper === "Z") {
      lineTo(startX, startY);
      current = null;
      lastCubic = lastQuad = null;
      cmd = null;
      continue;
    }

    const n: number[] = [];
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[upper] ?? 0;
    for (let k = 0; k < arity; k++) {
      n.push(upper === "A" && (k === 3 || k === 4) ? scan.readFlag() : scan.readNumber());
    }
    if (n.some((v) => !Number.isFinite(v))) break;

    switch (upper) {
      case "M": {
        x = n[0]! + ox;
        y = n[1]! + oy;
        startX = x;
        startY = y;
        current = [{ x, y }];
        subpaths.push(current);
        cmd = rel ? "l" : "L";
        lastCubic = lastQuad = null;
        break;
      }
      case "L":
        lineTo(n[0]! + ox, n[1]! + oy);
        lastCubic = lastQuad = null;
        break;
      case "H":
        lineTo(n[0]! + ox, y);
        lastCubic = lastQuad = null;
        break;
      case "V":
        lineTo(x, n[0]! + oy);
        lastCubic = lastQuad = null;
        break;
      case "C":
      case "S": {
        const reflected: EdgePathPoint | null = lastCubic;
        let c1x = x;
        let c1y = y;
        if (upper === "C") {
          c1x = n[0]! + ox;
          c1y = n[1]! + oy;
        } else if (reflected) {
          c1x = 2 * x - reflected.x;
          c1y = 2 * y - reflected.y;
        }
        const rest = upper === "C" ? n.slice(2) : n;
        const c2x = rest[0]! + ox;
        const c2y = rest[1]! + oy;
        const ex = rest[2]! + ox;
        const ey = rest[3]! + oy;
        const x0 = x;
        const y0 = y;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const t = s / CURVE_STEPS;
          lineTo(cubicAt(x0, c1x, c2x, ex, t), cubicAt(y0, c1y, c2y, ey, t));
        }
        lastCubic = { x: c2x, y: c2y };
        lastQuad = null;
        break;
      }
      case "Q":
      case "T": {
        const reflected: EdgePathPoint | null = lastQuad;
        let qx = x;
        let qy = y;
        if (upper === "Q") {
          qx = n[0]! + ox;
          qy = n[1]! + oy;
        } else if (reflected) {
          qx = 2 * x - reflected.x;
          qy = 2 * y - reflected.y;
        }
        const rest = upper === "Q" ? n.slice(2) : n;
        const ex = rest[0]! + ox;
        const ey = rest[1]! + oy;
        const x0 = x;
        const y0 = y;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const t = s / CURVE_STEPS;
          lineTo(quadAt(x0, qx, ex, t), quadAt(y0, qy, ey, t));
        }
        lastQuad = { x: qx, y: qy };
        lastCubic = null;
        break;
      }
      case "A": {
        const pts = arcPoints(x, y, n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]! + ox, n[6]! + oy);
        for (const p of pts) lineTo(p.x, p.y);
        lastCubic = lastQuad = null;
        break;
      }
    }
  }
  return subpaths;
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(1, Math.max(0, t));
}

/**
 * Build a sampler for a path `d` string, or `null` when the string describes no
 * geometry at all (empty, or not a path). A path that is a single point has
 * length 0 and samples to that point for every progress.
 *
 * Subpaths are walked in order and the jump between them is not counted — a
 * token never travels through the gap an `M` leaves.
 */
export function createEdgePathSampler(d: string): EdgePathSampler | null {
  const points: EdgePathPoint[] = [];
  const cumulative: number[] = [];
  let total = 0;
  for (const sub of flattenEdgePath(d)) {
    sub.forEach((p, idx) => {
      if (idx > 0) {
        const prev = sub[idx - 1]!;
        total += Math.hypot(p.x - prev.x, p.y - prev.y);
      }
      points.push(p);
      cumulative.push(total);
    });
  }
  if (points.length === 0) return null;

  const pointAt = (progress: number): EdgePathPoint => {
    const target = clamp01(progress) * total;
    // Binary search for the first vertex at or past `target`.
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid]! < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return { ...points[0]! };
    const segStart = cumulative[lo - 1]!;
    const segLen = cumulative[lo]! - segStart;
    const a = points[lo - 1]!;
    const b = points[lo]!;
    const t = segLen === 0 ? 1 : (target - segStart) / segLen;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  return { length: total, pointAt };
}
