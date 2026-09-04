/**
 * infer-chart-type.test.ts — the RM-038 decision-tree fixture table.
 *
 * One table, one row per SHAPE, driving `explainChartType`. It is deliberately
 * separate from `auto-chart.test.tsx`, which mocks `@visx/responsive` and
 * `react-use-measure` for its render tests; the inference is pure and needs
 * none of that.
 *
 * ── What makes this table a real lock ──────────────────────────────────────
 *
 * A fixture table is easy to write and easy to make vacuous: with fifteen
 * ordered rules, several fixtures satisfy two or three of them at once, so
 * deleting a rule can leave every row still green (a later rule catches it and
 * happens to agree). Every rule below therefore has at least one fixture that
 * ONLY that rule can satisfy — verified by deleting each rule in turn and
 * checking that exactly the fixtures naming it changed. The `rule` column is
 * asserted alongside the `type` column precisely so a row cannot pass through
 * a DIFFERENT rule that reaches the same answer.
 *
 * The rows tagged `// pair:` are the overlap cases: two rules could both fire
 * and the ORDER decides. Each pair is present twice — once where the earlier
 * rule wins, once where its signal is absent and the later rule takes over.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { ChartSpec, ChartType } from "./chart-spec";
import { CHART_TYPES, explainChartType, inferChartType, isChartType } from "./infer-chart-type";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Fixture builders ─────────────────────────────────────────────────────────

/** `count` consecutive daily rows from 2024-01-01, one measure. */
function dailyRows(count: number, key = "commits"): Record<string, unknown>[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    [key]: (i * 7) % 13,
  }));
}

/** `perGroup` records in each of `groups` cohorts. */
function records(groups: number, perGroup: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let g = 0; g < groups; g += 1) {
    for (let i = 0; i < perGroup; i += 1) {
      rows.push({ cohort: `C${g + 1}`, ms: 100 + ((g * 31 + i * 7) % 400) });
    }
  }
  return rows;
}

// ── The table ────────────────────────────────────────────────────────────────

interface Fixture {
  name: string;
  spec: ChartSpec;
  type: ChartType;
  rule: string;
}

const FIXTURES: Fixture[] = [
  // 1 — candlestick. Only the OHLC rule can answer this; a date x otherwise
  // reads as `line`.
  {
    name: "OHLC columns on a date axis",
    spec: {
      data: [
        { date: "2024-01-15", open: 112, high: 119, low: 110, close: 118 },
        { date: "2024-01-16", open: 118, high: 124, low: 116, close: 121 },
      ],
      x: "date",
      series: ["open", "high", "low", "close"],
    },
    type: "candlestick",
    rule: "ohlc",
  },
  // pair: candlestick vs bar — the SAME four column names with no date axis
  // cannot be candles (the container plots Dates), so the default takes it.
  {
    name: "OHLC column names against a categorical x",
    spec: {
      data: [
        { session: "Mon", open: 112, high: 119, low: 110, close: 118 },
        { session: "Tue", open: 118, high: 124, low: 116, close: 121 },
      ],
      x: "session",
      series: ["open", "high", "low", "close"],
    },
    type: "bar",
    rule: "default",
  },

  // 2 — treemap. The only rule that reads `hierarchy`; the rows are a decoy
  // that would otherwise infer `line`.
  {
    name: "a nested hierarchy (with decoy temporal rows)",
    spec: {
      data: [
        { date: "2024-01-01", revenue: 10 },
        { date: "2024-02-01", revenue: 12 },
      ],
      x: "date",
      series: ["revenue"],
      hierarchy: {
        name: "Spend",
        children: [
          { name: "Cloud", value: 40 },
          { name: "Salaries", value: 60 },
        ],
      },
    },
    type: "treemap",
    rule: "hierarchy",
  },

  // 3 — bump, declared.
  {
    name: "long (period, entity, score) rows declared as a ranking",
    spec: {
      data: [
        { quarter: "Q1", team: "Alpha", score: 12 },
        { quarter: "Q1", team: "Beta", score: 9 },
        { quarter: "Q2", team: "Alpha", score: 8 },
        { quarter: "Q2", team: "Beta", score: 14 },
      ],
      x: "quarter",
      series: ["score"],
      kind: "ranking",
    },
    type: "bump",
    rule: "ranking",
  },
  // 3b — bump, signalled by the measure's own name instead of `kind`.
  {
    name: "long (period, entity, rank) rows whose measure IS the rank",
    spec: {
      data: [
        { quarter: "Q1", team: "Alpha", rank: 1 },
        { quarter: "Q1", team: "Beta", rank: 2 },
        { quarter: "Q2", team: "Alpha", rank: 2 },
        { quarter: "Q2", team: "Beta", rank: 1 },
      ],
      x: "quarter",
      series: ["rank"],
    },
    type: "bump",
    rule: "ranking",
  },
  // pair: bump vs heatmap — the SAME shape with no ranking signal is a matrix.
  // This is the pair the module docblock argues about; the signal is the only
  // separator, which is why bump runs first.
  {
    name: "the same long rows with no ranking signal",
    spec: {
      data: [
        { quarter: "Q1", team: "Alpha", score: 12 },
        { quarter: "Q1", team: "Beta", score: 9 },
        { quarter: "Q2", team: "Alpha", score: 8 },
        { quarter: "Q2", team: "Beta", score: 14 },
      ],
      x: "quarter",
      series: ["score"],
    },
    type: "heatmap",
    rule: "matrix",
  },

  // 4 — calendar.
  {
    name: "400 dated rows of one measure",
    spec: { data: dailyRows(400), x: "date", series: ["commits"] },
    type: "calendar",
    rule: "calendar",
  },
  // pair: calendar vs line — under the threshold it stays a line.
  {
    name: "100 dated rows of one measure",
    spec: { data: dailyRows(100), x: "date", series: ["commits"] },
    type: "line",
    rule: "temporal",
  },

  // 5 — stream.
  {
    name: "three stacked series over time",
    spec: {
      data: [
        { date: "2024-01-01", a: 4, b: 6, c: 2 },
        { date: "2024-02-01", a: 5, b: 4, c: 3 },
      ],
      x: "date",
      series: ["a", "b", "c"],
      stacked: true,
    },
    type: "stream",
    rule: "stream",
  },
  // pair: stream vs line — stacked but a single series is not a streamgraph.
  {
    name: "one stacked series over time",
    spec: {
      data: [
        { date: "2024-01-01", a: 4 },
        { date: "2024-02-01", a: 5 },
      ],
      x: "date",
      series: ["a"],
      stacked: true,
    },
    type: "line",
    rule: "temporal",
  },

  // 6 — heatmap, discovered row key.
  {
    name: "weekday x hour x one value",
    spec: {
      data: [
        { day: "Mon", hour: "09", visits: 12 },
        { day: "Mon", hour: "10", visits: 30 },
        { day: "Tue", hour: "09", visits: 8 },
        { day: "Tue", hour: "10", visits: 22 },
      ],
      x: "day",
      series: ["visits"],
    },
    type: "heatmap",
    rule: "matrix",
  },
  // 6b — heatmap, explicit `y2` row key (a THIRD categorical column is present,
  // so discovery alone would be ambiguous and return nothing).
  {
    name: "an explicit y2 row key beside an extra label column",
    spec: {
      data: [
        { day: "Mon", hour: "09", note: "am", visits: 12 },
        { day: "Mon", hour: "10", note: "am", visits: 30 },
        { day: "Tue", hour: "09", note: "pm", visits: 8 },
        { day: "Tue", hour: "10", note: "pm", visits: 22 },
      ],
      x: "day",
      y2: "hour",
      series: ["visits"],
    },
    type: "heatmap",
    rule: "matrix",
  },
  // pair: heatmap vs pie — four non-negative rows summing to 100 satisfy the
  // pie rule too; the second categorical axis outranks the row count.
  {
    name: "four rows summing to 100 that also carry a second categorical key",
    spec: {
      data: [
        { channel: "Direct", device: "Mobile", share: 30 },
        { channel: "Direct", device: "Desktop", share: 20 },
        { channel: "Organic", device: "Mobile", share: 25 },
        { channel: "Organic", device: "Desktop", share: 25 },
      ],
      x: "channel",
      series: ["share"],
    },
    type: "heatmap",
    rule: "matrix",
  },
  // pair (guard): a CONSTANT extra label column is an annotation, not an axis.
  {
    name: "an extra column with a single repeated value",
    spec: {
      data: [
        { channel: "Direct", region: "EU", share: 30 },
        { channel: "Organic", region: "EU", share: 45 },
        { channel: "Referral", region: "EU", share: 25 },
      ],
      x: "channel",
      series: ["share"],
    },
    type: "pie",
    rule: "parts-of-whole",
  },

  // 7 — dumbbell, named pair.
  {
    name: "before/after measures per category",
    spec: {
      data: [
        { region: "North", before: 42, after: 61 },
        { region: "South", before: 31, after: 46 },
      ],
      x: "region",
      series: ["before", "after"],
    },
    type: "dumbbell",
    rule: "before-after",
  },
  // 7b — dumbbell, consecutive years.
  {
    name: "consecutive year measures per category",
    spec: {
      data: [
        { region: "North", "2024": 42, "2025": 61 },
        { region: "South", "2024": 31, "2025": 46 },
      ],
      x: "region",
      series: ["2024", "2025"],
    },
    type: "dumbbell",
    rule: "before-after",
  },
  // 7c — dumbbell, explicit `y2` second measure.
  {
    name: "one declared measure plus an explicit y2",
    spec: {
      data: [
        { region: "North", salaryQ1: 42, salaryQ4: 61 },
        { region: "South", salaryQ1: 31, salaryQ4: 46 },
      ],
      x: "region",
      series: ["salaryQ1"],
      y2: "salaryQ4",
    },
    type: "dumbbell",
    rule: "before-after",
  },
  // pair: dumbbell vs bar — two measures that are NOT a before/after pair are
  // an ordinary grouped comparison.
  {
    name: "two unrelated measures per category",
    spec: {
      data: [
        { region: "North", online: 42, retail: 61 },
        { region: "South", online: 31, retail: 46 },
      ],
      x: "region",
      series: ["online", "retail"],
    },
    type: "bar",
    rule: "default",
  },

  // 8 — histogram: x names the measured column itself.
  {
    name: "a bare column of observations",
    spec: {
      data: [{ ms: 120 }, { ms: 340 }, { ms: 95 }, { ms: 610 }],
      x: "ms",
      series: ["ms"],
    },
    type: "histogram",
    rule: "distribution-histogram",
  },
  // 8b — histogram: declared record-level rows with an id column.
  {
    name: "record-level rows declared with kind: records",
    spec: {
      data: [
        { ticket: "T-1", minutes: 12 },
        { ticket: "T-2", minutes: 44 },
        { ticket: "T-3", minutes: 7 },
      ],
      x: "ticket",
      series: ["minutes"],
      kind: "records",
    },
    type: "histogram",
    rule: "distribution-histogram",
  },
  // 8c — strip: few enough records per group to draw every one.
  {
    name: "60 records over 3 cohorts",
    spec: { data: records(3, 20), x: "cohort", series: ["ms"], group: "cohort" },
    type: "strip",
    rule: "distribution-strip",
  },
  // 8d — box: too many records per group to draw individually.
  {
    name: "600 records over 2 cohorts",
    spec: { data: records(2, 300), x: "cohort", series: ["ms"], group: "cohort" },
    type: "box",
    rule: "distribution-box",
  },
  // pair: histogram vs scatter — a numeric x that IS the measure satisfies the
  // scatter rule too, and would draw a diagonal line.
  {
    name: "a numeric x that is a DIFFERENT column from the measure",
    spec: {
      data: [
        { spend: 10, conversions: 4 },
        { spend: 14, conversions: 6 },
      ],
      x: "spend",
      series: ["conversions"],
    },
    type: "scatter",
    rule: "numeric-xy",
  },

  // 9 — waterfall, declared.
  {
    name: "categorical deltas declared as steps",
    spec: {
      data: [
        { stage: "Opening", delta: 120 },
        { stage: "New business", delta: 40 },
        { stage: "Churn", delta: -25 },
      ],
      x: "stage",
      series: ["delta"],
      kind: "steps",
    },
    type: "waterfall",
    rule: "steps",
  },
  // 9b — waterfall, recognised from a checkpoint row label.
  // pair: waterfall vs diverging-bar — this fixture ALSO has a negative value,
  // which is the whole reason waterfall runs first (see the module docblock).
  {
    name: "signed deltas ending in a Net total row",
    spec: {
      data: [
        { stage: "Gross revenue", value: 480 },
        { stage: "Discounts", value: -60 },
        { stage: "Refunds", value: -25 },
        { stage: "Net total", value: 395 },
      ],
      x: "stage",
      series: ["value"],
    },
    type: "waterfall",
    rule: "steps",
  },

  // 10 — diverging-bar.
  // pair: the same signed shape with NO steps declaration and no checkpoint row.
  {
    name: "a signed measure with no step signal",
    spec: {
      data: [
        { region: "North", change: 12 },
        { region: "South", change: -8 },
        { region: "West", change: 4 },
      ],
      x: "region",
      series: ["change"],
    },
    type: "diverging-bar",
    rule: "signed",
  },

  // 11 — unit (waffle), editorial register only.
  {
    name: "four shares summing to 100 in the editorial register",
    spec: {
      data: [
        { group: "Cycled", share: 41 },
        { group: "Walked", share: 35 },
        { group: "Drove", share: 12 },
        { group: "Bus", share: 12 },
      ],
      x: "group",
      series: ["share"],
      emphasis: "editorial",
    },
    type: "unit",
    rule: "waffle",
  },
  // pair: unit vs pie — identical data without the editorial flag keeps the
  // pre-RM-038 answer.
  {
    name: "the same four shares with no emphasis",
    spec: {
      data: [
        { group: "Cycled", share: 41 },
        { group: "Walked", share: 35 },
        { group: "Drove", share: 12 },
        { group: "Bus", share: 12 },
      ],
      x: "group",
      series: ["share"],
    },
    type: "pie",
    rule: "parts-of-whole",
  },

  // 12 — pie (pre-RM-038 rule), a share table that does NOT sum to 100.
  {
    name: "five non-negative parts that do not sum to 100",
    spec: {
      data: [
        { channel: "Direct", visits: 32000 },
        { channel: "Organic", visits: 28000 },
        { channel: "Referral", visits: 19000 },
        { channel: "Social", visits: 14000 },
        { channel: "Email", visits: 7000 },
      ],
      x: "channel",
      series: ["visits"],
    },
    type: "pie",
    rule: "parts-of-whole",
  },

  // 13 — line (pre-RM-038 rule).
  {
    name: "a short dated series",
    spec: {
      data: [
        { date: "2024-01-01", revenue: 12000 },
        { date: "2024-02-01", revenue: 15200 },
      ],
      x: "date",
      series: ["revenue"],
    },
    type: "line",
    rule: "temporal",
  },

  // 14 — scatter (pre-RM-038 rule), with the explicit hint.
  {
    name: "an explicitly numeric x with one measure",
    spec: {
      data: [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ],
      x: "x",
      xType: "number",
      series: ["y"],
    },
    type: "scatter",
    rule: "numeric-xy",
  },

  // 15 — bar (pre-RM-038 rule), the two shapes the old tests pinned.
  {
    name: "multi-series categorical data",
    spec: {
      data: [
        { name: "A", value: 10, other: 5 },
        { name: "B", value: 20, other: 8 },
      ],
      x: "name",
      series: ["value", "other"],
    },
    type: "bar",
    rule: "default",
  },
  {
    name: "ten single-series categories",
    spec: {
      data: Array.from({ length: 10 }, (_, i) => ({ name: `n${i}`, v: i + 1 })),
      x: "name",
      series: ["v"],
    },
    type: "bar",
    rule: "default",
  },
];

describe("explainChartType — the RM-038 fixture table", () => {
  it("covers every rule the module documents", () => {
    // Every `pick(…)` rule id in the source has at least one fixture. A new
    // rule added without a fixture fails here rather than silently going
    // unexercised.
    const source = readFileSync(join(HERE, "infer-chart-type.ts"), "utf8");
    const declared = new Set(
      [...source.matchAll(/pick\(\s*"[a-z-]+",\s*"([a-z-]+)"/g)].map((m) => m[1] as string),
    );
    const covered = new Set(FIXTURES.map((f) => f.rule));
    expect([...declared].filter((r) => !covered.has(r)).sort()).toEqual([]);
  });

  it("has at least 25 fixtures", () => {
    // The acceptance criterion is a table of 25 shapes; a later edit that
    // thinned it out should fail rather than quietly shrink the coverage.
    expect(FIXTURES.length).toBeGreaterThanOrEqual(25);
  });

  for (const fixture of FIXTURES) {
    it(`${fixture.name} → ${fixture.type} (${fixture.rule})`, () => {
      const explained = explainChartType(fixture.spec);
      // Both columns, on purpose: asserting only the TYPE would let a row pass
      // through a different rule that happens to reach the same answer, which
      // is exactly how an ordering regression hides.
      expect({ type: explained.type, rule: explained.rule }).toEqual({
        type: fixture.type,
        rule: fixture.rule,
      });
      expect(explained.reason.length).toBeGreaterThan(0);
      expect(explained.reason).toContain(fixture.type);
      // `inferChartType` is the same walk with the prose dropped.
      expect(inferChartType(fixture.spec)).toBe(explained.type);
    });
  }
});

describe("the ChartType union and its runtime companion", () => {
  /**
   * The union's members, parsed out of `chart-spec.ts`.
   *
   * A type cannot be enumerated at runtime, so the only way to prove
   * `CHART_TYPES` really mirrors `ChartType` is to read the declaration.
   * `satisfies readonly ChartType[]` already stops an EXTRA member; this
   * catches the other direction — a union member nobody added to the list.
   */
  function chartTypeUnionMembers(): string[] {
    const source = readFileSync(join(HERE, "chart-spec.ts"), "utf8");
    const decl = /export type ChartType =([\s\S]*?);/.exec(source);
    expect(decl).not.toBeNull();
    return [...(decl?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1] as string);
  }

  it("CHART_TYPES lists exactly the members of the union", () => {
    expect([...CHART_TYPES].sort()).toEqual(chartTypeUnionMembers().sort());
  });

  it("carries the seven pre-RM-038 members plus the thirteen new families", () => {
    expect(CHART_TYPES).toHaveLength(20);
    for (const core of ["line", "area", "bar", "pie", "scatter", "radar", "funnel"]) {
      expect(CHART_TYPES).toContain(core);
    }
  });

  it("never infers a type that is not in the union", () => {
    for (const fixture of FIXTURES) {
      expect(isChartType(inferChartType(fixture.spec))).toBe(true);
    }
  });

  it("does not admit the four explicit-container-only shapes", () => {
    // Documented in the `ChartType` docblock: a flat spec cannot express them
    // unambiguously, so `AutoChart` falls back rather than guessing.
    for (const name of ["network", "parallel", "tree", "sankey"]) {
      expect(isChartType(name)).toBe(false);
    }
  });

  it("is listed in full in the AutoChartProps `spec` TSDoc, which is what `brand-ui docs AutoChart` prints", () => {
    // The acceptance criterion is that `brand-ui docs AutoChart` shows the full
    // union. The CLI prints own-declared props with their TSDoc and does not
    // expand type aliases, so the list lives in that comment — and this test is
    // what stops it drifting from the union it describes.
    const source = readFileSync(join(HERE, "auto-chart.tsx"), "utf8");
    const block = /The full `ChartType` union AutoChart renders is:([\s\S]*?)\.\s*\n/.exec(source);
    expect(block).not.toBeNull();
    const documented = [...(block?.[1] ?? "").matchAll(/`([a-z-]+)`/g)].map((m) => m[1] as string);
    expect(documented.sort()).toEqual([...CHART_TYPES].sort());
  });
});
