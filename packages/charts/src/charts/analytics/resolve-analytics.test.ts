/**
 * Golden tests for the pure halves of RM-138 / RM-139: `resolveAnalytics`
 * (lines/bands → annotations), `derivedSeries` (trend / window / forecast /
 * error bars → samples) and the domain / description helpers. Every expected
 * number is recomputed with RM-137's maths on the same rows.
 */
import { describe, expect, it } from "vitest";
import { CAMPAIGNS, LIFE_BY_YEAR, MONTHLY_REVENUE, PRODUCT_LINES } from "./analytics-fixtures";
import {
  derivedExtent,
  derivedSeries,
  describeAnalytics,
  errorBarRange,
  horizonXValues,
} from "./derived-series";
import { forecastHoltWinters } from "./forecast";
import { fitModel } from "./regression";
import { resolveAnalytics, widenDomainForAnalytics } from "./resolve-analytics";
import { mean, quantile } from "./stats";

const t = (key: string, vars?: Record<string, string | number>) => {
  const names: Record<string, string> = {
    "charts.analytics.mean": "Average",
    "charts.analytics.median": "Median",
    "charts.analytics.iqr": "Interquartile range",
    "charts.analytics.trend": "Trend",
    "charts.analytics.trendLoess": "Smoothed trend",
    "charts.analytics.forecast": "Forecast",
  };
  if (names[key]) return names[key];
  return `${key}${vars ? JSON.stringify(vars) : ""}`;
};
const format = (v: number) => (Math.round(v * 10) / 10).toString();
const ctx = { seriesKeys: ["years"], xDataKey: "date", format, t };

describe("resolveAnalytics", () => {
  it("a mean line → a y line annotation labelled “Average 73.8”", () => {
    const out = resolveAnalytics(LIFE_BY_YEAR, [{ kind: "line", value: "mean" }], ctx);
    expect(out.annotations).toHaveLength(1);
    const line = out.annotations[0] as { kind: string; y: number; label: string; ink: string };
    expect(line.kind).toBe("line");
    expect(line.y).toBeCloseTo(73.8, 12);
    expect(line.label).toBe("Average 73.8");
    expect(line.ink).toBe("foreground");
    expect(out.marks[0]?.description).toBe("Average 73.8");
    expect(out.extents).toEqual([]);
  });

  it('pools every series for of: "all" and publishes an extent for ifOverflow: extend', () => {
    const keys = ["atlas", "borealis", "cirrus"];
    const out = resolveAnalytics(
      PRODUCT_LINES,
      [{ kind: "line", value: { percentile: 90 }, of: "all", ifOverflow: "extend" }],
      { ...ctx, seriesKeys: keys },
    );
    const pooled = keys.flatMap((k) => PRODUCT_LINES.map((row) => row[k] as number));
    expect(out.marks[0]?.value).toBeCloseTo(quantile(pooled, 0.9) as number, 12);
    expect(out.extents[0]?.keys).toBe("all");
  });

  it("honours when, and an x statistic on a time axis reads back as a Date", () => {
    const out = resolveAnalytics(
      LIFE_BY_YEAR,
      [
        { kind: "line", value: "mean", when: () => false },
        { kind: "line", axis: "x", value: "median" },
      ],
      { ...ctx, xContinuous: true },
    );
    expect(out.annotations).toHaveLength(1);
    const line = out.annotations[0] as { x: Date };
    expect(line.x).toBeInstanceOf(Date);
    expect(line.x.getTime()).toBe(new Date(2021, 0, 1).getTime());
  });

  it("a percentile band on a horizontal chart runs along x", () => {
    const out = resolveAnalytics(
      LIFE_BY_YEAR,
      [{ kind: "band", spread: { percentiles: [25, 75] } }],
      { ...ctx, valueAxis: "x" },
    );
    const band = out.annotations[0] as { x1: number; x2: number; label: string };
    const years = LIFE_BY_YEAR.map((r) => r.years);
    expect(band.x1).toBeCloseTo(quantile(years, 0.25) as number, 12);
    expect(band.x2).toBeCloseTo(quantile(years, 0.75) as number, 12);
    expect(band.label).toBe("Interquartile range 72.5–75.1");
  });
});

describe("widenDomainForAnalytics", () => {
  it("grows only the end an extent passes, padded by 5 % of the span", () => {
    expect(
      widenDomainForAnalytics([0, 100], [{ axis: "y", keys: ["a"], lo: 10, hi: 150 }], ["a"]),
    ).toEqual([0, 157.5]);
    expect(
      widenDomainForAnalytics([0, 100], [{ axis: "y", keys: ["b"], lo: 10, hi: 150 }], ["a"]),
    ).toEqual([0, 100]);
    expect(widenDomainForAnalytics([0, 100], [], ["a"])).toEqual([0, 100]);
  });
});

describe("derivedSeries", () => {
  const dctx = { xDataKey: "spend", seriesKeys: ["revenue"], format, t };

  it("a loess trend's samples equal fitModel(loess).predict at every x", () => {
    const series = derivedSeries(CAMPAIGNS, { kind: "trend", model: { loess: 0.35 } }, dctx);
    const fit = fitModel(
      CAMPAIGNS.map((c) => ({ x: c.spend, y: c.revenue })),
      { loess: 0.35 },
    );
    expect(series?.label).toBe("Smoothed trend");
    for (const p of series?.points ?? []) {
      expect(p.y).toBeCloseTo(fit?.predict(p.xNum) as number, 10);
    }
  });

  it("a forecast equals forecastHoltWinters and steps whole months", () => {
    const series = derivedSeries(
      MONTHLY_REVENUE,
      { kind: "forecast", horizon: 6, season: 12 },
      { ...dctx, xDataKey: "date", seriesKeys: ["revenue"] },
    );
    const fc = forecastHoltWinters(
      MONTHLY_REVENUE.map((r) => r.revenue),
      { horizon: 6, season: 12 },
    );
    expect(series?.points).toHaveLength(7);
    series?.points.slice(1).forEach((p, h) => {
      expect(p.y).toBeCloseTo(fc?.points[h] as number, 12);
      expect(p.lower).toBeCloseTo(fc?.lower[h] as number, 12);
      expect((p.x as Date).getTime()).toBe(new Date(2025, h, 1).getTime());
    });
    expect(series?.dashed).toBe(true);
    // The extent covers the whole prediction band.
    const extent = derivedExtent(series!, "y");
    expect(extent?.hi).toBeGreaterThanOrEqual(Math.max(...(fc?.upper ?? [])));
  });

  it("horizon x values follow the data's rhythm", () => {
    expect(horizonXValues([1, 3, 5], "number", 2)).toEqual([7, 9]);
    expect(horizonXValues(["a", "b"], "category", 2)).toEqual(["+1", "+2"]);
    const daily = [new Date(2024, 0, 1), new Date(2024, 0, 2)];
    expect((horizonXValues(daily, "time", 1)[0] as Date).getDate()).toBe(3);
  });

  it("error bars: two fields, a mirrored field, a percentage", () => {
    const row = { v: 10, lo: 8, hi: 13 };
    expect(errorBarRange(row, "v", { low: "lo", high: "hi" })).toEqual([8, 13]);
    expect(errorBarRange(row, "v", { low: "lo" })).toEqual([8, 12]);
    expect(errorBarRange(row, "v", { low: { percent: 10 } })).toEqual([9, 11]);
    expect(errorBarRange({ v: null }, "v", { low: { percent: 10 } })).toBeNull();
  });

  it("a window with replace takes the measure's token; beside it stays muted", () => {
    const rctx = {
      ...dctx,
      xDataKey: "date",
      seriesKeys: ["revenue"],
      seriesColors: { revenue: "var(--chart-2)" },
      seriesNames: { revenue: "Revenue" },
    };
    const replaced = derivedSeries(MONTHLY_REVENUE, { kind: "window", k: 3, replace: true }, rctx);
    const beside = derivedSeries(MONTHLY_REVENUE, { kind: "window", k: 3 }, rctx);
    expect(replaced?.color).toBe("var(--chart-2)");
    expect(replaced?.name).toMatch(/^Revenue · /);
    expect(beside?.color).toBe("var(--chart-foreground-muted)");
    expect(replaced?.points[5]?.y).toBeCloseTo(
      mean(MONTHLY_REVENUE.slice(3, 6).map((r) => r.revenue)) as number,
      12,
    );
  });
});

describe("describeAnalytics", () => {
  it("one sentence per analytic, in array order", () => {
    expect(
      describeAnalytics(
        [{ index: 1, description: "Average 73.8" }],
        [{ index: 0, description: "Trend rises, r² 0.82" }],
      ),
    ).toBe("Trend rises, r² 0.82. Average 73.8.");
    expect(describeAnalytics([], [])).toBeUndefined();
  });
});
