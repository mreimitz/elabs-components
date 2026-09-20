import { describe, expect, it } from "vitest";
import { computeWaterfallRows, type WaterfallDatum } from "./waterfall-chart";
import {
  applyEndpoints,
  computeWaterfallZoomDomain,
  insertSubtotals,
  resolveWaterfallData,
  roundDownNice,
  sortWaterfallSteps,
} from "./waterfall-steps";

const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

describe("resolveWaterfallData", () => {
  it("passes differences data through untouched (default)", () => {
    expect(resolveWaterfallData(grossToNet)).toEqual(grossToNet);
    expect(resolveWaterfallData(grossToNet, "differences")).toEqual(grossToNet);
  });

  it("converts a runningTotals fixture to the same differences the twin fixture uses", () => {
    // Same bridge as `grossToNet`, but every row states the running total
    // reached at that point instead of the delta.
    const runningTotals: WaterfallDatum[] = [
      { kind: "total", label: "Gross", value: 1000 },
      { label: "Refunds", value: 900 },
      { label: "COGS", value: 600 },
      { label: "Ops", value: 400 },
      { kind: "total", label: "Net", value: 400 },
    ];
    const resolved = resolveWaterfallData(runningTotals, "runningTotals");
    expect(resolved.map((d) => d.value)).toEqual(grossToNet.map((d) => d.value));
    // Renders the same bars: computeWaterfallRows on both give equal geometry.
    expect(computeWaterfallRows(resolved)).toEqual(computeWaterfallRows(grossToNet));
  });

  it("treats a step's delta as running total minus 0 before the first row", () => {
    const runningTotals: WaterfallDatum[] = [{ label: "Opening", value: 50 }];
    expect(resolveWaterfallData(runningTotals, "runningTotals")).toEqual([
      { label: "Opening", value: 50 },
    ]);
  });
});

describe("insertSubtotals", () => {
  const quarters: WaterfallDatum[] = [
    { kind: "total", label: "Opening", value: 1000 },
    { label: "Jan", quarter: "Q1", value: 50 },
    { label: "Feb", quarter: "Q1", value: 30 },
    { label: "Mar", quarter: "Q1", value: -10 },
    { label: "Apr", quarter: "Q2", value: 20 },
    { label: "May", quarter: "Q2", value: -5 },
    { kind: "total", label: "Closing", value: 1085 },
  ];
  const groups = quarters.map((d) => (typeof d.quarter === "string" ? d.quarter : undefined));

  it("inserts a subtotal after each group with the running total at that point", () => {
    const withSubtotals = insertSubtotals(quarters, groups);
    const labels = withSubtotals.map((d) => d.label);
    expect(labels).toEqual([
      "Opening",
      "Jan",
      "Feb",
      "Mar",
      "Q1 subtotal",
      "Apr",
      "May",
      "Q2 subtotal",
      "Closing",
    ]);
    const q1 = withSubtotals.find((d) => d.label === "Q1 subtotal");
    const q2 = withSubtotals.find((d) => d.label === "Q2 subtotal");
    expect(q1).toEqual({ kind: "subtotal", label: "Q1 subtotal", value: 1070 });
    expect(q2).toEqual({ kind: "subtotal", label: "Q2 subtotal", value: 1085 });
  });

  it("applies a custom subtotalLabel template", () => {
    const withSubtotals = insertSubtotals(quarters, groups, "{group} total");
    expect(withSubtotals.map((d) => d.label)).toContain("Q1 total");
  });

  it("never inserts a subtotal after a row outside any group", () => {
    const withSubtotals = insertSubtotals(quarters, groups);
    expect(withSubtotals[0]?.label).toBe("Opening");
    expect(withSubtotals[1]?.label).toBe("Jan");
  });

  it("the resulting checkpoints reproduce byte-identical rows via computeWaterfallRows", () => {
    const withSubtotals = insertSubtotals(quarters, groups);
    const rows = computeWaterfallRows(withSubtotals);
    const q1Row = rows.find((r) => r.label === "Q1 subtotal");
    expect(q1Row?.kind).toBe("subtotal");
    expect(q1Row?.before).toBe(0);
    expect(q1Row?.after).toBe(1070);
    // The row right after a subtotal floats from the subtotal's own after.
    const aprRow = rows.find((r) => r.label === "Apr");
    expect(aprRow?.before).toBe(1070);
  });
});

describe("sortWaterfallSteps", () => {
  const mixed: WaterfallDatum[] = [
    { kind: "total", label: "Start", value: 100 },
    { label: "A", value: -5 },
    { label: "B", value: 10 },
    { label: "C", value: -3 },
    { label: "D", value: 7 },
    { kind: "total", label: "End", value: 109 },
  ];

  it("data (default) keeps spreadsheet order", () => {
    expect(sortWaterfallSteps(mixed).map((d) => d.label)).toEqual(mixed.map((d) => d.label));
    expect(sortWaterfallSteps(mixed, "data").map((d) => d.label)).toEqual(
      mixed.map((d) => d.label),
    );
  });

  it("increasesFirst stable-sorts increases before decreases within the group", () => {
    expect(sortWaterfallSteps(mixed, "increasesFirst").map((d) => d.label)).toEqual([
      "Start",
      "B",
      "D",
      "A",
      "C",
      "End",
    ]);
  });

  it("decreasesFirst stable-sorts decreases before increases within the group", () => {
    expect(sortWaterfallSteps(mixed, "decreasesFirst").map((d) => d.label)).toEqual([
      "Start",
      "A",
      "C",
      "B",
      "D",
      "End",
    ]);
  });

  it("never moves a checkpoint row — it bounds the groups sort runs within", () => {
    const twoGroups: WaterfallDatum[] = [
      { label: "A", value: -1 },
      { kind: "subtotal", label: "Mid", value: -1 },
      { label: "B", value: 3 },
      { label: "C", value: -2 },
    ];
    const sorted = sortWaterfallSteps(twoGroups, "increasesFirst");
    expect(sorted.map((d) => d.label)).toEqual(["A", "Mid", "B", "C"]);
  });
});

describe("applyEndpoints", () => {
  it("relabels the first/last row without touching the others", () => {
    const out = applyEndpoints(
      grossToNet,
      { label: "Starting balance" },
      { label: "Ending balance" },
    );
    expect(out[0]?.label).toBe("Starting balance");
    expect(out[out.length - 1]?.label).toBe("Ending balance");
    expect(out.slice(1, -1).map((d) => d.label)).toEqual(["Refunds", "COGS", "Ops"]);
  });

  it("drops the endpoint row entirely when show is false", () => {
    const out = applyEndpoints(grossToNet, { show: false }, { show: false });
    expect(out).toHaveLength(grossToNet.length - 2);
    expect(out[0]?.label).toBe("Refunds");
    expect(out[out.length - 1]?.label).toBe("Ops");
  });

  it("is a no-op when start/end are both unset", () => {
    expect(applyEndpoints(grossToNet)).toEqual(grossToNet);
  });
});

describe("roundDownNice", () => {
  it("rounds down to one order of magnitude finer than the leading digit", () => {
    expect(roundDownNice(996_420)).toBe(990_000);
    expect(roundDownNice(347)).toBe(340);
    expect(roundDownNice(7)).toBe(7);
  });

  it("never rounds below 0", () => {
    expect(roundDownNice(0)).toBe(0);
    expect(roundDownNice(-50)).toBe(0);
  });
});

describe("computeWaterfallZoomDomain", () => {
  it("does not zoom an ordinary small-total fixture", () => {
    const rows = computeWaterfallRows(grossToNet);
    const zoom = computeWaterfallZoomDomain(rows);
    expect(zoom.zoomed).toBe(false);
  });

  it("zooms a large-total fixture and drops the zero baseline", () => {
    // Gross/net sit around 1,000,000; the steps swing by only a few thousand
    // around it — exactly the shape `min(totals) − 0 > max − min` targets.
    const large: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1_000_000 },
      { label: "New", value: 4_500 },
      { label: "Upsell", value: 3_000 },
      { label: "Churn", value: -3_800 },
      { kind: "total", label: "Closing", value: 1_003_700 },
    ];
    const rows = computeWaterfallRows(large);
    const zoom = computeWaterfallZoomDomain(rows);
    expect(zoom.zoomed).toBe(true);
    const [lo, hi] = zoom.domain;
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
    // Every "total"/"subtotal" row's `base` is always 0 (`computeWaterfallRows`
    // draws a checkpoint from zero) — which now sits BELOW the zoomed domain's
    // own floor, so a checkpoint can no longer draw as a proper zero-based
    // bar inside the visible plot. That is exactly why it switches to a point
    // instead (see `waterfall-chart.tsx`).
    for (const row of rows.filter((r) => r.kind !== "step")) {
      expect(row.base).toBeLessThan(lo);
    }
    // Both ends keep room for an outside label: no step ends on the plot edge.
    const steps = rows.filter((r) => r.kind === "step");
    expect(hi).toBeGreaterThan(Math.max(...steps.map((r) => r.top)));
    expect(lo).toBeLessThan(Math.min(...steps.map((r) => r.base)));
  });

  it("keeps every difference bar's length proportional to its own value under the zoomed domain", () => {
    const large: WaterfallDatum[] = [
      { kind: "total", label: "Opening", value: 1_000_000 },
      { label: "New", value: 4_500 },
      { label: "Upsell", value: 3_000 },
      { label: "Churn", value: -3_800 },
      { kind: "total", label: "Closing", value: 1_003_700 },
    ];
    const rows = computeWaterfallRows(large);
    const zoom = computeWaterfallZoomDomain(rows);
    expect(zoom.zoomed).toBe(true);
    // A linear scale's slope (px per data unit) is constant across its whole
    // domain, zero-based or not — so a step's rendered length (px) stays
    // exactly proportional to its own delta under ANY linear domain shift.
    const pxPerUnit = 640 / (zoom.domain[1] - zoom.domain[0]);
    const stepRows = rows.filter((r) => r.kind === "step");
    for (const row of stepRows) {
      const lengthPx = (row.top - row.base) * pxPerUnit;
      const expectedLengthPx = Math.abs(row.value) * pxPerUnit;
      expect(lengthPx).toBeCloseTo(expectedLengthPx, 6);
    }
    // Quoted ratio check: New (4,500) is 1.5× Upsell's own delta (3,000) in
    // rendered length — exactly its value ratio, independent of the domain's
    // own zero point.
    const newRow = stepRows.find((r) => r.label === "New");
    const upsellRow = stepRows.find((r) => r.label === "Upsell");
    const newLength = (newRow!.top - newRow!.base) * pxPerUnit;
    const upsellLength = (upsellRow!.top - upsellRow!.base) * pxPerUnit;
    expect(newLength / upsellLength).toBeCloseTo(4_500 / 3_000, 6);
  });

  it("does not zoom when there are no checkpoint rows to compare against", () => {
    const stepsOnly: WaterfallDatum[] = [
      { label: "A", value: 10 },
      { label: "B", value: -5 },
    ];
    const rows = computeWaterfallRows(stepsOnly);
    expect(computeWaterfallZoomDomain(rows).zoomed).toBe(false);
  });
});
