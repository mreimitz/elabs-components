import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  applyValueAxisConfigs,
  buildValueScale,
  collectValueAxisConfigs,
  resolveValueAxis,
  valueExtent,
} from "./y-axis-scales";

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
    expect(out.domain[1]).toBe(10000);
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
