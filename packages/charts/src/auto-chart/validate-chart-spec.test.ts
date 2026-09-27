/**
 * validate-chart-spec.test.ts
 *
 * Every `ChartType` builds from its own fixture spec and validates `ok`;
 * a "min violation" of that same fixture is rejected; `validateChartSpec`
 * never throws, on well-formed OR garbage input.
 */
import { describe, expect, it } from "vitest";
import {
  minSeriesFor,
  UNDER_MIN_SERIES_IS_WARNING_ONLY,
  validateChartSpec,
} from "./validate-chart-spec";
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

describe("validateChartSpec — fewer series than the type needs is flagged (F4)", () => {
  // Only a type whose fixture is already AT its own derived minimum proves
  // anything by dropping one series — otherwise the fixture had slack and
  // still validates, which is not what this test is for. Excluded, each for
  // its own reason: `treemap` carries no series at all (hierarchy-based, its
  // own describe block above); `bump`/`dual-axis`/`choropleth` derive a
  // `minSeriesFor` of 0 today (no `role: "measure"` target); `stream`'s
  // fixture carries 2 series against a derived minimum of 1, so dropping one
  // still leaves a valid spec.
  const typesAtOwnMinimum = CHART_TYPE_LIST.filter((type) => {
    const fixture = CHART_TYPE_FIXTURES[type];
    const needed = minSeriesFor(type);
    return needed > 0 && fixture.series.length === needed;
  });

  it.each(typesAtOwnMinimum)('"%s" fixture with its last series dropped', (type) => {
    const fixture = CHART_TYPE_FIXTURES[type];
    const broken: ChartSpec = { ...fixture, series: fixture.series.slice(0, -1) };
    const result = validateChartSpec(broken);

    if (UNDER_MIN_SERIES_IS_WARNING_ONLY.has(type)) {
      // Still renders something real (a degenerate chart) today — a
      // warning, not a hard failure: F4 must not newly fail a spec that
      // already renders.
      expect(result.ok).toBe(true);
      expect(
        result.issues.some((i) => i.code === "too-few-series" && i.severity === "warning"),
      ).toBe(true);
      return;
    }

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("covers every type this build derives a real minimum for, minus the acknowledged slack/zero cases", () => {
    expect(typesAtOwnMinimum.sort()).toEqual(
      CHART_TYPE_LIST.filter(
        (type) => !["treemap", "bump", "dual-axis", "choropleth", "stream"].includes(type),
      ).sort(),
    );
  });

  it("names today's only warning-only type", () => {
    expect([...UNDER_MIN_SERIES_IS_WARNING_ONLY].sort()).toEqual(["dumbbell"]);
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

describe("validateChartSpec — field applicability is a warning, never a fail (F6)", () => {
  it('warns, but still validates ok, when "group" is set on a non-distribution type', () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.bar, group: "region" });
    expect(result.ok).toBe(true);
    const warning = result.issues.find((i) => i.path === "group");
    expect(warning?.code).toBe("not-applicable");
    expect(warning?.severity).toBe("warning");
  });

  it('does not warn when "group" is set on a distribution type', () => {
    const result = validateChartSpec(CHART_TYPE_FIXTURES.box);
    expect(result.ok).toBe(true);
    expect(result.issues.find((i) => i.path === "group")).toBeUndefined();
  });

  it('warns, but still validates ok, when "y2" is set on a type that never reads it', () => {
    const result = validateChartSpec({ ...CHART_TYPE_FIXTURES.line, y2: "segment" });
    expect(result.ok).toBe(true);
    const warning = result.issues.find((i) => i.path === "y2");
    expect(warning?.code).toBe("not-applicable");
    expect(warning?.severity).toBe("warning");
  });

  it('does not warn when "y2" is set on a heatmap/bump/calendar spec', () => {
    // heatmap/bump: `y2` must still name a REAL second categorical column (a
    // separate, ERROR-level check, not this one) — "extra" would trip that
    // instead and never reach the applicability warning this test is for.
    // calendar carries no such required-column check, so "extra" is fine.
    const y2ByType = { heatmap: "hour", bump: "team", calendar: "extra" } as const;
    for (const type of ["heatmap", "bump", "calendar"] as const) {
      const result = validateChartSpec({ ...CHART_TYPE_FIXTURES[type], y2: y2ByType[type] });
      expect(
        result.issues.find((i) => i.path === "y2" && i.code === "not-applicable"),
      ).toBeUndefined();
    }
  });

  // Fix round 2, F4: the documented dumbbell `y2` form — one `series` entry
  // (the "before" value) plus `y2` (the "after" value), per `y2`'s own TSDoc
  // in `chart-spec.ts` — used to produce two false warnings: `not-applicable`
  // on `y2` (dumbbell was missing from `Y2_APPLICABLE_SPEC_TYPES`) and
  // `too-few-series` (a dumbbell needs 2 measure series and `y2` was not
  // counted as one). A complete spec in its documented shorthand form must
  // validate with zero issues, not just `ok: true` with warnings attached.
  it('a documented dumbbell "series + y2" spec returns zero issues, not even a warning', () => {
    const result = validateChartSpec({
      type: "dumbbell",
      data: [
        { category: "Q1", "2024": 10, "2025": 18 },
        { category: "Q2", "2024": 12, "2025": 15 },
      ],
      x: "category",
      series: ["2024"],
      y2: "2025",
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

describe("validateChartSpec — version", () => {
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
    // F3: a bare value standing in for a row — `isPlainRow` rejects it rather
    // than letting `key in row` throw on a number/string.
    { data: [1], series: ["a"], x: "a" },
    { data: ["abc"], series: ["a"], x: "a" },
    // F3: a real row mixed with a bare value, exercised through the
    // distribution family's `group` check (`isPlainRow` guards that `some`
    // rather than letting the bare `7` throw on `"missing-col" in row`); the
    // real row still lacks `group`'s column, so this is still a rejected spec.
    {
      type: "histogram",
      data: [7, { a: 1 }],
      series: ["a"],
      x: "a",
      group: "missing-col",
    },
  ];

  it.each(garbageInputs)("does not throw on %j", (input) => {
    expect(() => validateChartSpec(input)).not.toThrow();
  });

  // F3: a row whose column is a throwing getter, kept out of `garbageInputs`
  // itself — `it.each`'s own `%j` test-name formatting reads every property
  // to build the name, which would invoke (and re-throw from) the getter
  // before `validateChartSpec` ever ran. `key in row` never invokes it, but
  // `explainChartType`'s own value sampling does; the outer
  // `validateChartSpec` try/catch turns that throw into an issue, not a crash.
  it("does not throw when a row's column is a throwing getter", () => {
    const spec = {
      data: [
        Object.defineProperty({}, "a", {
          get: () => {
            throw new Error("boom");
          },
          enumerable: true,
        }),
      ],
      series: ["a"],
      x: "a",
    };
    expect(() => validateChartSpec(spec)).not.toThrow();
    expect(validateChartSpec(spec).ok).toBe(false);
  });

  it("reports ok:false for every one of them", () => {
    for (const input of garbageInputs) {
      expect(validateChartSpec(input).ok).toBe(false);
    }
  });
});
