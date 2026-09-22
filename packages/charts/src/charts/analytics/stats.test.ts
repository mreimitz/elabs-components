/**
 * Golden tests for analytics/stats.ts (RM-137): every statistic against
 * d3-array on the same input, plus published t / normal quantiles.
 */
import * as d3 from "d3-array";
import { describe, expect, it } from "vitest";

import {
  confidenceInterval,
  max,
  mean,
  median,
  min,
  normalQuantile,
  quantile,
  resolveAnalyticValue,
  spreadBand,
  stddev,
  sum,
  tQuantile,
} from "./stats";

// A deterministic, irregular fixture (no Math.random — charts-honesty).
const VALUES = [12, 7, 3.5, 21, 8, 8, 15, 2, 30, 11.25, 9, 4, 17, 6, 13];
const ROWS = [
  ...VALUES.map((v, i) => ({ id: i, v })),
  { id: 100, v: null },
  { id: 101, v: Number.NaN },
  { id: 102, v: "9" },
  { id: 103, v: Number.POSITIVE_INFINITY },
  { id: 104 },
];

describe("primitives match d3-array", () => {
  it("mean / median / min / max / sum", () => {
    expect(mean(VALUES)).toBeCloseTo(d3.mean(VALUES) as number, 12);
    expect(median(VALUES)).toBeCloseTo(d3.median(VALUES) as number, 12);
    expect(min(VALUES)).toBe(d3.min(VALUES));
    expect(max(VALUES)).toBe(d3.max(VALUES));
    expect(sum(VALUES)).toBeCloseTo(d3.sum(VALUES), 12);
  });

  it("quantile is R-7 (d3 quantile) at every decile", () => {
    for (let p = 0; p <= 1.0001; p += 0.1) {
      expect(quantile(VALUES, p)).toBeCloseTo(d3.quantile(VALUES, p) as number, 12);
    }
  });

  it("stddev is d3.deviation (sample) and population on request", () => {
    expect(stddev(VALUES)).toBeCloseTo(d3.deviation(VALUES) as number, 12);
    const n = VALUES.length;
    const pop = (d3.deviation(VALUES) as number) * Math.sqrt((n - 1) / n);
    expect(stddev(VALUES, { sample: false })).toBeCloseTo(pop, 12);
  });

  it("skips non-finite values and returns null on nothing", () => {
    expect(mean([1, null, Number.NaN, 3, undefined, "x"])).toBe(2);
    expect(mean([])).toBeNull();
    expect(median([null, Number.NaN])).toBeNull();
    expect(sum([])).toBeNull();
    expect(stddev([5])).toBeNull();
    expect(stddev([5], { sample: false })).toBe(0);
  });

  it("stddev is stable for epoch-ms magnitudes", () => {
    const base = 1.7e12;
    expect(stddev([base + 1, base + 2, base + 3])).toBeCloseTo(1, 9);
  });
});

describe("distribution quantiles", () => {
  it("normalQuantile matches published z values", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963985, 8);
    expect(normalQuantile(0.5)).toBe(0);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326347874, 8);
  });

  it("tQuantile matches the published t table", () => {
    // Two-sided 95 % critical values.
    expect(tQuantile(0.975, 1)).toBeCloseTo(12.7062, 3);
    expect(tQuantile(0.975, 2)).toBeCloseTo(4.3027, 4);
    expect(tQuantile(0.975, 5)).toBeCloseTo(2.5706, 2);
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.2281, 3);
    expect(tQuantile(0.975, 30)).toBeCloseTo(2.0423, 4);
    expect(tQuantile(0.995, 20)).toBeCloseTo(2.8453, 3);
  });

  it("confidenceInterval is the t interval of the mean", () => {
    const ci = confidenceInterval(VALUES, 0.95);
    expect(ci).not.toBeNull();
    const m = d3.mean(VALUES) as number;
    const half = 2.1448 * ((d3.deviation(VALUES) as number) / Math.sqrt(VALUES.length)); // t(0.975, 14)
    expect(ci!.mean).toBeCloseTo(m, 12);
    expect(ci!.halfWidth).toBeCloseTo(half, 2);
    expect(confidenceInterval([1], 0.95)).toBeNull();
    expect(confidenceInterval(VALUES, 1)).toBeNull();
  });
});

describe("resolveAnalyticValue", () => {
  it("resolves every member of the AnalyticValue union", () => {
    expect(resolveAnalyticValue(ROWS, "v", 42)).toBe(42);
    expect(resolveAnalyticValue(ROWS, "v", Number.NaN)).toBeNull();
    expect(resolveAnalyticValue(ROWS, "v", "mean")).toBeCloseTo(d3.mean(VALUES) as number, 12);
    expect(resolveAnalyticValue(ROWS, "v", "median")).toBe(d3.median(VALUES));
    expect(resolveAnalyticValue(ROWS, "v", "min")).toBe(2);
    expect(resolveAnalyticValue(ROWS, "v", "max")).toBe(30);
    expect(resolveAnalyticValue(ROWS, "v", "sum")).toBeCloseTo(d3.sum(VALUES), 12);
    expect(resolveAnalyticValue(ROWS, "v", { percentile: 90 })).toBeCloseTo(
      d3.quantile(VALUES, 0.9) as number,
      12,
    );
    const m = d3.mean(VALUES) as number;
    const s = d3.deviation(VALUES) as number;
    expect(resolveAnalyticValue(ROWS, "v", { stddev: 2 })).toBeCloseTo(m + 2 * s, 12);
    expect(resolveAnalyticValue(ROWS, "v", { stddev: -1, around: "median" })).toBeCloseTo(
      (d3.median(VALUES) as number) - s,
      12,
    );
    expect(resolveAnalyticValue(ROWS, "v", (rows) => rows.length)).toBe(ROWS.length);
    expect(resolveAnalyticValue(ROWS, "v", () => Number.NaN)).toBeNull();
  });

  it("returns null when the key has nothing usable", () => {
    expect(resolveAnalyticValue(ROWS, "missing", "mean")).toBeNull();
    expect(resolveAnalyticValue([], "v", "max")).toBeNull();
    expect(resolveAnalyticValue(ROWS, "missing", { percentile: 50 })).toBeNull();
  });

  it("mean over 100k rows is linear-time (< 5 ms warm)", () => {
    const rows = Array.from({ length: 100_000 }, (_, i) => ({ v: (i * 7919) % 1000 }));
    resolveAnalyticValue(rows, "v", "mean"); // warm the JIT
    let best = Number.POSITIVE_INFINITY;
    for (let r = 0; r < 5; r += 1) {
      const t0 = performance.now();
      resolveAnalyticValue(rows, "v", "mean");
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(5);
  });
});

describe("spreadBand", () => {
  it("percentiles → the two R-7 quantiles", () => {
    expect(spreadBand(ROWS, "v", { percentiles: [75, 25] })).toEqual({
      from: d3.quantile(VALUES, 0.25),
      to: d3.quantile(VALUES, 0.75),
    });
  });

  it("stddev → symmetric around mean (or median)", () => {
    const m = d3.mean(VALUES) as number;
    const s = d3.deviation(VALUES) as number;
    const band = spreadBand(ROWS, "v", { stddev: 1 })!;
    expect(band.from).toBeCloseTo(m - s, 12);
    expect(band.to).toBeCloseTo(m + s, 12);
    const med = spreadBand(ROWS, "v", { stddev: 1, around: "median", sample: false })!;
    const pop = s * Math.sqrt((VALUES.length - 1) / VALUES.length);
    expect(med.from).toBeCloseTo((d3.median(VALUES) as number) - pop, 12);
  });

  it("ci → the t interval of the mean; n < 2 → null", () => {
    const ci = confidenceInterval(VALUES, 0.9)!;
    expect(spreadBand(ROWS, "v", { ci: 0.9 })).toEqual({ from: ci.lower, to: ci.upper });
    expect(spreadBand([{ v: 3 }], "v", { ci: 0.95 })).toBeNull();
    expect(spreadBand([], "v", { percentiles: [25, 75] })).toBeNull();
  });
});
