/**
 * The acceptance criterion for `kde.ts` is "the KDE integrates to 1 ± 0.01"
 * (RM-026). That is the estimate's own self-check: a density that does not
 * integrate to one has either a normalisation bug (the `1 / (n·h)` factor) or a
 * grid too short to hold the mass — the two ways this module can be wrong while
 * still LOOKING like a violin.
 */
import { describe, expect, it } from "vitest";
import { seededRnd } from "../../marks/seeded-rnd";
import {
  gaussianKernel,
  integrateDensity,
  KDE_GRID_POINTS,
  KDE_TAPER,
  kde,
  kdeDensityAt,
  silvermanBandwidth,
} from "./kde";

/** A deterministic, roughly normal sample: the mean of 4 uniform draws. */
function normalish(n: number, k: number, centre = 50, spread = 30): number[] {
  return Array.from({ length: n }, (_v, i) => {
    const u =
      (seededRnd(i, k) + seededRnd(i, k + 1) + seededRnd(i, k + 2) + seededRnd(i, k + 3)) / 4;
    return centre + (u - 0.5) * 2 * spread;
  });
}

describe("gaussianKernel", () => {
  it("is the standard normal pdf", () => {
    expect(gaussianKernel(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
    expect(gaussianKernel(1)).toBeCloseTo(0.24197072451914337, 12);
    expect(gaussianKernel(-1)).toBeCloseTo(gaussianKernel(1), 12);
  });
});

describe("silvermanBandwidth", () => {
  it("shrinks as n grows (the n^(-1/5) term)", () => {
    const small = silvermanBandwidth(normalish(30, 1));
    const large = silvermanBandwidth(normalish(3000, 1));
    expect(large).toBeLessThan(small);
  });

  it("is always strictly positive, even for degenerate input", () => {
    expect(silvermanBandwidth([])).toBeGreaterThan(0);
    expect(silvermanBandwidth([7])).toBeGreaterThan(0);
    expect(silvermanBandwidth([7, 7, 7, 7])).toBeGreaterThan(0);
  });
});

describe("kde", () => {
  it("samples the fixed 44-point grid, tapered 1.6 bandwidths past the data", () => {
    const values = normalish(200, 5);
    const result = kde(values);
    expect(result.points).toHaveLength(KDE_GRID_POINTS);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    expect(result.points[0]?.value).toBeCloseTo(lo - KDE_TAPER * result.bandwidth, 10);
    expect(result.points.at(-1)?.value).toBeCloseTo(hi + KDE_TAPER * result.bandwidth, 10);
  });

  it("integrates to 1 ± 0.01 across sample sizes, spreads and shapes", () => {
    const cases: Array<[string, number[]]> = [
      ["n = 40", normalish(40, 11)],
      ["n = 200", normalish(200, 12)],
      ["n = 2000", normalish(2000, 13)],
      ["wide spread", normalish(200, 14, 1000, 400)],
      ["tight spread", normalish(200, 15, 0.5, 0.02)],
      // A long right tail — the case where a too-short grid loses mass.
      ["skewed", normalish(300, 18).map((v) => v ** 2 / 60)],
    ];
    for (const [label, values] of cases) {
      const mass = integrateDensity(kde(values).points);
      expect(mass, `${label} integrates to ${mass}`).toBeGreaterThan(0.99);
      expect(mass, `${label} integrates to ${mass}`).toBeLessThan(1.01);
    }
  });

  it("loses ~2% of its mass when Silverman OVER-SMOOTHS a bimodal sample, and regains it with an explicit bandwidth", () => {
    // The documented limit of the 1.6-bandwidth taper, pinned as a number rather
    // than left as prose. Two clusters ~6 wide, 60 apart: the pooled spread
    // drives Silverman to h ≈ 8.6, wider than either cluster, so most of the
    // sample sits within 2 h of an END of the grid and its tails fall off it.
    const bimodal = [...normalish(150, 16, 20, 6), ...normalish(150, 17, 80, 6)];
    expect(silvermanBandwidth(bimodal)).toBeGreaterThan(6);

    const oversmoothed = integrateDensity(kde(bimodal).points);
    expect(oversmoothed).toBeGreaterThan(0.97);
    expect(oversmoothed).toBeLessThan(0.99);

    // The prescribed fix — a bandwidth proportionate to the structure that is
    // actually there — is back inside the ± 0.01 band.
    const tuned = integrateDensity(kde(bimodal, { bandwidth: 2 }).points);
    expect(tuned).toBeGreaterThan(0.99);
    expect(tuned).toBeLessThan(1.01);
  });

  it("still integrates to ~1 with a caller-supplied bandwidth", () => {
    const values = normalish(200, 21);
    for (const bandwidth of [1, 4, 12]) {
      const mass = integrateDensity(kde(values, { bandwidth }).points);
      expect(mass).toBeGreaterThan(0.99);
      expect(mass).toBeLessThan(1.01);
    }
  });

  it("returns an empty result for empty input rather than a flat zero curve", () => {
    const result = kde([]);
    expect(result.points).toEqual([]);
    expect(result.peak).toBe(0);
  });

  it("peaks where the data is densest", () => {
    const values = [...normalish(300, 31, 20, 4), ...normalish(60, 32, 80, 4)];
    const result = kde(values);
    const peakPoint = result.points.reduce((best, point) =>
      point.density > best.density ? point : best,
    );
    expect(peakPoint.value).toBeGreaterThan(10);
    expect(peakPoint.value).toBeLessThan(35);
  });
});

describe("kdeDensityAt", () => {
  it("matches the grid the sampler produced", () => {
    const values = normalish(120, 41);
    const result = kde(values);
    for (const point of result.points) {
      expect(kdeDensityAt(values, point.value, result.bandwidth)).toBeCloseTo(point.density, 12);
    }
  });

  it("is zero for an empty sample or a non-positive bandwidth", () => {
    expect(kdeDensityAt([], 5, 1)).toBe(0);
    expect(kdeDensityAt([1, 2, 3], 2, 0)).toBe(0);
  });
});
