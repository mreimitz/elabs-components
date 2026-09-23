/**
 * Golden tests for analytics/forecast.ts (RM-137): the classic Box & Jenkins
 * airline passengers series (monthly totals in thousands, 1949–1960 — R's
 * `AirPassengers`), 12-month season, last year held out.
 */
import { describe, expect, it } from "vitest";

import { forecastHoltWinters } from "./forecast";

// prettier-ignore
const AIR_PASSENGERS = [
  112, 118, 132, 129, 121, 135, 148, 148, 136, 119, 104, 118, // 1949
  115, 126, 141, 135, 125, 149, 170, 170, 158, 133, 114, 140, // 1950
  145, 150, 178, 163, 172, 178, 199, 199, 184, 162, 146, 166, // 1951
  171, 180, 193, 181, 183, 218, 230, 242, 209, 191, 172, 194, // 1952
  196, 196, 236, 235, 229, 243, 264, 272, 237, 211, 180, 201, // 1953
  204, 188, 235, 227, 234, 264, 302, 293, 259, 229, 203, 229, // 1954
  242, 233, 267, 269, 270, 315, 364, 347, 312, 274, 237, 278, // 1955
  284, 277, 317, 313, 318, 374, 413, 405, 355, 306, 271, 306, // 1956
  315, 301, 356, 348, 355, 422, 465, 467, 404, 347, 305, 336, // 1957
  340, 318, 362, 348, 363, 435, 491, 505, 404, 359, 310, 337, // 1958
  360, 342, 406, 396, 420, 472, 548, 559, 463, 407, 362, 405, // 1959
  417, 391, 419, 461, 472, 535, 622, 606, 508, 461, 390, 432, // 1960
];

function mape(actual: readonly number[], forecast: readonly number[]): number {
  let acc = 0;
  for (let i = 0; i < actual.length; i += 1) {
    acc += Math.abs(((actual[i] as number) - (forecast[i] as number)) / (actual[i] as number));
  }
  return acc / actual.length;
}

describe("forecastHoltWinters — airline passengers", () => {
  const train = AIR_PASSENGERS.slice(0, 132);
  const test = AIR_PASSENGERS.slice(132);
  const fc = forecastHoltWinters(train, { horizon: 12, season: 12 })!;

  it("has 144 values", () => {
    expect(AIR_PASSENGERS).toHaveLength(144);
  });

  it("forecasts the held-out year with MAPE < 5 %", () => {
    expect(fc).not.toBeNull();
    expect(fc.points).toHaveLength(12);
    const error = mape(test, fc.points);
    // Recorded in the RM-137 report; the gate is the roadmap's 5 %.
    expect(error).toBeLessThan(0.05);
  });

  it("fits parameters on the 0.05 grid", () => {
    for (const p of [fc.params.alpha, fc.params.beta, fc.params.gamma]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(Math.abs(p * 20 - Math.round(p * 20))).toBeLessThan(1e-9);
    }
  });

  it("the prediction interval brackets the forecast and widens with h", () => {
    for (let h = 0; h < 12; h += 1) {
      expect(fc.lower[h]!).toBeLessThan(fc.points[h]!);
      expect(fc.upper[h]!).toBeGreaterThan(fc.points[h]!);
    }
    const width = (h: number) => fc.upper[h]! - fc.lower[h]!;
    expect(width(11)).toBeGreaterThan(width(0));
    // h = 1 half-width is z·σ exactly.
    expect(width(0) / 2).toBeCloseTo(1.959963985 * fc.sigma, 6);
    const a = fc.params.alpha;
    expect(width(11) / width(0)).toBeCloseTo(Math.sqrt(1 + 11 * a * a), 9);
  });
});

describe("forecastHoltWinters — shapes and guards", () => {
  it("a noiseless line is extrapolated exactly (non-seasonal)", () => {
    const line = Array.from({ length: 20 }, (_, i) => 10 + 3 * i);
    const fc = forecastHoltWinters(line, { horizon: 3 })!;
    expect(fc.points[0]!).toBeCloseTo(70, 9);
    expect(fc.points[2]!).toBeCloseTo(76, 9);
    expect(fc.sigma).toBeCloseTo(0, 9);
  });

  it("a noiseless seasonal pattern on a trend is reproduced", () => {
    const pattern = [5, -2, 0, -3];
    const y = Array.from({ length: 24 }, (_, i) => 100 + 2 * i + pattern[i % 4]!);
    const fc = forecastHoltWinters(y, {
      horizon: 8,
      season: 4,
      alpha: 0.3,
      beta: 0.1,
      gamma: 0.1,
    })!;
    for (let h = 1; h <= 8; h += 1) {
      const t = 23 + h;
      expect(fc.points[h - 1]!).toBeCloseTo(100 + 2 * t + pattern[t % 4]!, 6);
    }
    expect(fc.params).toEqual({ alpha: 0.3, beta: 0.1, gamma: 0.1 });
  });

  it("respects the minimum lengths and rejects bad input", () => {
    expect(forecastHoltWinters([1, 2], { horizon: 1 })).toBeNull();
    expect(forecastHoltWinters([1, 2, 3], { horizon: 1 })).not.toBeNull();
    expect(
      forecastHoltWinters(
        Array.from({ length: 23 }, (_, i) => i),
        { horizon: 1, season: 12 },
      ),
    ).toBeNull();
    expect(
      forecastHoltWinters(
        Array.from({ length: 24 }, (_, i) => i),
        { horizon: 1, season: 12 },
      ),
    ).not.toBeNull();
    expect(forecastHoltWinters([1, 2, Number.NaN, 4], { horizon: 1 })).toBeNull();
    expect(forecastHoltWinters([1, 2, 3, 4], { horizon: 0 })).toBeNull();
    expect(forecastHoltWinters([1, 2, 3, 4], { horizon: 2, interval: 1 })).toBeNull();
  });
});
