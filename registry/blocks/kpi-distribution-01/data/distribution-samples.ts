/**
 * Record-level samples for the two distribution cards — delivery time (hours)
 * and warehouse pick time (minutes). Both are consistent with the shared
 * fictional "Acme Logistics" Q3 dataset (`kpi-card-parts/data/acme-quarter`):
 * delivery hours are generated so their MEAN lands on Acme's actual average
 * delivery time (36.2 h, `avgDeliveryHours.actual`) — the whole point of this
 * card is that the mean alone hides how much of the tail misses the SLA.
 *
 * Every array is generated ONCE, deterministically, from a seeded hash — never
 * `Math.random()`, so the same picture renders on every machine and every
 * Storybook run. The hash mirrors `seededRnd` in
 * `@elabs-ai/components-charts/src/marks/seeded-rnd.ts` (not part of that
 * package's public API, so it is re-declared here rather than imported).
 */

const HASH_A = 73_856_093;
const HASH_B = 19_349_663;

/** A deterministic pseudo-random number in `[0, 1)` for the pair `(i, k)`. */
function seededRandom(i: number, k: number): number {
  return Math.abs(((i * HASH_A) ^ (k * HASH_B)) % 1000) / 1000;
}

/**
 * `low + range·u²`, `u` uniform: a right-skewed shape — most records cluster
 * near `low`, a longer tail runs toward `low + range`. The distribution every
 * "most are fast, a few are slow" operational metric actually has.
 */
function skewedSamples(n: number, seed: number, low: number, range: number): number[] {
  return Array.from({ length: n }, (_, i) => low + range * seededRandom(i, seed) ** 2);
}

export const SAMPLE_SIZE = 400;

/**
 * Delivery time, in hours, this quarter. Tuned so the mean (≈36.2 h) matches
 * `avgDeliveryHours.actual` in the shared dataset — the median (≈34 h) and p90
 * (≈50 h) are computed from these samples at render time, never typed
 * separately, so they can never silently disagree with the mean.
 */
export const deliveryHoursSamples: number[] = skewedSamples(SAMPLE_SIZE, 101, 26.55, 28.95);

/** Same shape, last quarter — tighter and faster, the "before" this quarter's tail grew from. */
export const deliveryHoursSamplesPriorQuarter: number[] = skewedSamples(SAMPLE_SIZE, 301, 24, 22);

/**
 * Warehouse pick time, in minutes, this quarter. A separate operational metric
 * from `acme-quarter`'s KPI list — its own SLA (95% within 20 min) is comfortably
 * met, which is the deliberate contrast with delivery time on this card: two
 * "is it consistent?" questions, one answered yes and one answered no.
 */
export const pickTimeMinutesSamples: number[] = skewedSamples(SAMPLE_SIZE, 202, 6, 14);

/** Same shape, last quarter. */
export const pickTimeMinutesSamplesPriorQuarter: number[] = skewedSamples(
  SAMPLE_SIZE,
  402,
  5.5,
  12,
);
