/**
 * analytics/stats.ts — the descriptive statistics behind `analytics[]` lines
 * and bands (ADR 0040 §1, RM-137).
 *
 * ## Why this file exists
 *
 * Every reference line in the package used to draw a number the CALLER had
 * computed. the report-builder BI suite's min/max/average/median/percentile lines and the analytics-pane BI suite's
 * distribution bands (percentiles, ±k standard deviations, a confidence
 * interval of the mean) are all "compute, then draw" — this module is the
 * "compute" half, shared by every family so an average line on a bar chart
 * and one on a scatter agree to the last digit.
 *
 * ## Conventions (deliberate, tested)
 *
 * - **Non-finite inputs are skipped**, never coerced: `null`, `undefined`,
 *   `NaN`, `±Infinity`, strings and dates do not count towards `n`. A
 *   statistic with nothing usable is `null` — the caller draws nothing
 *   rather than a line at `0` (honesty: no invented value).
 * - **Percentiles are 0–100** (`{ percentile: 90 }`, `{ percentiles: [25, 75] }`),
 *   as in the associative BI suite / the report-builder BI suite; they are computed with d3-array's `quantile`,
 *   i.e. the R-7 / Excel `PERCENTILE.INC` linear interpolation.
 * - **Standard deviation is the sample one (n − 1) by default**, population
 *   (n) with `sample: false` — the analytics-pane BI suite's default and its switch.
 * - **Confidence intervals are t-based** on the mean (`n < 2` → `null`). The
 *   Student-t quantile uses exact closed forms for 1 and 2 degrees of
 *   freedom and the Cornish-Fisher expansion (Abramowitz & Stegun 26.7.5)
 *   beyond — accurate to ~1e-3 at df = 3 and to ~1e-6 from df ≈ 10, which is
 *   far below a pixel on any chart.
 *
 * Framework-free: no React, no DOM, no chart context (RM-137). Every function
 * is O(n) apart from the percentile/median family, which sorts (O(n log n)).
 */

import { quantileSorted } from "d3-array";

import type { AnalyticRow, AnalyticSpread, AnalyticValue } from "./types";

// ── Extraction ───────────────────────────────────────────────────────────────

/** `true` for a finite JS number — the only values the analytics count. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The finite numbers of `key` across `rows`, in row order. One pass, one
 * allocation — the entry point of every row-based statistic.
 */
export function finiteValues(rows: readonly AnalyticRow[], key: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const v = (rows[i] as AnalyticRow)[key];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** The finite members of an arbitrary list (`null`/`NaN`/non-numbers dropped). */
export function finiteOnly(values: Iterable<unknown>): number[] {
  const out: number[] = [];
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  return out;
}

// ── Primitives ───────────────────────────────────────────────────────────────

/** Arithmetic mean of the finite values; `null` when there are none. */
export function mean(values: Iterable<unknown>): number | null {
  let n = 0;
  let sum = 0;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    n += 1;
    sum += v;
  }
  return n === 0 ? null : sum / n;
}

/** Sum of the finite values; `null` when there are none (not `0` — nothing was summed). */
export function sum(values: Iterable<unknown>): number | null {
  let n = 0;
  let total = 0;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    n += 1;
    total += v;
  }
  return n === 0 ? null : total;
}

/** Minimum of the finite values; `null` when there are none. */
export function min(values: Iterable<unknown>): number | null {
  let out: number | null = null;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (out === null || v < out) out = v;
  }
  return out;
}

/** Maximum of the finite values; `null` when there are none. */
export function max(values: Iterable<unknown>): number | null {
  let out: number | null = null;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (out === null || v > out) out = v;
  }
  return out;
}

/**
 * The `p`-quantile (`p ∈ [0, 1]`) of the finite values — R-7 linear
 * interpolation via d3-array (`quantile(values, 0.5)` === `median`). `null`
 * when there are no values or `p` is not a finite number; `p` is clamped
 * to `[0, 1]`.
 */
export function quantile(values: Iterable<unknown>, p: number): number | null {
  if (!Number.isFinite(p)) return null;
  const sorted = finiteOnly(values).sort((a, b) => a - b);
  return quantileOfSorted(sorted, p);
}

/** `quantile` on values already filtered and sorted ascending (no copy). */
export function quantileOfSorted(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0 || !Number.isFinite(p)) return null;
  const q = quantileSorted(sorted as number[], Math.min(1, Math.max(0, p)));
  return q === undefined || !Number.isFinite(q) ? null : q;
}

/** Median (the 0.5-quantile, R-7) of the finite values; `null` when there are none. */
export function median(values: Iterable<unknown>): number | null {
  return quantile(values, 0.5);
}

export interface StddevOptions {
  /** `true` (default): sample standard deviation (n − 1). `false`: population (n). */
  sample?: boolean;
}

/**
 * Standard deviation of the finite values (Welford's one-pass algorithm —
 * numerically stable for large offsets such as epoch-ms timestamps).
 * `null` when `n` is 0, or 1 for the sample estimator (undefined there).
 */
export function stddev(values: Iterable<unknown>, options: StddevOptions = {}): number | null {
  const v = variance(values, options);
  return v === null ? null : Math.sqrt(v);
}

/** Variance (sample by default); same conventions as `stddev`. */
export function variance(values: Iterable<unknown>, options: StddevOptions = {}): number | null {
  const sample = options.sample ?? true;
  let n = 0;
  let m = 0;
  let m2 = 0;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    n += 1;
    const delta = v - m;
    m += delta / n;
    m2 += delta * (v - m);
  }
  const denom = sample ? n - 1 : n;
  if (denom <= 0) return null;
  return Math.max(0, m2) / denom;
}

// ── Distribution quantiles ───────────────────────────────────────────────────

/**
 * Inverse of the standard normal CDF (Acklam's rational approximation,
 * relative error < 1.2e-9). `p` outside `(0, 1)` → `±Infinity` / `NaN`.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return Number.NEGATIVE_INFINITY;
    if (p === 1) return Number.POSITIVE_INFINITY;
    return Number.NaN;
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ] as const;
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ] as const;
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ] as const;
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ] as const;
  const pLow = 0.02425;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/**
 * Quantile of Student's t distribution with `df` degrees of freedom. Exact
 * for `df = 1` (Cauchy) and `df = 2`; the Cornish-Fisher expansion in `1/df`
 * (A&S 26.7.5, four correction terms) otherwise. Non-integer `df` is fine.
 */
export function tQuantile(p: number, df: number): number {
  if (!(df > 0) || !Number.isFinite(p)) return Number.NaN;
  if (!Number.isFinite(df)) return normalQuantile(p);
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  if (df === 1) return Math.tan(Math.PI * (p - 0.5));
  if (df === 2) return (2 * p - 1) / Math.sqrt(2 * p * (1 - p));
  const z = normalQuantile(p);
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  const z9 = z7 * z2;
  const g1 = (z3 + z) / 4;
  const g2 = (5 * z5 + 16 * z3 + 3 * z) / 96;
  const g3 = (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / 384;
  const g4 = (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / 92160;
  return z + g1 / df + g2 / df ** 2 + g3 / df ** 3 + g4 / df ** 4;
}

export interface ConfidenceInterval {
  mean: number;
  lower: number;
  upper: number;
  /** `t · s / √n`. */
  halfWidth: number;
  n: number;
}

/**
 * Two-sided t-based confidence interval of the MEAN of the finite values at
 * `level` (e.g. `0.95`). `null` when `n < 2` or `level ∉ (0, 1)`.
 */
export function confidenceInterval(
  values: Iterable<unknown>,
  level = 0.95,
): ConfidenceInterval | null {
  if (!(level > 0 && level < 1)) return null;
  const xs = finiteOnly(values);
  const n = xs.length;
  if (n < 2) return null;
  const m = mean(xs) as number;
  const s = stddev(xs, { sample: true }) as number;
  const halfWidth = tQuantile(1 - (1 - level) / 2, n - 1) * (s / Math.sqrt(n));
  return { mean: m, lower: m - halfWidth, upper: m + halfWidth, halfWidth, n };
}

// ── The `analytics[]` resolvers ──────────────────────────────────────────────

/** A percentile in 0–100 → a probability in 0–1 (`null` when not finite). */
function percentileToP(percentile: number): number | null {
  return Number.isFinite(percentile) ? Math.min(100, Math.max(0, percentile)) / 100 : null;
}

function center(values: number[], around: "mean" | "median" | undefined): number | null {
  return around === "median" ? median(values) : mean(values);
}

/**
 * Resolves one `AnalyticValue` against `rows[*][key]` (ADR 0040 §1):
 *
 * - a number → itself (when finite);
 * - `"mean" | "median" | "min" | "max" | "sum"` → that statistic;
 * - `{ percentile: p }` (0–100) → the R-7 quantile;
 * - `{ stddev: k, around?, sample? }` → `centre + k · s` (centre: mean by
 *   default; `s`: sample std-dev by default) — use `k < 0` for the line below;
 * - a function → its return value (non-finite → `null`).
 *
 * `null` whenever nothing usable remains. O(n) for the mean/min/max/sum
 * family (a single pass, no sort).
 */
export function resolveAnalyticValue(
  rows: readonly AnalyticRow[],
  key: string,
  value: AnalyticValue,
): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "function") {
    const out = value(rows, key);
    return isFiniteNumber(out) ? out : null;
  }
  if (typeof value === "string") {
    switch (value) {
      case "mean":
      case "min":
      case "max":
      case "sum":
        return reduceRows(rows, key, value);
      case "median":
        return median(finiteValues(rows, key));
      default:
        return null;
    }
  }
  if ("percentile" in value) {
    const p = percentileToP(value.percentile);
    return p === null ? null : quantile(finiteValues(rows, key), p);
  }
  if ("stddev" in value) {
    if (!Number.isFinite(value.stddev)) return null;
    const xs = finiteValues(rows, key);
    const c = center(xs, value.around);
    const s = stddev(xs, { sample: value.sample ?? true });
    if (c === null || s === null) return null;
    return c + value.stddev * s;
  }
  return null;
}

/** One pass over the rows for the non-sorting reducers (no intermediate array). */
function reduceRows(
  rows: readonly AnalyticRow[],
  key: string,
  op: "mean" | "min" | "max" | "sum",
): number | null {
  let n = 0;
  let acc = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const v = (rows[i] as AnalyticRow)[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (n === 0) acc = op === "mean" || op === "sum" ? 0 : v;
    n += 1;
    if (op === "mean" || op === "sum") acc += v;
    else if (op === "min" ? v < acc : v > acc) acc = v;
  }
  if (n === 0) return null;
  return op === "mean" ? acc / n : acc;
}

/**
 * Resolves a band preset (`AnalyticSpread`) against `rows[*][key]`:
 *
 * - `{ percentiles: [lo, hi] }` (0–100) → the two R-7 quantiles (ordered);
 * - `{ stddev: k, around?, sample? }` → `centre ∓ |k| · s`, symmetric;
 * - `{ ci: level }` → the t-based confidence interval of the mean (`n < 2` → `null`).
 *
 * Always returns `from <= to`; `null` when nothing usable remains.
 */
export function spreadBand(
  rows: readonly AnalyticRow[],
  key: string,
  spread: AnalyticSpread,
): { from: number; to: number } | null {
  const xs = finiteValues(rows, key);
  if (xs.length === 0) return null;

  if ("percentiles" in spread) {
    const [lo, hi] = spread.percentiles;
    const pLo = percentileToP(lo);
    const pHi = percentileToP(hi);
    if (pLo === null || pHi === null) return null;
    const sorted = xs.sort((a, b) => a - b);
    const a = quantileOfSorted(sorted, pLo);
    const b = quantileOfSorted(sorted, pHi);
    if (a === null || b === null) return null;
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  if ("stddev" in spread) {
    if (!Number.isFinite(spread.stddev)) return null;
    const c = center(xs, spread.around);
    const s = stddev(xs, { sample: spread.sample ?? true });
    if (c === null || s === null) return null;
    const half = Math.abs(spread.stddev) * s;
    return { from: c - half, to: c + half };
  }

  if ("ci" in spread) {
    const ci = confidenceInterval(xs, spread.ci);
    return ci === null ? null : { from: ci.lower, to: ci.upper };
  }

  return null;
}
