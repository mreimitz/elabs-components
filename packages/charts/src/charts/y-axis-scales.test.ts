import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  applyValueAxisConfigs,
  buildValueScale,
  collectValueAxisConfigs,
  niceLogEnd,
  resolveDualAxisDomains,
  resolveValueAxis,
  valueExtent,
} from "./y-axis-scales";
import { valueAxisTicks } from "./y-axis-ticks";

function YAxis(_props: Record<string, unknown>) {
  return null;
}
YAxis.displayName = "YAxis";

describe("resolveValueAxis — domain (RM-108)", () => {
  it("passes the data-derived domain through untouched when nothing is asked", () => {
    const out = resolveValueAxis({ autoDomain: [0, 120], dataExtent: [3, 110] });
    expect(out).toEqual({ domain: [0, 120], scale: "linear", warnings: [] });
  });

  it("pins an explicit end EXACTLY and nices only the auto end", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 120],
      dataExtent: [3, 110],
      domain: [47, "auto"],
    });
    expect(out.domain[0]).toBe(47);
    expect(out.domain[1]).toBe(120);
    expect(out.warnings).toEqual([]);
  });

  it("refuses an inverted domain and keeps the data-derived one", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 120],
      dataExtent: [3, 110],
      domain: [200, 100],
    });
    expect(out.domain).toEqual([0, 120]);
    expect(out.warnings).toHaveLength(1);
  });

  it("keeps a length encoding zero-based under any domain prop (charts-honesty)", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 120],
      dataExtent: [30, 110],
      domain: [50, 150],
      lengthEncoding: true,
    });
    expect(out.domain).toEqual([0, 150]);
    expect(out.warnings[0]).toMatch(/excludes 0/);
  });
});

describe("resolveValueAxis — scale (RM-108)", () => {
  it("draws a log ruler from the data extent when every value is positive", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 2200],
      dataExtent: [60, 1900],
      domain: [50, "auto"],
      scale: "log",
    });
    expect(out.scale).toBe("log");
    expect(out.domain[0]).toBe(50);
    // 1900 rounds out to the next 1-2-5 step, not to a whole decade.
    expect(out.domain[1]).toBe(2000);
    expect(out.warnings).toEqual([]);
  });

  it("refuses log on data containing 0 and falls back to linear with one warning", () => {
    const out = resolveValueAxis({ autoDomain: [0, 120], dataExtent: [0, 110], scale: "log" });
    expect(out.scale).toBe("linear");
    expect(out.domain).toEqual([0, 120]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/includes 0/);
  });

  it("refuses log when the requested domain touches 0", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 120],
      dataExtent: [5, 110],
      domain: [0, "auto"],
      scale: "log",
    });
    expect(out.scale).toBe("linear");
  });

  it("keeps bars linear only", () => {
    const out = resolveValueAxis({
      autoDomain: [0, 120],
      dataExtent: [5, 110],
      scale: "sqrt",
      lengthEncoding: true,
    });
    expect(out.scale).toBe("linear");
    expect(out.warnings[0]).toMatch(/linear only/);
  });

  it("builds log and sqrt scales that invert and tick like the linear one", () => {
    const log = buildValueScale("log", [10, 1000], [300, 0]);
    expect(log(100)).toBeCloseTo(150);
    expect(log.invert(150)).toBeCloseTo(100);
    expect(log.ticks(5).length).toBeGreaterThan(1);
    const sqrt = buildValueScale("sqrt", [0, 100], [100, 0]);
    expect(sqrt(25)).toBeCloseTo(50);
  });
});

describe("log ticks (RM-108)", () => {
  it("thins d3's 1–9 multiples to a 1-2-5 tier within the target", () => {
    const log = buildValueScale("log", [50, 2000], [300, 0]);
    expect(log.ticks(5).length).toBeGreaterThan(10);
    const ticks = valueAxisTicks(log, 5);
    expect(ticks).toEqual([50, 100, 200, 500, 1000, 2000]);
  });

  it("leaves linear ticks exactly as d3 returns them", () => {
    const linear = buildValueScale("linear", [0, 100], [300, 0]);
    expect(valueAxisTicks(linear, 5)).toEqual(linear.ticks(5));
  });

  it("rounds log ends to 1-2-5 steps", () => {
    expect(niceLogEnd(1900, "ceil")).toBe(2000);
    expect(niceLogEnd(60, "floor")).toBe(50);
    expect(niceLogEnd(100, "ceil")).toBe(100);
  });
});

describe("collectValueAxisConfigs / applyValueAxisConfigs (RM-108)", () => {
  it("reads domain/scale off direct YAxis children, keyed by axis id", () => {
    const configs = collectValueAxisConfigs([
      createElement(YAxis, { key: "a", domain: [50, "auto"], scale: "log" }),
      createElement(YAxis, { key: "b", yAxisId: "right", numTicks: 4 }),
      createElement("div", { key: "c" }),
    ]);
    expect(configs).toEqual({ left: { domain: [50, "auto"], scale: "log" } });
  });

  it("applies a config per axis and leaves unconfigured axes alone", () => {
    const data = [
      { a: 60, b: 1 },
      { a: 1900, b: 2 },
    ];
    const out = applyValueAxisConfigs({
      autoDomainsByAxis: { left: [0, 2200], right: [0, 3] },
      configs: { left: { scale: "log" } },
      data,
      lines: [
        { dataKey: "a", stroke: "x" },
        { dataKey: "b", stroke: "y", yAxisId: "right" },
      ] as never,
    });
    expect(out.scaleKindsByAxis.left).toBe("log");
    expect(out.domainsByAxis.right).toEqual([0, 3]);
    expect(valueExtent(data, ["a"])).toEqual([60, 1900]);
  });
});

// Dual-axis — RM-121
describe("resolveDualAxisDomains (RM-121)", () => {
  const gridRows = (ticks: number[], [lo, hi]: [number, number], h = 200) =>
    ticks.map((t) => Math.round(h - ((t - lo) / (hi - lo)) * h));

  it("aligns ticks: same count, same pixel rows, zero on both (columns left)", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [120, 480], lengthEncoding: true },
      { extent: [2.1, 7.4] },
      { align: "ticks", targetTicks: 5 },
    );
    expect(left.ticks).toBeDefined();
    expect(left.ticks!.length).toBe(right.ticks!.length);
    expect(left.domain[0]).toBe(0);
    expect(right.domain[0]).toBe(0);
    expect(gridRows(left.ticks!, left.domain)).toEqual(gridRows(right.ticks!, right.domain));
    expect(left.domain[1]).toBeGreaterThanOrEqual(480);
    expect(right.domain[1]).toBeGreaterThanOrEqual(7.4);
  });

  it("proportional keeps max / tick equal on both axes, columns still zero-based", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [120, 480], lengthEncoding: true },
      { extent: [2.1, 7.4] },
      { proportional: true, targetTicks: 5 },
    );
    expect(left.domain[0]).toBe(0);
    const lt = left.ticks!.filter((t) => t !== 0);
    const rt = right.ticks!.filter((t) => t !== 0);
    lt.forEach((t, i) => {
      expect(left.domain[1] / t).toBeCloseTo(right.domain[1] / rt[i]!, 9);
    });
  });

  it("proportional without zero shares one origin (right = c · left at every row)", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [104, 196] },
      { extent: [5.3, 9.6] },
      { proportional: true, targetTicks: 5 },
    );
    expect(left.domain[0]).toBeGreaterThan(0);
    const c = right.domain[0] / left.domain[0];
    left.ticks!.forEach((t, i) => expect(right.ticks![i]).toBeCloseTo(t * c, 9));
    expect(left.domain[1] / left.domain[0]).toBeCloseTo(right.domain[1] / right.domain[0], 9);
  });

  it("zero 'auto' with two lines forces neither axis to zero", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [104, 196] },
      { extent: [5.3, 9.6] },
      { align: "ticks" },
    );
    expect(left.domain[0]).toBeGreaterThan(0);
    expect(right.domain[0]).toBeGreaterThan(0);
    expect(left.ticks!.length).toBe(right.ticks!.length);
  });

  it("zero 'both' includes zero on both, and respects the tick ceiling", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [104, 196] },
      { extent: [5.3, 9.6] },
      { zero: "both", targetTicks: 3, maxTicks: 4 },
    );
    expect(left.domain[0]).toBe(0);
    expect(right.domain[0]).toBe(0);
    expect(left.ticks!.length).toBeLessThanOrEqual(4);
    expect(left.ticks!.length).toBeGreaterThanOrEqual(3);
  });

  it("independent leaves ticks to each axis but still applies the zero rule", () => {
    const { left, right } = resolveDualAxisDomains(
      { extent: [120, 480], lengthEncoding: true },
      { extent: [2.1, 7.4] },
      { align: "independent" },
    );
    expect(left.ticks).toBeUndefined();
    expect(left.domain[0]).toBe(0);
    expect(right.domain[0]).toBe(0);
  });
});
