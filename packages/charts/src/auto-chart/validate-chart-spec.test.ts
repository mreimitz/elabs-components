/**
 * validate-chart-spec.test.ts — RM-198.
 *
 * Every `ChartType` builds from its own fixture spec and validates `ok`;
 * a "min violation" of that same fixture is rejected; `validateChartSpec`
 * never throws, on well-formed OR garbage input.
 */
import { describe, expect, it } from "vitest";
import { validateChartSpec } from "./validate-chart-spec";
import type { ChartSpec, ChartType } from "./chart-spec";
import { CHART_TYPES } from "./infer-chart-type";

// ── One valid fixture per `ChartType` ──────────────────────────────────────
// Deliberately hand-built here (not imported from `auto-chart.stories.tsx`):
// this file stays a self-contained, minimal proof of what each spec type
// needs, not a mirror of the demo data.

const CHART_TYPE_FIXTURES: Record<ChartType, ChartSpec> = {
  line: {
    type: "line",
    data: [
      { month: "Jan", revenue: 100 },
      { month: "Feb", revenue: 120 },
    ],
    x: "month",
    series: ["revenue"],
  },
  area: {
    type: "area",
    data: [
      { month: "Jan", revenue: 100 },
      { month: "Feb", revenue: 120 },
    ],
    x: "month",
    series: ["revenue"],
  },
  bar: {
    type: "bar",
    data: [
      { region: "East", sales: 40 },
      { region: "West", sales: 55 },
    ],
    x: "region",
    series: ["sales"],
  },
  pie: {
    type: "pie",
    data: [
      { segment: "Direct", value: 40 },
      { segment: "Referral", value: 60 },
    ],
    x: "segment",
    series: ["value"],
  },
  scatter: {
    type: "scatter",
    data: [
      { weight: 10, height: 20 },
      { weight: 15, height: 28 },
    ],
    x: "weight",
    xType: "number",
    series: ["height"],
  },
  radar: {
    type: "radar",
    data: [
      { axis: "Speed", teamA: 80 },
      { axis: "Power", teamA: 60 },
    ],
    x: "axis",
    series: ["teamA"],
  },
  funnel: {
    type: "funnel",
    data: [
      { stage: "Visit", count: 1000 },
      { stage: "Signup", count: 400 },
    ],
    x: "stage",
    series: ["count"],
  },
  candlestick: {
    type: "candlestick",
    data: [
      { day: "Mon", open: 10, high: 12, low: 9, close: 11 },
      { day: "Tue", open: 11, high: 13, low: 10, close: 12 },
    ],
    x: "day",
    series: ["open", "high", "low", "close"],
  },
  heatmap: {
    type: "heatmap",
    data: [
      { day: "Mon", hour: "9am", visits: 3 },
      { day: "Mon", hour: "10am", visits: 5 },
      { day: "Tue", hour: "9am", visits: 2 },
    ],
    x: "day",
    series: ["visits"],
  },
  calendar: {
    type: "calendar",
    data: [
      { date: "2026-01-01", count: 1 },
      { date: "2026-01-02", count: 4 },
    ],
    x: "date",
    series: ["count"],
  },
  waterfall: {
    type: "waterfall",
    data: [
      { stage: "Start", value: 100 },
      { stage: "Gains", value: 20 },
    ],
    x: "stage",
    series: ["value"],
  },
  dumbbell: {
    type: "dumbbell",
    data: [
      { category: "Q1", before: 10, after: 18 },
      { category: "Q2", before: 12, after: 15 },
    ],
    x: "category",
    series: ["before", "after"],
  },
  unit: {
    type: "unit",
    data: [
      { segment: "Direct", value: 40 },
      { segment: "Referral", value: 60 },
    ],
    x: "segment",
    series: ["value"],
  },
  treemap: {
    type: "treemap",
    data: [],
    x: "name",
    series: [],
    hierarchy: {
      name: "root",
      children: [
        { name: "A", value: 40 },
        { name: "B", value: 60 },
      ],
    },
  },
  histogram: {
    type: "histogram",
    data: [{ latency: 12 }, { latency: 18 }, { latency: 9 }],
    x: "latency",
    series: ["latency"],
  },
  box: {
    type: "box",
    data: [
      { group: "A", value: 12 },
      { group: "A", value: 18 },
      { group: "B", value: 9 },
    ],
    x: "group",
    series: ["value"],
    group: "group",
  },
  strip: {
    type: "strip",
    data: [
      { group: "A", value: 12 },
      { group: "B", value: 9 },
    ],
    x: "group",
    series: ["value"],
    group: "group",
  },
  bump: {
    type: "bump",
    data: [
      { quarter: "Q1", team: "Falcons", rank: 1 },
      { quarter: "Q1", team: "Hawks", rank: 2 },
      { quarter: "Q2", team: "Falcons", rank: 2 },
    ],
    x: "quarter",
    series: ["rank"],
  },
  stream: {
    type: "stream",
    data: [
      { month: "Jan", a: 4, b: 6 },
      { month: "Feb", a: 5, b: 5 },
    ],
    x: "month",
    series: ["a", "b"],
  },
  "diverging-bar": {
    type: "diverging-bar",
    data: [
      { category: "A", change: 12 },
      { category: "B", change: -8 },
    ],
    x: "category",
    series: ["change"],
  },
  "dual-axis": {
    type: "dual-axis",
    data: [
      { month: "Jan", revenue: 100, growth: 4 },
      { month: "Feb", revenue: 120, growth: 6 },
    ],
    x: "month",
    series: [
      { key: "revenue", mark: "column" },
      { key: "growth", mark: "line", axis: "right" },
    ],
  },
  choropleth: {
    type: "choropleth",
    data: [
      { state: "CA", value: 40 },
      { state: "TX", value: 30 },
    ],
    x: "state",
    series: ["value"],
    geo: "us-states",
    match: { row: "state", feature: "postal" },
  },
};

const CHART_TYPE_LIST: readonly ChartType[] = CHART_TYPES;

describe("validateChartSpec — every ChartType", () => {
  it.each(CHART_TYPE_LIST)('"%s" fixture validates ok', (type) => {
    const result = validateChartSpec(CHART_TYPE_FIXTURES[type]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(CHART_TYPE_FIXTURES[type]);
    }
  });

  it("covers every ChartType union member (no type silently skipped)", () => {
    // Fails the moment a new ChartType ships without an entry above — the
    // TS `Record<ChartType, ChartSpec>` above already enforces this at
    // compile time; this is the runtime mirror so a `pnpm test` run (not
    // just `typecheck`) catches a mismatch too.
    expect(Object.keys(CHART_TYPE_FIXTURES).sort()).toEqual([...CHART_TYPES].sort());
  });
});

describe("validateChartSpec — a min violation is rejected, per type", () => {
  // `treemap` carries its nodes in `hierarchy`, not `series` (its fixture's
  // `series` is deliberately `[]`) — its own "missing hierarchy" min
  // violation is covered separately below.
  const seriesBearingTypes = CHART_TYPE_LIST.filter((type) => type !== "treemap");

  it.each(seriesBearingTypes)('"%s" fixture rejects an unknown series column', (type) => {
    const fixture = CHART_TYPE_FIXTURES[type];
    const broken: ChartSpec = {
      ...fixture,
      series: fixture.series.map((entry: ChartSpec["series"][number]) =>
        typeof entry === "string"
          ? `${entry}--does-not-exist`
          : { ...entry, key: `${entry.key}--does-not-exist` },
      ),
    };
    const result = validateChartSpec(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("validateChartSpec — family-specific rules", () => {
  it("rejects an invalid type", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.line, type: "not-a-type" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invalid-type");
    }
  });

  it("rejects a treemap spec missing hierarchy", () => {
    const { hierarchy: _hierarchy, ...withoutHierarchy } = CHART_TYPE_FIXTURES.treemap;
    const result = validateChartSpec(withoutHierarchy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("missing-hierarchy");
    }
  });

  it("rejects a heatmap spec with only one categorical column", () => {
    const result = validateChartSpec({
      type: "heatmap",
      data: [
        { day: "Mon", visits: 3 },
        { day: "Tue", visits: 5 },
      ],
      x: "day",
      series: ["visits"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("missing-column");
      expect(result.issues[0]?.path).toBe("y2");
    }
  });

  it("rejects a bump spec with only one categorical column", () => {
    const result = validateChartSpec({
      type: "bump",
      data: [
        { quarter: "Q1", rank: 1 },
        { quarter: "Q2", rank: 2 },
      ],
      x: "quarter",
      series: ["rank"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("missing-column");
    }
  });

  it("does NOT require a second categorical column for calendar (excluded from the rule)", () => {
    const result = validateChartSpec(CHART_TYPE_FIXTURES.calendar);
    expect(result.ok).toBe(true);
  });

  it("rejects a candlestick spec missing an OHLC series", () => {
    const { series: _series, ...rest } = CHART_TYPE_FIXTURES.candlestick;
    const result = validateChartSpec({ ...rest, series: ["open", "high", "low"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("missing-column");
      expect(result.issues[0]?.message).toMatch(/close/);
    }
  });

  it("rejects a distribution spec whose group names no real column", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.box, group: "does-not-exist" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe("group");
    }
  });

  it("rejects an invalid palette value", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.treemap, palette: "rainbow" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invalid-value");
    }
  });

  it("rejects a palette on a non-treemap type", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.line, palette: "categorical" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("not-applicable");
    }
  });

  it("accepts a categorical palette on a treemap spec", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.treemap, palette: "categorical" });
    expect(result.ok).toBe(true);
  });
});

describe("validateChartSpec — version (RM-198)", () => {
  it("treats an absent version as ok, with no version issue", () => {
    const result = validateChartSpec(CHART_TYPE_FIXTURES.line);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.issues.find((i) => i.path === "version")).toBeUndefined();
    }
  });

  it("treats version 1 as ok, with no version issue", () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.line, version: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.issues.find((i) => i.path === "version")).toBeUndefined();
    }
  });

  it("still validates an unrecognised version — a warning issue, not a failure", () => {
    // `version: 2` is deliberately out of the `1`-only union — `spec` is
    // `unknown`, the way an untrusted / future-built spec would arrive at
    // runtime, so this is not a type error to suppress.
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.line, version: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const versionIssue = result.issues.find((i) => i.path === "version");
      expect(versionIssue?.code).toBe("unsupported-version");
      expect(versionIssue?.severity).toBe("warning");
    }
  });
});

describe("validateChartSpec — never throws", () => {
  const garbageInputs: unknown[] = [
    null,
    undefined,
    42,
    "not a spec",
    [],
    {},
    { data: "not-an-array" },
    { data: [], series: "not-an-array" },
    { data: [], series: [], x: 42 },
    { data: [{}], series: [{}], x: "missing" },
    { data: [{ a: 1 }], series: [{ key: "" }], x: "a" },
    { type: "line", data: null, series: null, x: null },
  ];

  it.each(garbageInputs)("does not throw on %j", (input) => {
    expect(() => validateChartSpec(input)).not.toThrow();
  });

  it("reports ok:false for every one of them", () => {
    for (const input of garbageInputs) {
      expect(validateChartSpec(input).ok).toBe(false);
    }
  });
});
