/** Golden tests for analytics/window.ts (RM-137) — the notebook plotting library window semantics. */
import { describe, expect, it } from "vitest";

import { windowReduce } from "./window";

const ONE_TO_FIVE = [1, 2, 3, 4, 5];

describe("windowReduce", () => {
  it("k=3 mean anchored end: partial windows (non-strict) and nulls (strict)", () => {
    expect(windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean", anchor: "end" })).toEqual([
      1, 1.5, 2, 3, 4,
    ]);
    expect(
      windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean", anchor: "end", strict: true }),
    ).toEqual([null, null, 2, 3, 4]);
  });

  it("defaults to anchor end, non-strict", () => {
    expect(windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean" })).toEqual([1, 1.5, 2, 3, 4]);
  });

  it("k=3 mean anchored middle / start", () => {
    expect(
      windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean", anchor: "middle", strict: true }),
    ).toEqual([null, 2, 3, 4, null]);
    expect(windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean", anchor: "middle" })).toEqual([
      1.5, 2, 3, 4, 4.5,
    ]);
    expect(
      windowReduce(ONE_TO_FIVE, { k: 3, reduce: "mean", anchor: "start", strict: true }),
    ).toEqual([2, 3, 4, null, null]);
  });

  it("even k in the middle puts the extra row after i (Plot)", () => {
    // Window of i = 1 is rows [0, 3).
    expect(
      windowReduce(ONE_TO_FIVE, { k: 4, reduce: "sum", anchor: "middle", strict: true }),
    ).toEqual([null, 10, 14, null, null]);
  });

  it("sum / min / max / median", () => {
    expect(windowReduce(ONE_TO_FIVE, { k: 2, reduce: "sum", strict: true })).toEqual([
      null,
      3,
      5,
      7,
      9,
    ]);
    const v = [5, 1, 4, 2, 8, 3];
    expect(windowReduce(v, { k: 3, reduce: "min", strict: true })).toEqual([
      null,
      null,
      1,
      1,
      2,
      2,
    ]);
    expect(windowReduce(v, { k: 3, reduce: "max", strict: true })).toEqual([
      null,
      null,
      5,
      4,
      8,
      8,
    ]);
    expect(windowReduce(v, { k: 3, reduce: "median", strict: true })).toEqual([
      null,
      null,
      4,
      2,
      4,
      3,
    ]);
    expect(windowReduce(v, { k: 2, reduce: "median" })).toEqual([5, 3, 2.5, 3, 5, 5.5]);
  });

  it("missing values: skipped when non-strict, poison the window when strict", () => {
    const v = [1, null, 3, Number.NaN, 5, undefined];
    expect(windowReduce(v, { k: 2, reduce: "mean" })).toEqual([1, 1, 3, 3, 5, 5]);
    expect(windowReduce(v, { k: 2, reduce: "mean", strict: true })).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(windowReduce([null, null], { k: 2, reduce: "max" })).toEqual([null, null]);
  });

  it("ewm is the span-k recursive mean (alpha = 2 / (k + 1))", () => {
    const out = windowReduce([10, 20, 30, 40], { k: 3, reduce: "ewm" });
    // alpha = 0.5 → 10, 15, 22.5, 31.25 (pandas ewm(span=3, adjust=False)).
    expect(out).toEqual([10, 15, 22.5, 31.25]);
    expect(windowReduce([10, 20, 30, 40], { k: 3, reduce: "ewm", strict: true })).toEqual([
      null,
      null,
      22.5,
      31.25,
    ]);
    expect(windowReduce([10, null, 30], { k: 3, reduce: "ewm" })).toEqual([10, null, 20]);
  });

  it("aligned length; k < 1 → all null", () => {
    expect(windowReduce([], { k: 3, reduce: "mean" })).toEqual([]);
    expect(windowReduce([1, 2], { k: 0, reduce: "mean" })).toEqual([null, null]);
    expect(windowReduce([1, 2], { k: 5, reduce: "mean", strict: true })).toEqual([null, null]);
  });
});
