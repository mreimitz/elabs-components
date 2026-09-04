/**
 * Duration summary statistics — RM-049.
 *
 * The single implementation every part of the core reads: per-activity execution time,
 * per-edge flow time and per-variant case time all pass through here, which is what makes
 * "the variant's median agrees with the edge's median on the same fixture" true by
 * construction rather than by coincidence.
 *
 * Algorithm shape (which statistics a discovered graph carries per activity and per edge)
 * follows pm4js — see `ATTRIBUTION.md`. No pm4js code is copied; the arithmetic below is
 * the ordinary textbook definition.
 */
import { ascending, quantileSorted } from "./scale";
import type { DurationStats } from "./types";

/** The fraction discarded from EACH tail by `trimmedMean`. */
export const TRIM_FRACTION = 0.1;

/** All-zero statistics — the answer for an empty sample set. */
export const EMPTY_DURATION_STATS: Readonly<DurationStats> = Object.freeze({
  min: 0,
  max: 0,
  mean: 0,
  median: 0,
  p90: 0,
  sum: 0,
  trimmedMean: 0,
});

/** A fresh mutable copy of {@link EMPTY_DURATION_STATS}. */
export function emptyDurationStats(): DurationStats {
  return { ...EMPTY_DURATION_STATS };
}

/**
 * Summarize `samples` (milliseconds) as {@link DurationStats}.
 *
 * - Non-finite samples are DROPPED, not propagated — one unparseable timestamp upstream
 *   must not turn an entire activity's statistics into `NaN`.
 * - The input array is not mutated (a copy is sorted).
 * - `p90` uses linear interpolation between order statistics (R-7 / `d3.quantile`).
 * - `trimmedMean` discards the lowest and highest {@link TRIM_FRACTION} of samples. When
 *   trimming would leave nothing (fewer than 5 samples, where `floor(n * 0.1)` is 0 or
 *   the tails meet), it degrades to the plain mean rather than to `NaN`.
 * - An empty (or all-non-finite) input answers all zeros.
 */
export function durationStats(samples: readonly number[]): DurationStats {
  const sorted: number[] = [];
  for (const s of samples) if (Number.isFinite(s)) sorted.push(s);
  const n = sorted.length;
  if (n === 0) return emptyDurationStats();
  sorted.sort(ascending);

  let sum = 0;
  for (const s of sorted) sum += s;

  const trim = Math.floor(n * TRIM_FRACTION);
  const lo = trim;
  const hi = n - trim;
  let trimmedMean: number;
  if (hi - lo <= 0) {
    trimmedMean = sum / n;
  } else {
    let trimmedSum = 0;
    for (let i = lo; i < hi; i += 1) trimmedSum += sorted[i] as number;
    trimmedMean = trimmedSum / (hi - lo);
  }

  return {
    min: sorted[0] as number,
    max: sorted[n - 1] as number,
    mean: sum / n,
    median: quantileSorted(sorted, 0.5),
    p90: quantileSorted(sorted, 0.9),
    sum,
    trimmedMean,
  };
}

/** Default reservoir capacity for a single activity's or edge's duration samples. */
export const DURATION_SAMPLE_CAP = 4096;

/**
 * A deterministic 32-bit PRNG (mulberry32). Same seed, same stream — which is the whole
 * point: the reservoir below must make identical keep/discard decisions on every run, in
 * every engine, or two runs over one log would produce different `p90`s.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bounded duration-sample collector.
 *
 * A log with a million events would otherwise hold a million numbers per hot edge just to
 * compute seven statistics from them. The first {@link DURATION_SAMPLE_CAP} samples are
 * kept outright; past the cap the collector switches to reservoir sampling (Algorithm R),
 * so the retained set stays a uniform sample of everything seen while memory stays flat.
 *
 * `count` keeps the TRUE number of samples offered, and `sum` the true total, so a
 * capped edge still reports an exact `sum` and an exact `mean`; only the order statistics
 * (`median`, `p90`, `min`, `max`, `trimmedMean`) are estimated from the reservoir.
 */
export class DurationSampler {
  private readonly capacity: number;
  private readonly random: () => number;
  private readonly reservoir: number[] = [];
  /** Number of finite samples offered, including those the reservoir discarded. */
  private seen = 0;
  private total = 0;
  private lowest = Number.POSITIVE_INFINITY;
  private highest = Number.NEGATIVE_INFINITY;

  constructor(seed = 0x9e3779b9, capacity: number = DURATION_SAMPLE_CAP) {
    this.capacity = capacity > 0 ? capacity : 1;
    this.random = mulberry32(seed);
  }

  /** Offer one sample. Non-finite values are ignored. */
  add(sample: number): void {
    if (!Number.isFinite(sample)) return;
    this.total += sample;
    if (sample < this.lowest) this.lowest = sample;
    if (sample > this.highest) this.highest = sample;
    if (this.reservoir.length < this.capacity) {
      this.reservoir.push(sample);
    } else {
      const j = Math.floor(this.random() * (this.seen + 1));
      if (j < this.capacity) this.reservoir[j] = sample;
    }
    this.seen += 1;
  }

  /** True number of finite samples offered. */
  get size(): number {
    return this.seen;
  }

  /**
   * Summarize what was collected. `sum`, `mean`, `min` and `max` are EXACT even past the
   * cap (they are accumulated, not read off the reservoir); the remaining three are
   * computed from the retained sample.
   */
  stats(): DurationStats {
    if (this.seen === 0) return emptyDurationStats();
    const fromReservoir = durationStats(this.reservoir);
    return {
      ...fromReservoir,
      min: this.lowest,
      max: this.highest,
      sum: this.total,
      mean: this.total / this.seen,
    };
  }
}
