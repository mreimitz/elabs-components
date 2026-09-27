import { describe, expect, it } from "vitest";
import { mean, median, stddev } from "../analytics/stats";
import { resolveStatLines, statName } from "./stat-lines";
import type { DensityPoints } from "./types";

function pts(x: number[], y: number[]): DensityPoints {
  return {
    x: Float32Array.from(x),
    y: Float32Array.from(y),
    n: x.length,
    values: {},
    categories: {},
  };
}

// Class 0: y = 1, 2, 3, 10 at x 0..3; class 1: y = 5, 7 at x 10, 20.
const P = pts([0, 1, 2, 3, 10, 20], [1, 2, 3, 10, 5, 7]);
const CLS = Uint8Array.from([0, 0, 0, 0, 1, 1]);
const Y0 = [1, 2, 3, 10];
const Y1 = [5, 7];
const ALL = [...Y0, ...Y1];

describe("resolveStatLines", () => {
  it("computes mean / median per class and overall, agreeing with analytics/stats", () => {
    const lines = resolveStatLines({
      points: P,
      cls: CLS,
      classCount: 2,
      lines: [{ value: "mean" }, { value: "median" }, { value: "mean", by: "all" }],
    });
    const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(byKey["0-0"]!.value).toBeCloseTo(mean(Y0)!);
    expect(byKey["0-1"]!.value).toBeCloseTo(mean(Y1)!);
    expect(byKey["1-0"]!.value).toBeCloseTo(median(Y0)!);
    expect(byKey["1-1"]!.value).toBeCloseTo(median(Y1)!);
    expect(byKey["2-2"]!.value).toBeCloseTo(mean(ALL)!);
    expect(byKey["2-2"]!.cls).toBe(-1);
    expect(byKey["2-2"]!.extent).toBeNull();
    // A per-class line runs across its own points on the other axis.
    expect(byKey["0-0"]!.extent).toEqual([0, 3]);
    expect(byKey["0-1"]!.extent).toEqual([10, 20]);
  });

  it("draws mean ± kσ (sample σ) as a pair", () => {
    const lines = resolveStatLines({
      points: P,
      cls: CLS,
      classCount: 2,
      lines: [{ value: { stddev: 2 } }],
    });
    const sd = stddev(Y0)!;
    const hi = lines.find((l) => l.key === "0-0-hi")!;
    const lo = lines.find((l) => l.key === "0-0-lo")!;
    expect(hi.value).toBeCloseTo(mean(Y0)! + 2 * sd, 4);
    expect(lo.value).toBeCloseTo(mean(Y0)! - 2 * sd, 4);
    expect(statName(hi, { average: "Average", median: "Median" })).toBe("+2σ");
    expect(statName(lo, { average: "Average", median: "Median" })).toBe("−2σ");
  });

  it("takes the x statistic for axis x and skips hidden and empty classes", () => {
    const lines = resolveStatLines({
      points: P,
      cls: CLS,
      classCount: 3,
      hidden: [true, false, false],
      lines: [
        { axis: "x", value: "mean" },
        { value: "mean", by: "all" },
      ],
    });
    expect(lines.map((l) => l.key)).toEqual(["0-1", "1-3"]);
    expect(lines[0]!.value).toBeCloseTo(15);
    // "all" leaves the hidden class out.
    expect(lines[1]!.value).toBeCloseTo(mean(Y1)!);
  });

  it("gives each statistic its own default dash", () => {
    const lines = resolveStatLines({
      points: P,
      cls: CLS,
      classCount: 2,
      lines: [
        { value: "mean", by: "all" },
        { value: "median", by: "all" },
        { value: "mean", by: "all", style: "solid" },
      ],
    });
    expect(lines.map((l) => l.style)).toEqual(["dashed", "dotted", "solid"]);
  });
});
