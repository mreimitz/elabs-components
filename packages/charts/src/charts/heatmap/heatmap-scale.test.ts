/**
 * heatmap-scale — the value-to-ink layer: domain, buckets, dot area, the
 * continuous fallback and the accessible sentence.
 *
 * The load-bearing assertions here are the two HONESTY properties, not the
 * arithmetic: a dot's AREA (never its radius) is proportional to its value, and
 * a diverging domain is symmetric so its neutral step lands on zero.
 */

import { describe, expect, it } from "vitest";
import {
  buildHeatmapBuckets,
  bucketIndexOf,
  CONTINUOUS_MIN_OPACITY,
  continuousInk,
  dotRadius,
  heatmapDomain,
  heatmapSummary,
  sampleContinuousInk,
} from "./heatmap-scale";

const RAMP = ["c1", "c2", "c3", "c4", "c5"];
const plain = (value: number) => String(value);

describe("heatmapDomain", () => {
  it("uses the data's own range for an ordered ramp", () => {
    expect(heatmapDomain(3, 91, false)).toEqual({ lo: 3, hi: 91 });
  });

  it("is symmetric for a diverging ramp, so the neutral step is zero", () => {
    expect(heatmapDomain(-12, 40, true)).toEqual({ lo: -40, hi: 40 });
    expect(heatmapDomain(-40, 12, true)).toEqual({ lo: -40, hi: 40 });
  });

  it("never returns a zero-width domain", () => {
    expect(heatmapDomain(7, 7, false).hi).toBeGreaterThan(7);
    expect(heatmapDomain(0, 0, false)).toEqual({ lo: 0, hi: 1 });
    expect(heatmapDomain(0, 0, true)).toEqual({ lo: -1, hi: 1 });
  });
});

describe("buildHeatmapBuckets / bucketIndexOf", () => {
  const buckets = buildHeatmapBuckets(0, 100, RAMP);

  it("cuts equal-WIDTH steps, one per ramp colour", () => {
    expect(buckets).toHaveLength(5);
    expect(buckets.map((b) => b.from)).toEqual([0, 20, 40, 60, 80]);
    expect(buckets[4]?.to).toBe(100);
  });

  it("puts a value in the step its magnitude belongs to", () => {
    expect(bucketIndexOf(buckets, 0)).toBe(0);
    expect(bucketIndexOf(buckets, 19.9)).toBe(0);
    expect(bucketIndexOf(buckets, 20)).toBe(1);
    expect(bucketIndexOf(buckets, 100)).toBe(4);
  });

  it("clamps an out-of-domain value instead of leaving a hole", () => {
    expect(bucketIndexOf(buckets, -50)).toBe(0);
    expect(bucketIndexOf(buckets, 999)).toBe(4);
  });

  it("has no buckets when there is no ramp", () => {
    expect(buildHeatmapBuckets(0, 1, [])).toEqual([]);
    expect(bucketIndexOf([], 3)).toBe(-1);
  });
});

describe("dotRadius", () => {
  it("makes AREA proportional to value, not radius", () => {
    const half = dotRadius(50, 100, 10);
    const full = dotRadius(100, 100, 10);
    expect(full).toBe(10);
    // Half the value is half the AREA: r = R/√2, not R/2.
    expect(half).toBeCloseTo(10 / Math.SQRT2, 10);
    expect((half / full) ** 2).toBeCloseTo(0.5, 10);
  });

  it("ignores sign — a diverging heatmap's ±40 draw the same size", () => {
    expect(dotRadius(-40, 40, 8)).toBe(dotRadius(40, 40, 8));
  });

  it("is zero when there is nothing to scale against", () => {
    expect(dotRadius(5, 0, 10)).toBe(0);
    expect(dotRadius(5, 10, 0)).toBe(0);
  });
});

describe("continuousInk", () => {
  it("never fades a real value to nothing", () => {
    expect(continuousInk(0, 0, 100, "ink").opacity).toBe(CONTINUOUS_MIN_OPACITY);
    expect(continuousInk(100, 0, 100, "ink").opacity).toBeCloseTo(1, 10);
  });

  it("keeps one hue per arm on a diverging scale", () => {
    expect(continuousInk(-30, -50, 50, "pos", "neg").color).toBe("neg");
    expect(continuousInk(30, -50, 50, "pos", "neg").color).toBe("pos");
    // Same magnitude, same weight — only the hue differs.
    expect(continuousInk(-30, -50, 50, "pos", "neg").opacity).toBeCloseTo(
      continuousInk(30, -50, 50, "pos", "neg").opacity,
      10,
    );
  });

  it("samples a legend strip that spans the domain", () => {
    const samples = sampleContinuousInk(5, 0, 100, "ink");
    expect(samples).toHaveLength(5);
    expect(samples[0]?.opacity).toBe(CONTINUOUS_MIN_OPACITY);
    expect(samples[4]?.opacity).toBeCloseTo(1, 10);
    expect(sampleContinuousInk(0, 0, 1, "ink")).toEqual([]);
  });
});

describe("heatmapSummary", () => {
  it("names the grid and the peak, because the SVG is aria-hidden", () => {
    expect(
      heatmapSummary(
        { rows: 7, columns: 24, calendar: false, peak: { x: "14:00", y: "Wed", value: 42 } },
        plain,
      ),
    ).toBe("Heatmap, 7 rows × 24 columns, peak 42 at Wed 14:00.");
  });

  it("counts a calendar in weeks and weekdays, and names the day", () => {
    expect(
      heatmapSummary(
        { rows: 7, columns: 53, calendar: true, peak: { x: "2026-03-09", y: "Mon", value: 9 } },
        plain,
      ),
    ).toBe("Heatmap, 53 weeks × 7 weekdays, peak 9 at 2026-03-09.");
  });

  it("says so when there is nothing to peak at", () => {
    expect(heatmapSummary({ rows: 3, columns: 3, calendar: false, peak: null }, plain)).toBe(
      "Heatmap, 3 rows × 3 columns, no values.",
    );
  });
});
