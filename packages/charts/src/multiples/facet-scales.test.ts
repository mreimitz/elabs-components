import { describe, expect, it } from "vitest";

import {
  computeFacetScales,
  facetValueExtent,
  niceStepAtLeast,
  rangeRoundedFacetScale,
  sharedFacetScale,
} from "./facet-scales";

describe("niceStepAtLeast", () => {
  it("climbs the 1 / 2 / 2.5 / 5 ladder", () => {
    expect(niceStepAtLeast(0.9)).toBe(1);
    expect(niceStepAtLeast(1.2)).toBe(2);
    expect(niceStepAtLeast(2.2)).toBe(2.5);
    expect(niceStepAtLeast(3)).toBe(5);
    expect(niceStepAtLeast(7)).toBe(10);
    expect(niceStepAtLeast(0.03)).toBe(0.05);
  });
});

describe("facetValueExtent", () => {
  it("spans every finite value under the keys", () => {
    const rows = [{ a: 3, b: -1 }, { a: 9, b: Number.NaN }, { a: null }];
    expect(facetValueExtent(rows, ["a", "b"])).toEqual([-1, 9]);
    expect(facetValueExtent([{ a: "x" }], ["a"])).toBeNull();
  });
});

describe("sharedFacetScale", () => {
  it("is zero-based for positive data with nice ends and one tick set", () => {
    const scale = sharedFacetScale([
      [2, 7],
      [1, 38],
    ]);
    expect(scale.domain).toEqual([0, 40]);
    expect(scale.ticks).toEqual([0, 10, 20, 30, 40]);
  });

  it("keeps a pinned end (RM-108 AxisDomain)", () => {
    const scale = sharedFacetScale([[2, 7]], { yDomain: [1, "auto"] });
    expect(scale.domain?.[0]).toBe(1);
    expect(scale.domain?.[1]).toBe(8);
  });
});

describe("range rounding", () => {
  it("cuts every panel into the same number of nice steps", () => {
    const scales = computeFacetScales(
      [
        [2.1, 7.8],
        [110, 385],
        [0.4, 0.93],
      ],
      { y: "independent", rangeRounding: true },
    );
    expect(scales.map((s) => s.ticks?.length)).toEqual([5, 5, 5]);
    expect(scales[0]).toEqual({ domain: [0, 8], ticks: [0, 2, 4, 6, 8] });
    expect(scales[1]).toEqual({ domain: [0, 400], ticks: [0, 100, 200, 300, 400] });
    expect(scales[2]).toEqual({ domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] });
  });

  it("aligns a negative range from a step-aligned low end", () => {
    const scale = rangeRoundedFacetScale([-3, 9]);
    expect(scale.ticks).toEqual([-5, 0, 5, 10, 15]);
  });

  it("leaves unrounded independent panels to their own chart", () => {
    expect(computeFacetScales([[1, 2]], { y: "independent" })).toEqual([{}]);
  });
});
