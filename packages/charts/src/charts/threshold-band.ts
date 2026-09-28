/**
 * Shared by Bullet's qualitative-range bands and Gauge's threshold bands —
 * both need "which band does this value fall in" and differ only in what a
 * band looks like (`{ to, label }` vs `{ value, label }`) and whether the
 * caller's array is already sorted. Pure, framework-free.
 */

/**
 * The first `band` whose `upperBound(band) >= value`, else the last (open-ended,
 * top) band once `value` exceeds every bound. `undefined` when `bands` is empty.
 *
 * `bands` must already be in ASCENDING order by `upperBound` — sort first if the
 * caller's own array isn't guaranteed sorted.
 */
export function findThresholdBand<T>(
  value: number,
  bands: readonly T[],
  upperBound: (band: T) => number,
): T | undefined {
  if (bands.length === 0) return undefined;
  for (const band of bands) {
    if (value <= upperBound(band)) return band;
  }
  return bands[bands.length - 1];
}
