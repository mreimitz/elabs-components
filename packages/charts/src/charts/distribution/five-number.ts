/**
 * five-number.ts — the box plot's arithmetic, on its own, with no React and no
 * drawing in it (RM-026).
 *
 * Provenance: `F15 Tick Box` in the lieflat gallery — a capsule IQR box, a paper
 * median tick, hairline whiskers and hollow marks for whatever falls outside the
 * fences.
 *
 * ## Why this is a separate, dependency-free module
 *
 * A box plot is four decisions (which quantile definition, where the whiskers
 * stop, what counts as an outlier, what happens to a hole in the data) and one
 * drawing. Bundling them into the component would make every one of those
 * decisions untestable except through the DOM — so they live here, as functions
 * over `number[]`, and `box.tsx` only draws what comes back.
 *
 * ## The quantile definition is R-7, and that is load-bearing
 *
 * {@link quantileSorted} implements the linear-interpolation quantile (Hyndman &
 * Fan type 7) — the same definition `d3-array`'s `quantile` uses, which is what
 * every other chart in this package and every consumer already reading d3 will
 * expect. It is re-implemented rather than delegated so the agreement is a
 * TESTED claim (`five-number.test.ts` checks this module against `d3.quantile`
 * over random samples) instead of a tautology. A different definition (nearest
 * rank, Tukey hinges) would move the box edges by up to one observation on small
 * samples — visible, and silently disagreeing with the consumer's own stats.
 */

/**
 * Tukey's multiplier: a value further than 1.5 × IQR beyond a quartile is drawn
 * as an outlier rather than reached by a whisker. It is a convention, not a
 * significance test — hence overridable.
 */
export const DEFAULT_WHISKER_MULTIPLIER = 1.5;

/** The five-number summary plus the fence/outlier split a box plot needs to draw. */
export interface FiveNumberSummary {
  /** How many finite values went into the summary. */
  n: number;
  /** Smallest value, outliers included. */
  min: number;
  /** First quartile (25th percentile, R-7). */
  q1: number;
  /** Second quartile / median (R-7). */
  median: number;
  /** Third quartile (75th percentile, R-7). */
  q3: number;
  /** Largest value, outliers included. */
  max: number;
  /** `q3 - q1` — the box's own length. */
  iqr: number;
  /** `q1 - multiplier × IQR`. Nothing is drawn here; it is where the whisker may reach. */
  lowerFence: number;
  /** `q3 + multiplier × IQR`. */
  upperFence: number;
  /** Smallest value still at or above {@link lowerFence} — where the lower whisker ENDS. */
  lowerWhisker: number;
  /** Largest value still at or below {@link upperFence} — where the upper whisker ENDS. */
  upperWhisker: number;
  /** Every value outside the fences, in ascending order. */
  outliers: number[];
}

/**
 * Keep the finite numbers, in ascending order. Non-finite entries (`NaN`,
 * `±Infinity`, `null` coerced by a caller) are DROPPED rather than coerced to
 * zero — a hole in the data must not pull a quartile toward the origin.
 */
export function sortedFinite(values: Iterable<number>): number[] {
  const kept: number[] = [];
  for (const value of values) {
    if (Number.isFinite(value)) kept.push(value);
  }
  return kept.sort((a, b) => a - b);
}

/**
 * The p-quantile of an ALREADY SORTED, all-finite array, by linear
 * interpolation between order statistics (R-7 — `d3-array`'s definition).
 *
 * @param sorted ascending, finite. Passing an unsorted array is a caller bug,
 *   not a handled case: sorting inside would turn every quartile read on one
 *   group into another O(n log n) pass.
 * @param p in `[0, 1]`; clamped.
 * @returns `NaN` for an empty array — the honest answer, and what `d3.quantile`
 *   returns too (it yields `undefined`; `NaN` keeps this function's return type
 *   a plain `number`, and every caller here checks `n > 0` first).
 */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0] as number;
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  const h = (n - 1) * clamped;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const low = sorted[lo] as number;
  const high = sorted[hi] as number;
  return low + (h - lo) * (high - low);
}

/**
 * The five-number summary of `values`, with Tukey fences and the outlier split.
 *
 * @param values any iterable of numbers; non-finite entries are dropped (see
 *   {@link sortedFinite}).
 * @param whiskerMultiplier defaults to {@link DEFAULT_WHISKER_MULTIPLIER}.
 * @returns `undefined` when nothing finite is left — a group with no data draws
 *   NO box, which is the only truthful mark for it. Callers must not substitute
 *   zeros.
 */
export function fiveNumberSummary(
  values: Iterable<number>,
  whiskerMultiplier: number = DEFAULT_WHISKER_MULTIPLIER,
): FiveNumberSummary | undefined {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n === 0) return undefined;

  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - whiskerMultiplier * iqr;
  const upperFence = q3 + whiskerMultiplier * iqr;

  const outliers: number[] = [];
  let lowerWhisker = Number.POSITIVE_INFINITY;
  let upperWhisker = Number.NEGATIVE_INFINITY;
  for (const value of sorted) {
    if (value < lowerFence || value > upperFence) {
      outliers.push(value);
      continue;
    }
    if (value < lowerWhisker) lowerWhisker = value;
    if (value > upperWhisker) upperWhisker = value;
  }
  // Every value outside the fences is possible in principle (a two-point sample
  // where IQR is 0 and the points differ). Then the whiskers collapse onto the
  // quartiles rather than reporting ±Infinity.
  if (outliers.length === n) {
    lowerWhisker = q1;
    upperWhisker = q3;
  }

  return {
    n,
    min: sorted[0] as number,
    q1,
    median,
    q3,
    max: sorted[n - 1] as number,
    iqr,
    lowerFence,
    upperFence,
    lowerWhisker,
    upperWhisker,
    outliers,
  };
}
