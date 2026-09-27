/**
 * stat-lines.ts — average / median / standard-deviation reference lines for
 * `DensityScatterChart`, overall or one per colour class (zone or category).
 *
 * Framework-free and allocation-light: one pass per statistic over the typed
 * columns, a per-class gather + sort only for medians. The statistics follow
 * `analytics/stats.ts` (Welford sample standard deviation, R-7 median), so a
 * density scatter and an ADR 0040 `analytics` line agree on the same data.
 */

import { quantileOfSorted } from "../analytics/stats";
import type { DensityPoints } from "./types";

/** The statistic a line marks. `{ stddev: k }` draws the pair mean ± k·σ. */
export type DensityStatistic = "mean" | "median" | { stddev: number };

/** One requested reference line (or σ pair). */
export interface DensityStatLine {
  /** Which coordinate the statistic is taken of. `"y"` (default) draws a horizontal line. */
  axis?: "x" | "y";
  value: DensityStatistic;
  /**
   * `"class"` (default): one line per visible colour class — per zone when
   * colouring by zone, per category when colouring by category. `"all"`: one
   * line over every visible point.
   */
  by?: "all" | "class";
  /**
   * `"computation"` (default, "Core · Average 1.2k"), `"value"` ("1.2k"),
   * `"none"` (the accessible description still restates it) or your own text.
   */
  label?: "computation" | "value" | "none" | (string & {});
  /** Stroke pattern. Defaults differ per statistic so colour is never the only cue. */
  style?: "solid" | "dashed" | "dotted";
  /**
   * How far a per-class line runs: `"class"` (default for `by: "class"`) spans
   * that class's own points on the other axis; `"plot"` spans the plot.
   */
  span?: "class" | "plot";
}

/** A computed line, ready to draw. */
export interface ResolvedStatLine {
  /** Stable key (request index, class, side). */
  key: string;
  axis: "x" | "y";
  /** The statistic's value in data units. */
  value: number;
  /** Class index into the paint classes, or `-1` for all points. */
  cls: number;
  /** Which statistic — for the label and the dash. */
  stat: "mean" | "median" | "stddev";
  /** For σ lines: the signed multiple (`+1`, `-1`, `+2` …). */
  k?: number;
  /** Extent on the OTHER axis in data units; `null` = the whole plot. */
  extent: [number, number] | null;
  style: "solid" | "dashed" | "dotted";
  label: DensityStatLine["label"];
  /** Points behind the statistic. */
  n: number;
}

export interface ResolveStatLinesInput {
  points: DensityPoints;
  /** Paint class per point. */
  cls: ArrayLike<number>;
  /** Number of paint classes. */
  classCount: number;
  /** `hidden[k]` → class k is skipped (not drawn, not counted in "all"). */
  hidden?: readonly boolean[];
  lines: readonly DensityStatLine[];
}

const DEFAULT_STYLE: Record<ResolvedStatLine["stat"], ResolvedStatLine["style"]> = {
  mean: "dashed",
  median: "dotted",
  stddev: "dotted",
};

interface Moments {
  n: Float64Array;
  mean: Float64Array;
  m2: Float64Array;
  lo: Float64Array;
  hi: Float64Array;
}

/** Per-class count, mean, M2 (Welford) of `col`, and the extent of `other`. */
function moments(
  col: Float32Array,
  other: Float32Array,
  cls: ArrayLike<number>,
  slots: number,
  hidden: readonly boolean[] | undefined,
): Moments {
  // Slot `slots` accumulates every visible point ("all").
  const size = slots + 1;
  const m: Moments = {
    n: new Float64Array(size),
    mean: new Float64Array(size),
    m2: new Float64Array(size),
    lo: new Float64Array(size).fill(Infinity),
    hi: new Float64Array(size).fill(-Infinity),
  };
  const add = (s: number, v: number, o: number) => {
    const n = (m.n[s] = m.n[s]! + 1);
    const d = v - m.mean[s]!;
    m.mean[s] = m.mean[s]! + d / n;
    m.m2[s] = m.m2[s]! + d * (v - m.mean[s]!);
    if (o < m.lo[s]!) m.lo[s] = o;
    if (o > m.hi[s]!) m.hi[s] = o;
  };
  for (let i = 0; i < col.length; i++) {
    const k = cls[i]!;
    if (k >= slots || hidden?.[k]) continue;
    const v = col[i]!;
    const o = other[i]!;
    if (!Number.isFinite(v) || !Number.isFinite(o)) continue;
    add(k, v, o);
    add(slots, v, o);
  }
  return m;
}

/** Per-class medians of `col` (slot `slots` = all visible points). */
function medians(
  col: Float32Array,
  cls: ArrayLike<number>,
  slots: number,
  counts: Float64Array,
  hidden: readonly boolean[] | undefined,
): (number | null)[] {
  const buckets = Array.from({ length: slots + 1 }, (_, s) => new Float64Array(counts[s]!));
  const fill = new Uint32Array(slots + 1);
  for (let i = 0; i < col.length; i++) {
    const k = cls[i]!;
    if (k >= slots || hidden?.[k]) continue;
    const v = col[i]!;
    if (!Number.isFinite(v)) continue;
    buckets[k]![fill[k]!++] = v;
    buckets[slots]![fill[slots]!++] = v;
  }
  return buckets.map((b, s) => {
    const sorted = b.subarray(0, fill[s]!).sort();
    return quantileOfSorted(sorted as unknown as number[], 0.5);
  });
}

/**
 * Resolves the requested lines against the data. Classes with no points (or
 * hidden ones) get no line; a σ with fewer than two points gets none either.
 */
export function resolveStatLines({
  points,
  cls,
  classCount,
  hidden,
  lines,
}: ResolveStatLinesInput): ResolvedStatLine[] {
  if (!lines.length || points.n === 0) return [];
  const slots = Math.max(1, classCount);
  const cache = new Map<string, { m: Moments; med?: (number | null)[] }>();
  const stats = (axis: "x" | "y") => {
    let hit = cache.get(axis);
    if (!hit) {
      const [col, other] = axis === "x" ? [points.x, points.y] : [points.y, points.x];
      hit = { m: moments(col, other, cls, slots, hidden) };
      cache.set(axis, hit);
    }
    return hit;
  };
  const median = (axis: "x" | "y") => {
    const hit = stats(axis);
    if (!hit.med) {
      const col = axis === "x" ? points.x : points.y;
      hit.med = medians(col, cls, slots, hit.m.n, hidden);
    }
    return hit.med;
  };

  const out: ResolvedStatLine[] = [];
  lines.forEach((line, li) => {
    const axis = line.axis ?? "y";
    const by = line.by ?? "class";
    const stat: ResolvedStatLine["stat"] =
      typeof line.value === "object" ? "stddev" : line.value === "median" ? "median" : "mean";
    const style = line.style ?? DEFAULT_STYLE[stat];
    const { m } = stats(axis);
    const targets = by === "all" ? [slots] : Array.from({ length: slots }, (_, k) => k);
    for (const s of targets) {
      const n = m.n[s]!;
      if (n === 0) continue;
      const clsIndex = s === slots ? -1 : s;
      const spanPlot = clsIndex === -1 || line.span === "plot";
      const extent: [number, number] | null = spanPlot ? null : [m.lo[s]!, m.hi[s]!];
      const base = { axis, cls: clsIndex, style, label: line.label, n, extent };
      if (stat === "mean") {
        out.push({ ...base, key: `${li}-${s}`, stat, value: m.mean[s]! });
      } else if (stat === "median") {
        const v = median(axis)[s];
        if (v !== null && v !== undefined) out.push({ ...base, key: `${li}-${s}`, stat, value: v });
      } else {
        const k = Math.abs((line.value as { stddev: number }).stddev);
        if (n < 2 || !Number.isFinite(k) || k === 0) continue;
        const sd = Math.sqrt(Math.max(0, m.m2[s]!) / (n - 1));
        const mu = m.mean[s]!;
        out.push({ ...base, key: `${li}-${s}-hi`, stat, k, value: mu + k * sd });
        out.push({ ...base, key: `${li}-${s}-lo`, stat, k: -k, value: mu - k * sd });
      }
    }
  });
  return out;
}

/** The on-screen / described name of a line's statistic ("Average", "Median", "+1σ"). */
export function statName(
  line: Pick<ResolvedStatLine, "stat" | "k">,
  names: { average: string; median: string },
): string {
  if (line.stat === "mean") return names.average;
  if (line.stat === "median") return names.median;
  const k = line.k ?? 1;
  return `${k < 0 ? "−" : "+"}${Math.abs(k)}σ`;
}

/** SVG dash array for a line style. */
export function statDash(style: ResolvedStatLine["style"]): string | undefined {
  if (style === "dashed") return "6 4";
  if (style === "dotted") return "2 3";
  return undefined;
}
