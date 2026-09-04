/**
 * Visual-scale helpers shared by every process view — RM-049.
 *
 * One implementation, so RM-051's edge width, RM-054's coverage bar and RM-050's
 * abstraction threshold all agree on what "the 90th percentile" and "map this count to a
 * stroke width" mean. Re-deriving a quantile per component is how two views end up
 * disagreeing about the same log.
 *
 * All three are pure and total: they never throw, and they answer for the degenerate
 * inputs (empty array, zero-width domain) rather than returning `NaN`.
 */

/** Ascending numeric comparator. Extracted so every sort in `/core` uses the same one. */
export function ascending(a: number, b: number): number {
  return a - b;
}

/** Only finite samples take part in a scale; `NaN`/`Infinity` are dropped, not propagated. */
function finiteOnly(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of values) if (Number.isFinite(v)) out.push(v);
  return out;
}

/**
 * The extent of `values`, ignoring non-finite entries.
 *
 * @returns `[min, max]`, or `[0, 0]` when there is nothing finite to measure.
 */
export function minMax(values: readonly number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let seen = false;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    seen = true;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return seen ? [min, max] : [0, 0];
}

/**
 * The `q`-quantile of an ALREADY ASCENDING-SORTED, all-finite array, by linear
 * interpolation between order statistics (the R-7 / `d3.quantile` definition).
 *
 * Exported for callers that already hold a sorted array — {@link durationStats} sorts
 * once and reads several quantiles off it. Use {@link quantile} when the input is not
 * known to be sorted.
 */
export function quantileSorted(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0] as number;
  const clamped = q < 0 ? 0 : q > 1 ? 1 : q;
  const pos = clamped * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const loValue = sorted[lo] as number;
  if (lo === hi) return loValue;
  const hiValue = sorted[hi] as number;
  return loValue + (hiValue - loValue) * (pos - lo);
}

/**
 * The `q`-quantile of `values` (0 ≤ `q` ≤ 1; out-of-range values are clamped).
 *
 * Sorts a COPY, so the caller's array is untouched. Non-finite entries are dropped;
 * an empty (or all-non-finite) input answers `0`.
 */
export function quantile(values: readonly number[], q: number): number {
  return quantileSorted(finiteOnly(values).sort(ascending), q);
}

/**
 * Map `value` from `domain` onto `range`, clamped to the range's endpoints.
 *
 * The workhorse behind "frequency → stroke width" and "share → bar length". A
 * DEGENERATE domain (`d0 === d1`, e.g. a graph whose every edge has the same count)
 * answers `range[0]`: with a zero-width domain every input sits at the domain floor, so
 * the range floor is the consistent answer — and it is what the clamped interpolation
 * gives for any `value <= d0`. A caller that wants a different neutral (the widest
 * stroke, say) special-cases it explicitly rather than relying on a surprise here.
 *
 * A descending domain (`d0 > d1`) is honoured — it simply inverts the mapping.
 */
export function clampWidth(
  value: number,
  domain: readonly [number, number],
  range: readonly [number, number],
): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (!Number.isFinite(value)) return r0;
  const span = d1 - d0;
  if (span === 0) return r0;
  const t = (value - d0) / span;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return r0 + (r1 - r0) * clamped;
}
