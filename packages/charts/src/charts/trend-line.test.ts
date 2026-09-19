import { describe, expect, it } from "vitest";
import { fitTrend, trendDirection } from "./trend-line";

describe("fitTrend", () => {
  it("recovers an exact linear fit (slope, intercept, r2 = 1)", () => {
    // y = 2x + 1, no noise.
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const fit = fitTrend(points, "linear");
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(2, 10);
    expect(fit!.intercept).toBeCloseTo(1, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
    // The endpoints of the drawn line match the closed-form fit exactly.
    expect(fit!.predict(0)).toBeCloseTo(1, 10);
    expect(fit!.predict(4)).toBeCloseTo(9, 10);
  });

  it("recovers an exact logarithmic fit (y = a + b·ln(x))", () => {
    const a = 3;
    const b = 5;
    const points = [1, 2, 5, 10, 50].map((x) => ({ x, y: a + b * Math.log(x) }));
    const fit = fitTrend(points, "log");
    expect(fit).not.toBeNull();
    expect(fit!.kind).toBe("log");
    expect(fit!.slope).toBeCloseTo(b, 8);
    expect(fit!.intercept).toBeCloseTo(a, 8);
    expect(fit!.r2).toBeCloseTo(1, 8);
  });

  it("drops non-positive x for a log fit", () => {
    const points = [
      { x: -1, y: 999 },
      { x: 0, y: 999 },
      { x: 1, y: 3 },
      { x: 2, y: 3 + 5 * Math.log(2) },
      { x: 4, y: 3 + 5 * Math.log(4) },
    ];
    const fit = fitTrend(points, "log");
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(5, 6);
  });

  it("returns null for fewer than 2 usable points", () => {
    expect(fitTrend([], "linear")).toBeNull();
    expect(fitTrend([{ x: 1, y: 1 }], "linear")).toBeNull();
    expect(fitTrend([{ x: -1, y: 1 }], "log")).toBeNull();
  });

  it("returns null when every x is identical (no slope to fit)", () => {
    expect(
      fitTrend(
        [
          { x: 5, y: 1 },
          { x: 5, y: 2 },
        ],
        "linear",
      ),
    ).toBeNull();
  });
});

describe("trendDirection", () => {
  it("names the slope sign", () => {
    expect(trendDirection({ slope: 2 })).toBe("increasing");
    expect(trendDirection({ slope: -2 })).toBe("decreasing");
    expect(trendDirection({ slope: 0 })).toBe("flat");
  });
});
