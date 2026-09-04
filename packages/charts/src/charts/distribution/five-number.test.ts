/**
 * The acceptance criterion for `five-number.ts` is "matches `d3-array` quantile
 * results" (RM-026). This suite is what makes that a CHECKED claim rather than a
 * comment: `quantileSorted` is an independent R-7 implementation, and the first
 * test drives it against `d3.quantile` over seeded random samples of many
 * shapes. If the two ever disagree — a future refactor reaching for nearest-rank,
 * say — the box edges move and this goes red.
 */
import { quantile as d3quantile } from "d3-array";
import { describe, expect, it } from "vitest";
import { seededRnd } from "../../marks/seeded-rnd";
import {
  DEFAULT_WHISKER_MULTIPLIER,
  fiveNumberSummary,
  quantileSorted,
  sortedFinite,
} from "./five-number";

/** A deterministic sample of `n` values; `k` picks an independent draw. */
function sample(n: number, k: number): number[] {
  return Array.from({ length: n }, (_v, i) => seededRnd(i, k) * 100);
}

describe("quantileSorted", () => {
  it("agrees with d3-array's quantile on every p, for samples of many sizes", () => {
    const probabilities = [0, 0.05, 0.25, 1 / 3, 0.5, 0.75, 0.9, 1];
    for (const n of [1, 2, 3, 4, 5, 7, 10, 33, 100, 257]) {
      for (let k = 1; k <= 3; k += 1) {
        const sorted = sortedFinite(sample(n, k));
        for (const p of probabilities) {
          expect(quantileSorted(sorted, p)).toBeCloseTo(d3quantile(sorted, p) as number, 12);
        }
      }
    }
  });

  it("agrees with d3 on the textbook example", () => {
    const sorted = [1, 2, 3, 4];
    expect(quantileSorted(sorted, 0.25)).toBeCloseTo(1.75, 12);
    expect(quantileSorted(sorted, 0.25)).toBeCloseTo(d3quantile(sorted, 0.25) as number, 12);
  });

  it("returns NaN for an empty array and clamps p outside [0, 1]", () => {
    expect(Number.isNaN(quantileSorted([], 0.5))).toBe(true);
    expect(quantileSorted([10, 20], -1)).toBe(10);
    expect(quantileSorted([10, 20], 2)).toBe(20);
  });
});

describe("sortedFinite", () => {
  it("drops non-finite entries rather than coercing them to zero", () => {
    expect(sortedFinite([3, Number.NaN, 1, Number.POSITIVE_INFINITY, 2])).toEqual([1, 2, 3]);
  });
});

describe("fiveNumberSummary", () => {
  it("reports the five numbers, the IQR and Tukey's fences", () => {
    const summary = fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(summary).toBeDefined();
    expect(summary?.n).toBe(9);
    expect(summary?.min).toBe(1);
    expect(summary?.max).toBe(9);
    expect(summary?.median).toBe(5);
    expect(summary?.q1).toBe(3);
    expect(summary?.q3).toBe(7);
    expect(summary?.iqr).toBe(4);
    expect(summary?.lowerFence).toBe(3 - DEFAULT_WHISKER_MULTIPLIER * 4);
    expect(summary?.upperFence).toBe(7 + DEFAULT_WHISKER_MULTIPLIER * 4);
  });

  it("splits outliers out and stops the whiskers at the last value inside the fences", () => {
    // 1…9 plus one far value: the fences sit at −3 and 13, so 40 is the only
    // outlier and the upper whisker must stop at 9, not reach 40.
    const summary = fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 40]);
    expect(summary?.outliers).toEqual([40]);
    expect(summary?.upperWhisker).toBe(9);
    expect(summary?.lowerWhisker).toBe(1);
    expect(summary?.max).toBe(40);
  });

  it("honours a custom whisker multiplier", () => {
    const tight = fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 40], 0.5);
    expect(tight?.outliers).toContain(40);
    expect(tight?.upperFence).toBeLessThan(13);
  });

  it("returns undefined for a group with nothing finite in it", () => {
    expect(fiveNumberSummary([])).toBeUndefined();
    expect(fiveNumberSummary([Number.NaN, Number.POSITIVE_INFINITY])).toBeUndefined();
  });

  it("collapses the whiskers onto the quartiles when every value is an outlier", () => {
    // Two distinct values: IQR is non-zero here, so use the degenerate case that
    // really produces it — a constant sample with one different value gives
    // IQR 0, and then anything off the constant is outside the fences.
    const summary = fiveNumberSummary([5, 5, 5, 5, 9]);
    expect(summary?.iqr).toBe(0);
    expect(summary?.outliers).toEqual([9]);
    expect(summary?.lowerWhisker).toBe(5);
    expect(summary?.upperWhisker).toBe(5);
  });
});
