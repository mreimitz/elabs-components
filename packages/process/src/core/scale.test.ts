import { describe, expect, it } from "vitest";

import { clampWidth, minMax, quantile, quantileSorted } from "./scale";

describe("minMax", () => {
  it("returns the extent of the finite values", () => {
    expect(minMax([3, 1, 4, 1, 5])).toEqual([1, 5]);
  });

  it("ignores non-finite entries rather than propagating them", () => {
    expect(minMax([Number.NaN, 2, Number.POSITIVE_INFINITY, 8])).toEqual([2, 8]);
  });

  it("answers [0, 0] when there is nothing finite to measure", () => {
    expect(minMax([])).toEqual([0, 0]);
    expect(minMax([Number.NaN])).toEqual([0, 0]);
  });

  it("handles a single value and negative values", () => {
    expect(minMax([7])).toEqual([7, 7]);
    expect(minMax([-5, -1, -9])).toEqual([-9, -1]);
  });
});

describe("quantile", () => {
  it("interpolates linearly between order statistics (R-7)", () => {
    // pos = 0.9 * (5 - 1) = 3.6 → 40 + 0.6 * (50 - 40) = 46
    expect(quantile([10, 20, 30, 40, 50], 0.9)).toBe(46);
  });

  it("returns the median at q = 0.5 for odd and even lengths", () => {
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("sorts a copy, leaving the caller's array untouched", () => {
    const values = [5, 1, 3];
    expect(quantile(values, 0)).toBe(1);
    expect(values).toEqual([5, 1, 3]);
  });

  it("clamps q to [0, 1] and answers 0 for an empty input", () => {
    expect(quantile([1, 2, 3], -1)).toBe(1);
    expect(quantile([1, 2, 3], 4)).toBe(3);
    expect(quantile([], 0.5)).toBe(0);
  });

  it("quantileSorted trusts the caller's ordering", () => {
    expect(quantileSorted([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantileSorted([42], 0.9)).toBe(42);
  });
});

describe("clampWidth", () => {
  it("maps the domain onto the range linearly", () => {
    expect(clampWidth(0, [0, 10], [1, 5])).toBe(1);
    expect(clampWidth(5, [0, 10], [1, 5])).toBe(3);
    expect(clampWidth(10, [0, 10], [1, 5])).toBe(5);
  });

  it("clamps values outside the domain to the range endpoints", () => {
    expect(clampWidth(-100, [0, 10], [1, 5])).toBe(1);
    expect(clampWidth(100, [0, 10], [1, 5])).toBe(5);
  });

  it("answers the range floor for a degenerate domain", () => {
    // Every edge in a graph carrying the same count: the domain has zero width, so
    // there is no information to map and the floor is the documented answer.
    expect(clampWidth(7, [7, 7], [1, 5])).toBe(1);
  });

  it("honours a descending domain by inverting the mapping", () => {
    expect(clampWidth(0, [10, 0], [1, 5])).toBe(5);
    expect(clampWidth(10, [10, 0], [1, 5])).toBe(1);
  });

  it("answers the range floor for a non-finite value", () => {
    expect(clampWidth(Number.NaN, [0, 10], [2, 6])).toBe(2);
  });
});
