/**
 * Golden tests for analytics/regression.ts (RM-137): Anscombe's quartet I
 * (published OLS values), exact-coefficient recovery for every model from
 * noiseless fixtures, the confidence band against the closed form, guards.
 */
import { describe, expect, it } from "vitest";

import { fitModel, trendDirection } from "./regression";
import { tQuantile } from "./stats";

// Anscombe (1973), data set I.
const ANSCOMBE_I = [
  [10, 8.04],
  [8, 6.95],
  [13, 7.58],
  [9, 8.81],
  [11, 8.33],
  [14, 9.96],
  [6, 7.24],
  [4, 4.26],
  [12, 10.84],
  [7, 4.82],
  [5, 5.68],
].map(([x, y]) => ({ x: x as number, y: y as number }));

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

describe("fitModel — linear (Anscombe I)", () => {
  const fit = fitModel(ANSCOMBE_I, "linear", { ci: 0.95 })!;

  it("matches the published slope, intercept and r²", () => {
    expect(fit).not.toBeNull();
    const [intercept, slope] = fit.coefficients as [number, number];
    expect(slope).toBeCloseTo(0.5001, 4);
    expect(intercept).toBeCloseTo(3.0001, 4);
    expect(fit.rSquared!).toBeCloseTo(0.6665, 4);
    expect(fit.domain).toEqual([4, 14]);
    expect(fit.n).toBe(11);
    expect(fit.predict(10)).toBeCloseTo(intercept + slope * 10, 12);
  });

  it("the CI band is the textbook mean-response band", () => {
    const n = ANSCOMBE_I.length;
    const mx = ANSCOMBE_I.reduce((a, p) => a + p.x, 0) / n;
    const sxx = ANSCOMBE_I.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    const sse = ANSCOMBE_I.reduce((a, p) => a + (p.y - fit.predict(p.x)) ** 2, 0);
    const s = Math.sqrt(sse / (n - 2));
    expect(s).toBeCloseTo(1.2366, 4); // published residual standard error
    const t = tQuantile(0.975, n - 2);
    for (const x of [4, 9, 14, 20]) {
      const half = t * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
      const band = fit.band!(x);
      expect(band.upper - fit.predict(x)).toBeCloseTo(half, 9);
      expect(fit.predict(x) - band.lower).toBeCloseTo(half, 9);
    }
  });

  it("stays exact for epoch-ms x (conditioning)", () => {
    const x0 = 1.7e12;
    const day = 86_400_000;
    const pts = range(0, 30).map((i) => ({ x: x0 + i * day, y: 5 + 0.25 * i }));
    const f = fitModel(pts, "linear")!;
    expect(f.predict(x0)).toBeCloseTo(5, 8);
    expect(f.predict(x0 + 30 * day)).toBeCloseTo(12.5, 8);
    expect(f.rSquared!).toBeCloseTo(1, 10);
    expect(f.coefficients[1]!).toBeCloseTo(0.25 / day, 18);
  });
});

describe("fitModel — coefficient recovery from exact fixtures", () => {
  it("exp: y = 2·e^(0.3x)", () => {
    const f = fitModel(
      range(0, 10, 0.5).map((x) => ({ x, y: 2 * Math.exp(0.3 * x) })),
      "exp",
    )!;
    expect(f.coefficients[0]!).toBeCloseTo(2, 6);
    expect(f.coefficients[1]!).toBeCloseTo(0.3, 6);
    expect(f.rSquared!).toBeCloseTo(1, 9);
    expect(f.predict(4)).toBeCloseTo(2 * Math.exp(1.2), 6);
  });

  it("pow: y = 3·x^1.5", () => {
    const f = fitModel(
      range(1, 10).map((x) => ({ x, y: 3 * x ** 1.5 })),
      "pow",
    )!;
    expect(f.coefficients[0]!).toBeCloseTo(3, 6);
    expect(f.coefficients[1]!).toBeCloseTo(1.5, 6);
    expect(f.rSquared!).toBeCloseTo(1, 9);
  });

  it("log: y = 4 + 2.5·ln x", () => {
    const f = fitModel(
      range(1, 20).map((x) => ({ x, y: 4 + 2.5 * Math.log(x) })),
      "log",
    )!;
    expect(f.coefficients[0]!).toBeCloseTo(4, 6);
    expect(f.coefficients[1]!).toBeCloseTo(2.5, 6);
  });

  it("poly 2: y = 1 + 2x − 0.5x²", () => {
    const f = fitModel(
      range(-5, 10).map((x) => ({ x, y: 1 + 2 * x - 0.5 * x * x })),
      {
        poly: 2,
      },
    )!;
    const [c0, c1, c2] = f.coefficients as [number, number, number];
    expect(c0).toBeCloseTo(1, 6);
    expect(c1).toBeCloseTo(2, 6);
    expect(c2).toBeCloseTo(-0.5, 6);
  });

  it("poly 3: y = 1 + 2x − 0.5x² + 0.1x³", () => {
    const g = (x: number) => 1 + 2 * x - 0.5 * x ** 2 + 0.1 * x ** 3;
    const f = fitModel(
      range(0, 10, 0.5).map((x) => ({ x, y: g(x) })),
      { poly: 3 },
    )!;
    const expected = [1, 2, -0.5, 0.1];
    f.coefficients.forEach((c, i) => expect(c).toBeCloseTo(expected[i]!, 6));
    expect(f.predict(7.25)).toBeCloseTo(g(7.25), 6);
    expect(f.rSquared!).toBeCloseTo(1, 9);
  });

  it("loess reproduces a straight line and offers no r² or band", () => {
    const f = fitModel(
      range(0, 20).map((x) => ({ x, y: 3 + 2 * x })),
      { loess: 0.5 },
      {
        ci: 0.95,
      },
    )!;
    expect(f.predict(7)).toBeCloseTo(17, 6);
    expect(f.predict(7.5)).toBeCloseTo(18, 6);
    expect(f.rSquared).toBeUndefined();
    expect(f.band).toBeUndefined();
    expect(f.coefficients).toEqual([]);
  });
});

describe("fitModel — bands for the transformed models", () => {
  // A deterministic wobble instead of noise (no Math.random).
  const wobble = (i: number) => 1 + 0.05 * Math.sin(i * 1.7);
  it("exp / pow bands bracket the curve (log-space, asymmetric)", () => {
    for (const model of ["exp", "pow"] as const) {
      const pts = range(1, 20).map((x, i) => ({
        x,
        y: (model === "exp" ? 2 * Math.exp(0.2 * x) : 3 * x ** 1.2) * wobble(i),
      }));
      const f = fitModel(pts, model, { ci: 0.95 })!;
      const b = f.band!(10);
      expect(b.lower).toBeLessThan(f.predict(10));
      expect(b.upper).toBeGreaterThan(f.predict(10));
      expect(b.upper - f.predict(10)).toBeGreaterThan(f.predict(10) - b.lower);
    }
  });

  it("poly band widens away from the data's centre", () => {
    const pts = range(0, 20).map((x, i) => ({ x, y: 1 + x - 0.1 * x * x + wobble(i) }));
    const f = fitModel(pts, { poly: 2 }, { ci: 0.95 })!;
    const w = (x: number) => f.band!(x).upper - f.band!(x).lower;
    expect(w(10)).toBeLessThan(w(0));
    expect(w(0)).toBeLessThan(w(-5));
  });
});

describe("fitModel — guards", () => {
  it("fewer than two usable points → null", () => {
    expect(fitModel([], "linear")).toBeNull();
    expect(fitModel([{ x: 1, y: 1 }], "linear")).toBeNull();
    expect(
      fitModel(
        [
          { x: 1, y: Number.NaN },
          { x: 2, y: 3 },
        ],
        "linear",
      ),
    ).toBeNull();
  });

  it("all-identical x → null", () => {
    expect(
      fitModel(
        [
          { x: 5, y: 1 },
          { x: 5, y: 2 },
        ],
        "linear",
      ),
    ).toBeNull();
  });

  it("log/pow drop x ≤ 0; exp/pow drop y ≤ 0", () => {
    const log = fitModel(
      [{ x: -1, y: 99 }, { x: 0, y: 99 }, ...range(1, 5).map((x) => ({ x, y: 1 + Math.log(x) }))],
      "log",
    )!;
    expect(log.n).toBe(5);
    expect(log.coefficients[1]!).toBeCloseTo(1, 9);
    const exp = fitModel(
      [{ x: 0, y: -3 }, { x: 1, y: 0 }, ...range(2, 6).map((x) => ({ x, y: Math.exp(x) }))],
      "exp",
    )!;
    expect(exp.n).toBe(5);
    expect(exp.coefficients[1]!).toBeCloseTo(1, 6);
    expect(
      fitModel(
        [
          { x: -1, y: 1 },
          { x: 0, y: 2 },
        ],
        "pow",
      ),
    ).toBeNull();
  });

  it("poly degree must be below the number of usable rows", () => {
    const pts = range(0, 3).map((x) => ({ x, y: x * x }));
    expect(fitModel(pts, { poly: 4 })).toBeNull();
    expect(fitModel(pts.slice(0, 3), { poly: 3 })).toBeNull();
    expect(fitModel(pts, { poly: 3 })).not.toBeNull();
  });

  it("constant y is a perfect flat fit (r² = 1, not NaN)", () => {
    const f = fitModel(
      range(0, 4).map((x) => ({ x, y: 7 })),
      "linear",
    )!;
    expect(f.rSquared).toBe(1);
    expect(trendDirection(f)).toBe("flat");
  });

  it("no band without residual degrees of freedom", () => {
    const f = fitModel(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      "linear",
      { ci: 0.95 },
    )!;
    expect(f.band).toBeUndefined();
  });
});

describe("trendDirection", () => {
  it("reads a slope or a fit's change across its domain", () => {
    expect(trendDirection({ slope: 2 })).toBe("increasing");
    expect(trendDirection({ slope: -0.1 })).toBe("decreasing");
    expect(trendDirection({ slope: 0 })).toBe("flat");
    expect(trendDirection(fitModel(ANSCOMBE_I, "linear")!)).toBe("increasing");
    const decay = fitModel(
      range(0, 5).map((x) => ({ x, y: 5 * Math.exp(-0.4 * x) })),
      "exp",
    )!;
    expect(trendDirection(decay)).toBe("decreasing");
  });
});

// Shared CI runners stall under load, so wall-clock budgets get slack there;
// local budgets stay exact.
const TIMING_SLACK = process.env.CI ? 4 : 1;

describe("performance", () => {
  it("poly 6 on 10k points fits in under 50 ms", () => {
    const pts = range(0, 9_999).map((i) => {
      const x = i / 1000;
      return { x, y: Math.sin(x) + 0.001 * ((i * 7919) % 97) };
    });
    let f = fitModel(pts, { poly: 6 }); // warm the JIT
    let best = Number.POSITIVE_INFINITY;
    for (let r = 0; r < 3; r += 1) {
      const t0 = performance.now();
      f = fitModel(pts, { poly: 6 });
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(50 * TIMING_SLACK);
    expect(f!.rSquared!).toBeGreaterThan(0.99);
  });
});
