import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (width > 0 && height > 0) is satisfied.
// Real render + a11y are covered by the Storybook interaction tests.
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import {
  buildDumbbellRows,
  computeDumbbellDomain,
  deriveDumbbellMargin,
  DumbbellChart,
  sortDumbbellRows,
  spaceSlopeLabels,
  type DumbbellRow,
} from "./dumbbell-chart";
import { seriesPatterns, stubHighDecoration } from "./high-decoration-fixture";

afterEach(cleanup);

/** Deterministic stand-in for canvas `measureText`: 7px per character. */
const measure7 = (text: string) => text.length * 7;

const onboardingData = [
  { step: "Sign up", before: 100, after: 100 },
  { step: "Verify email", before: 82, after: 94 },
  { step: "Add payment", before: 41, after: 68 },
  { step: "First project", before: 19, after: 51 },
];

describe("buildDumbbellRows", () => {
  it("shapes rows with a delta and preserves the source datum", () => {
    const rows = buildDumbbellRows(onboardingData, "step", "before", "after");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toMatchObject({ category: "Verify email", start: 82, end: 94, delta: 12 });
    expect(rows[1]?.datum).toBe(onboardingData[1]);
  });

  it("drops a row whose start/end value isn't a finite number", () => {
    const rows = buildDumbbellRows(
      [
        { step: "OK", before: 1, after: 2 },
        { step: "Bad", before: "n/a", after: 2 },
      ],
      "step",
      "before",
      "after",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe("OK");
  });

  it("collects extraKeys onto each row, skipping non-finite entries", () => {
    const rows = buildDumbbellRows(
      [{ step: "A", before: 1, after: 2, competitorX: 5, competitorY: "n/a" }],
      "step",
      "before",
      "after",
      ["competitorX", "competitorY"],
    );
    expect(rows[0]?.extra).toEqual([{ key: "competitorX", value: 5 }]);
  });
});

describe("sortDumbbellRows", () => {
  const rows = buildDumbbellRows(onboardingData, "step", "before", "after");

  it('"none" returns the rows unchanged (data order)', () => {
    expect(sortDumbbellRows(rows, "none")).toBe(rows);
  });

  // onboardingData's deltas (0, 12, 27, 32) are already ascending, so an
  // ascending-vs-descending sort bug can't show up against them (#244).
  // This fixture is tie-free, deliberately NOT already sorted either way,
  // and includes a negative delta (a decrease) whose |magnitude| beats every
  // increase — a magnitude sort and a signed-value-descending sort put it in
  // different places (first vs. last), so this fixture also catches a
  // "descending by signed value" regression, not just "ascending".
  const deltaData = [
    { step: "Add payment", before: 41, after: 68 }, // delta +27
    { step: "Sign up", before: 100, after: 100 }, // delta 0
    { step: "First project", before: 19, after: 51 }, // delta +32
    { step: "Verify email", before: 82, after: 94 }, // delta +12
    { step: "Reactivate trial", before: 90, after: 50 }, // delta -40 (|40|, the biggest mover)
  ];
  const deltaRows = buildDumbbellRows(deltaData, "step", "before", "after");

  it('sorts descending by "delta" (biggest |delta| first, sign ignored)', () => {
    const sorted = sortDumbbellRows(deltaRows, "delta");
    expect(sorted.map((r) => r.category)).toEqual([
      "Reactivate trial", // |−40| = 40 — the biggest mover, despite being a decrease
      "First project", // 32
      "Add payment", // 27
      "Verify email", // 12
      "Sign up", // 0
    ]);
  });

  it("ranks a decrease above a smaller increase — magnitude, not signed value", () => {
    // If sortDumbbellRows sorted by SIGNED value descending instead of by
    // |delta|, "Reactivate trial" (delta -40, the smallest signed value)
    // would sort LAST, not first. This test fails under that interpretation
    // even though the direction (ascending vs. descending) is correct.
    const sorted = sortDumbbellRows(deltaRows, "delta");
    expect(sorted[0]?.category).toBe("Reactivate trial");
    expect(sorted.at(-1)?.category).toBe("Sign up");
  });

  it('sorts ascending by "start"', () => {
    const sorted = sortDumbbellRows(rows, "start");
    expect(sorted.map((r) => r.start)).toEqual([19, 41, 82, 100]);
  });
});

describe("computeDumbbellDomain", () => {
  it("returns [0, 1] for an empty row set", () => {
    expect(computeDumbbellDomain([])).toEqual([0, 1]);
  });

  it("pads the min/max across start, end and extra values", () => {
    const rows: DumbbellRow[] = [
      { index: 0, datum: {}, category: "A", start: 10, end: 20, delta: 10, extra: [] },
      {
        index: 1,
        datum: {},
        category: "B",
        start: 5,
        end: 15,
        delta: 10,
        extra: [{ key: "x", value: 30 }],
      },
    ];
    const [min, max] = computeDumbbellDomain(rows);
    // range is [5, 30]; padding is 8% of 25 = 2
    expect(min).toBeCloseTo(3);
    expect(max).toBeCloseTo(32);
  });

  it("widens a degenerate (all-equal) domain instead of returning a zero-width range", () => {
    const rows: DumbbellRow[] = [
      { index: 0, datum: {}, category: "A", start: 10, end: 10, delta: 0, extra: [] },
    ];
    const [min, max] = computeDumbbellDomain(rows);
    expect(min).toBeLessThan(10);
    expect(max).toBeGreaterThan(10);
  });
});

describe("spaceSlopeLabels", () => {
  it("returns an empty array for no values", () => {
    expect(spaceSlopeLabels([], 16, [0, 100])).toEqual([]);
  });

  it("leaves already-separated values untouched", () => {
    expect(spaceSlopeLabels([0, 50, 100], 16, [0, 100])).toEqual([0, 50, 100]);
  });

  it("separates values closer than minGap while preserving input order", () => {
    const out = spaceSlopeLabels([10, 12, 14], 16, [0, 200]);
    expect(out).toHaveLength(3);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect((sorted[i] as number) - (sorted[i - 1] as number)).toBeGreaterThanOrEqual(16 - 1e-9);
    }
    // Order of the OUTPUT array matches the order of the INPUT array (by original index).
    expect(out[0]).toBeLessThanOrEqual(out[1] as number);
    expect(out[1]).toBeLessThanOrEqual(out[2] as number);
  });

  it("clamps the spaced-out labels back inside extent", () => {
    const out = spaceSlopeLabels([95, 98, 100], 16, [0, 100]);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  // #281 — 8 labels x 14px demand 98px of span in a 64px extent, infeasible by
  // 34px. Before the feasibility guard the unclamped final pass produced a
  // strict `lo + i * minGap` progression that overran `hi` by exactly that
  // amount; every element must stay inside the extent regardless.
  it("stays inside extent when minGap cannot be honoured for every label", () => {
    const out = spaceSlopeLabels([21, 24, 27, 30, 33, 36, 39, 42], 14, [0, 64]);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(64);
    }
  });

  it("preserves input order and sorted rank in the infeasible branch", () => {
    // Input already descending; output must still read ascending by rank
    // (the LOWEST value gets the LOWEST position) while matching input order.
    const out = spaceSlopeLabels([42, 39, 36, 33, 30, 27, 24, 21], 14, [0, 64]);
    const sorted = [...out].sort((a, b) => a - b);
    expect(out).toEqual([...sorted].reverse());
  });
});

// #240 — DumbbellChart budgeted space for text it never measured: every
// margin was a hard-coded constant, so the longest label in a chart could
// clip past the SVG edge. `deriveDumbbellMargin` replaces the constant with a
// measured requirement, floored at the old constant (short-label charts are
// pixel-unchanged) and capped at `MAX_MARGIN_FRACTION` of the container width
// (one pathological label can't squeeze the plot to nothing).
describe("deriveDumbbellMargin", () => {
  const floor = { top: 24, right: 120, bottom: 24, left: 120 };
  const shortRows: DumbbellRow[] = [
    { index: 0, datum: {}, category: "Email", start: 9800, end: 12100, delta: 2300, extra: [] },
  ];
  const identity = (n: number) => String(n);

  it("floors at the constant when every label already fits (short-label charts are pixel-unchanged)", () => {
    const margin = deriveDumbbellMargin({
      rows: shortRows,
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 640,
      measure: measure7,
      formatValue: identity,
    });
    expect(margin.left).toBe(floor.left);
    expect(margin.right).toBe(floor.right);
  });

  it("grows margin.left/right past the floor for a slope chart's longest labels", () => {
    const longRows: DumbbellRow[] = [
      {
        index: 0,
        datum: {},
        category: "Organic search",
        start: 42000,
        end: 51500,
        delta: 9500,
        extra: [],
      },
    ];
    const margin = deriveDumbbellMargin({
      rows: longRows,
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 900,
      measure: measure7,
      formatValue: identity,
    });
    // "Organic search 42000" = 20 chars * 7px + 10px gutter = 150, over the 120 floor.
    expect(margin.left).toBeGreaterThan(floor.left);
    expect(margin.left).toBe(20 * 7 + 10);
  });

  it("bothEndsLabeled grows margin.right to hold the end label's category name too", () => {
    const longRows: DumbbellRow[] = [
      {
        index: 0,
        datum: {},
        category: "Organic search",
        start: 42000,
        end: 51500,
        delta: 9500,
        extra: [],
      },
    ];
    const withoutFlag = deriveDumbbellMargin({
      rows: longRows,
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 900,
      measure: measure7,
      formatValue: identity,
    });
    const withFlag = deriveDumbbellMargin({
      rows: longRows,
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 900,
      measure: measure7,
      formatValue: identity,
      bothEndsLabeled: true,
    });
    expect(withFlag.right).toBeGreaterThan(withoutFlag.right);
  });

  it("valueLabelFormat sizes the margin from its own output, not formatValue's", () => {
    const row: DumbbellRow = {
      index: 0,
      datum: {},
      category: "AB",
      start: 92,
      end: 95,
      delta: 3,
      extra: [],
    };
    const withoutFormat = deriveDumbbellMargin({
      rows: [row],
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 900,
      measure: measure7,
      formatValue: identity,
    });
    const longSuffix = "0".repeat(30);
    const withFormat = deriveDumbbellMargin({
      rows: [row],
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 900,
      measure: measure7,
      formatValue: identity,
      valueLabelFormat: (value) => `${value}.${longSuffix}`,
    });
    // Both labels are short enough to floor at the constant with the default
    // formatter; the custom one is long enough to grow past it — proving the
    // margin measured `valueLabelFormat`'s OWN output, not `formatValue`'s.
    expect(withoutFormat.left).toBe(floor.left);
    expect(withFormat.left).toBeGreaterThan(floor.left);
    expect(withFormat.left).toBe(`AB 92.${longSuffix}`.length * 7 + 10);
  });

  it("caps the derived margin at MAX_MARGIN_FRACTION of the container width, never below the floor", () => {
    const pathologicalRows: DumbbellRow[] = [
      {
        index: 0,
        datum: {},
        category: "A".repeat(200),
        start: 1,
        end: 2,
        delta: 1,
        extra: [],
      },
    ];
    const width = 400;
    const margin = deriveDumbbellMargin({
      rows: pathologicalRows,
      variant: "slope",
      orientation: "horizontal",
      floor,
      width,
      measure: measure7,
      formatValue: identity,
    });
    expect(margin.left).toBeLessThanOrEqual(width * 0.4);
    expect(margin.left).toBeGreaterThanOrEqual(floor.left);
  });

  it("never shrinks the cap below the floor for a very narrow container", () => {
    const margin = deriveDumbbellMargin({
      rows: [
        { index: 0, datum: {}, category: "A".repeat(50), start: 1, end: 2, delta: 1, extra: [] },
      ],
      variant: "slope",
      orientation: "horizontal",
      floor,
      width: 50, // 40% of 50 = 20px, well under the 120px floor
      measure: measure7,
      formatValue: identity,
    });
    expect(margin.left).toBe(floor.left);
  });

  it("grows only margin.left for orientation='horizontal' dumbbell (category label)", () => {
    const longRows: DumbbellRow[] = [
      {
        index: 0,
        datum: {},
        category: "Add payment method",
        start: 41,
        end: 68,
        delta: 27,
        extra: [],
      },
    ];
    const margin = deriveDumbbellMargin({
      rows: longRows,
      variant: "dumbbell",
      orientation: "horizontal",
      floor,
      width: 640,
      measure: measure7,
      formatValue: identity,
    });
    expect(margin.left).toBeGreaterThan(floor.left);
    expect(margin.right).toBe(floor.right);
  });

  it("leaves the margin at the floor for orientation='vertical' dumbbell — its fallback is truncation, not margin growth", () => {
    const longRows: DumbbellRow[] = [
      {
        index: 0,
        datum: {},
        category: "Add payment method",
        start: 41,
        end: 68,
        delta: 27,
        extra: [],
      },
    ];
    const margin = deriveDumbbellMargin({
      rows: longRows,
      variant: "dumbbell",
      orientation: "vertical",
      floor: { top: 24, right: 32, bottom: 40, left: 40 },
      width: 640,
      measure: measure7,
      formatValue: identity,
    });
    expect(margin).toEqual({ top: 24, right: 32, bottom: 40, left: 40 });
  });
});

describe("DumbbellChart", () => {
  it("is exported as a forwardRef component", () => {
    expect(typeof DumbbellChart).toBe("object");
    expect(DumbbellChart.displayName).toBe("DumbbellChart");
  });

  it("mounts without throwing and attaches to the document", () => {
    const { container } = render(
      <DumbbellChart data={onboardingData} category="step" startKey="before" endKey="after" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        className="my-dumbbell"
      />,
    );
    expect(container.firstChild).toHaveClass("my-dumbbell");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        ref={(el) => {
          capturedRef = el;
        }}
      />,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        accessibleLabel="Onboarding funnel before and after"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Onboarding funnel before and after");
    expect(root.getAttribute("tabindex")).toBe("0");
  });

  it("F12: draws `round(delta / unit)` beads per row and shows the unit caption", () => {
    // Verify Email: delta = 12 -> round(12/4) = 3 beads.
    const { container, getByText } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        beads={{ unit: 4 }}
      />,
    );
    expect(getByText("1 dot = 4")).toBeInTheDocument();
    const rows = container.querySelectorAll('[data-slot="dumbbell-chart-track"]');
    expect(rows.length).toBe(4);
    // The "Verify email" row (index 1) draws a 3-unit UnitStack.
    const unitStacks = container.querySelectorAll('[data-slot="unit-stack"]');
    // "Sign up" has delta 0 -> no stack rendered; the other 3 rows each draw one.
    expect(unitStacks.length).toBe(3);
  });

  it("respects a custom beads.label caption override", () => {
    const { getByText, queryByText } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        beads={{ unit: 4, label: "1 dot = 4 pts" }}
      />,
    );
    expect(getByText("1 dot = 4 pts")).toBeInTheDocument();
    expect(queryByText("1 dot = 4")).not.toBeInTheDocument();
  });

  it("draws hollow start / filled end markers by default (F12 before/after read)", () => {
    const { container } = render(
      <DumbbellChart
        data={[{ step: "A", before: 10, after: 20 }]}
        category="step"
        startKey="before"
        endKey="after"
      />,
    );
    const start = container.querySelector('[data-slot="dumbbell-chart-marker-start"]');
    const end = container.querySelector('[data-slot="dumbbell-chart-marker-end"]');
    expect(start?.getAttribute("fill")).toBe("var(--chart-background)");
    expect(end?.getAttribute("fill")).not.toBe("var(--chart-background)");
  });

  it('honours an explicit markers={{ start: "filled", end: "hollow" }} override', () => {
    const { container } = render(
      <DumbbellChart
        data={[{ step: "A", before: 10, after: 20 }]}
        category="step"
        startKey="before"
        endKey="after"
        markers={{ start: "filled", end: "hollow" }}
      />,
    );
    const start = container.querySelector('[data-slot="dumbbell-chart-marker-start"]');
    const end = container.querySelector('[data-slot="dumbbell-chart-marker-end"]');
    expect(start?.getAttribute("fill")).not.toBe("var(--chart-background)");
    expect(end?.getAttribute("fill")).toBe("var(--chart-background)");
  });

  it("rowColor overrides a row's colour; unset rows keep the resolved palette", () => {
    const data = [
      { step: "A", before: 10, after: 20 },
      { step: "B", before: 30, after: 40 },
    ];
    const { container } = render(
      <DumbbellChart
        category="step"
        data={data}
        endKey="after"
        palette="mono"
        rowColor={(row) => (row.category === "B" ? "var(--destructive)" : undefined)}
        startKey="before"
      />,
    );
    const endMarkers = container.querySelectorAll('[data-slot="dumbbell-chart-marker-end"]');
    expect(endMarkers).toHaveLength(2);
    expect(endMarkers[0]?.getAttribute("fill")).not.toBe("var(--destructive)");
    expect(endMarkers[1]?.getAttribute("fill")).toBe("var(--destructive)");
  });

  it("default rendering is unaffected when rowColor is not passed", () => {
    const { container: withCallback } = render(
      <DumbbellChart
        category="step"
        data={onboardingData}
        endKey="after"
        rowColor={() => undefined}
        startKey="before"
      />,
    );
    const { container: withoutCallback } = render(
      <DumbbellChart category="step" data={onboardingData} endKey="after" startKey="before" />,
    );
    const fillsOf = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('[data-slot="dumbbell-chart-marker-end"]')).map((m) =>
        m.getAttribute("fill"),
      );
    expect(fillsOf(withCallback)).toEqual(fillsOf(withoutCallback));
  });

  it("F6: renders a signed delta label when showDelta is set", () => {
    const { getByText } = render(
      <DumbbellChart
        data={[{ step: "Revenue", before: 100, after: 82 }]}
        category="step"
        startKey="before"
        endKey="after"
        showDelta
      />,
    );
    expect(getByText(/-18/)).toBeInTheDocument();
  });

  it("deltaLabelFormat overrides the default sign+formatValue delta text", () => {
    const { getByText, queryByText } = render(
      <DumbbellChart
        data={[{ step: "Revenue", before: 100, after: 82 }]}
        category="step"
        startKey="before"
        endKey="after"
        showDelta
        deltaLabelFormat={(delta) => `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}pp`}
      />,
    );
    expect(getByText("−18.0pp")).toBeInTheDocument();
    expect(queryByText(/^-18/)).not.toBeInTheDocument();
  });

  it("referenceLine draws one labelled vertical line at the given value", () => {
    const { container, getByText } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        referenceLine={{ value: 50, label: "Target 50" }}
      />,
    );
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-reference-line"]')).toHaveLength(
      1,
    );
    expect(getByText("Target 50")).toBeInTheDocument();
  });

  it("referenceLine flips its label anchor near the domain's edges instead of overflowing", () => {
    // jsdom's canvas-less text measurer falls back to a fixed per-char
    // estimate (see `use-text-measurer.ts`), so a long label at a value near
    // the domain's max is guaranteed to trip the "would overflow the right
    // edge" branch.
    const { container } = render(
      <DumbbellChart
        data={[{ step: "A", before: 0, after: 100 }]}
        category="step"
        startKey="before"
        endKey="after"
        referenceLine={{ value: 100, label: "A very long benchmark label indeed" }}
      />,
    );
    const label = container.querySelector('[data-slot="dumbbell-chart-reference-line"] text');
    expect(label).not.toBeNull();
    expect(label?.getAttribute("text-anchor")).toBe("end");
  });

  it('referenceLine/showValueAxis are no-ops for variant="slope" and orientation="vertical"', () => {
    const { container } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        orientation="vertical"
        referenceLine={{ value: 50, label: "Target 50" }}
        showValueAxis
      />,
    );
    expect(container.querySelector('[data-slot="dumbbell-chart-reference-line"]')).toBeNull();
    expect(container.querySelector('[data-slot="dumbbell-chart-value-axis"]')).toBeNull();
  });

  it("showValueAxis renders tick marks along the value scale", () => {
    const { container } = render(
      <DumbbellChart
        data={onboardingData}
        category="step"
        startKey="before"
        endKey="after"
        showValueAxis
      />,
    );
    const axis = container.querySelector('[data-slot="dumbbell-chart-value-axis"]');
    expect(axis).not.toBeNull();
    expect(axis?.querySelectorAll("line").length).toBeGreaterThan(0);
  });

  it("default rendering is unaffected when referenceLine/showValueAxis are unset", () => {
    const { container } = render(
      <DumbbellChart data={onboardingData} category="step" startKey="before" endKey="after" />,
    );
    expect(container.querySelector('[data-slot="dumbbell-chart-reference-line"]')).toBeNull();
    expect(container.querySelector('[data-slot="dumbbell-chart-value-axis"]')).toBeNull();
  });
});

describe('DumbbellChart — variant="slope"', () => {
  const rows8 = Array.from({ length: 8 }, (_, i) => ({
    step: `Category ${i}`,
    before: i * 10,
    after: i * 10 + 5,
  }));
  const rows9 = [...rows8, { step: "Category 8", before: 90, after: 95 }];

  // `palette="mono"` sidesteps the UNRELATED "> 6 categorical series" warning
  // from `resolvePalette` (9 rows would otherwise also trip that cap) — these
  // two tests are about the slope-row-count warning specifically.

  it("renders without warning at exactly the 8-row soft cap", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <DumbbellChart
          data={rows8}
          category="step"
          startKey="before"
          endKey="after"
          variant="slope"
          palette="mono"
        />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("refuses (dev-warns once) past the 8-row soft cap but still renders every row", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container, rerender } = render(
        <DumbbellChart
          data={rows9}
          category="step"
          startKey="before"
          endKey="after"
          variant="slope"
          palette="mono"
        />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/variant="slope".*9 rows/);
      // Legible fallback: it still renders every row's markers.
      const starts = container.querySelectorAll('[data-slot="dumbbell-chart-marker-start"]');
      expect(starts.length).toBe(9);

      rerender(
        <DumbbellChart
          data={rows9}
          category="step"
          startKey="before"
          endKey="after"
          variant="slope"
          palette="mono"
        />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  // #240 — the slope labels carried no `data-slot`, unlike the category/delta
  // labels, so nothing had a stable selector to lock the clipping/gap
  // regressions against.
  it("gives the start/end slope labels a data-slot (required for the #240 geometry locks)", () => {
    const { container } = render(
      <DumbbellChart
        data={[{ channel: "Organic search", lastYear: 42000, thisYear: 51500 }]}
        category="channel"
        startKey="lastYear"
        endKey="thisYear"
        variant="slope"
      />,
    );
    expect(
      container.querySelector('[data-slot="dumbbell-chart-slope-label-start"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="dumbbell-chart-slope-label-end"]'),
    ).toBeInTheDocument();
  });

  it("bothEndsLabeled prefixes the end label with the category name; default omits it", () => {
    const props = {
      data: [{ channel: "Organic search", lastYear: 42000, thisYear: 51500 }],
      category: "channel",
      startKey: "lastYear",
      endKey: "thisYear",
      variant: "slope" as const,
    };
    const { container: without } = render(<DumbbellChart {...props} />);
    const { container: withFlag } = render(<DumbbellChart {...props} bothEndsLabeled />);
    const endText = (root: HTMLElement) =>
      root.querySelector('[data-slot="dumbbell-chart-slope-label-end"]')?.textContent ?? "";
    expect(endText(without)).not.toMatch(/Organic search/);
    expect(endText(withFlag)).toMatch(/Organic search/);
  });

  it("valueLabelFormat overrides both slope endpoint labels' value text", () => {
    const { container } = render(
      <DumbbellChart
        category="channel"
        data={[{ channel: "Organic search", lastYear: 92, thisYear: 95 }]}
        endKey="thisYear"
        startKey="lastYear"
        valueFormat="number"
        valueLabelFormat={(value) => `${value.toFixed(1)}!`}
        variant="slope"
      />,
    );
    const startText = container.querySelector(
      '[data-slot="dumbbell-chart-slope-label-start"]',
    )?.textContent;
    const endText = container.querySelector(
      '[data-slot="dumbbell-chart-slope-label-end"]',
    )?.textContent;
    expect(startText).toBe("Organic search 92.0!");
    expect(endText).toBe("95.0!");
  });

  // #240 — a vertical category label wider than its column used to render as a
  // run-on string over its neighbour. The chosen fallback is truncation: an
  // ellipsis, with the full name still reachable via the row's tooltip title.
  it("ellipsizes a vertical category label wider than its column instead of overlapping the next one", () => {
    const longLabel = "This category name is far wider than any single column";
    const { container, getAllByText } = render(
      <DumbbellChart
        data={[
          { step: longLabel, before: 10, after: 20 },
          { step: "Short", before: 5, after: 8 },
        ]}
        category="step"
        startKey="before"
        endKey="after"
        orientation="vertical"
      />,
    );
    const labels = container.querySelectorAll('[data-slot="dumbbell-chart-category-label"]');
    expect(labels).toHaveLength(2);
    const longLabelText = labels[0]?.textContent ?? "";
    expect(longLabelText).not.toBe(longLabel);
    expect(longLabelText.endsWith("…")).toBe(true);
    // The full name survives — the tooltip renders it as its title on hover
    // (`buildTooltipRows`'s caller passes `hoveredRow.category` untruncated).
    const hitAreas = container.querySelectorAll('[data-slot="dumbbell-chart-hit-area"]');
    fireEvent.mouseEnter(hitAreas[0] as Element);
    expect(getAllByText(longLabel).length).toBeGreaterThan(0);
  });
});

describe("DumbbellChart decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pattern-fills the filled markers per row colour at high decoration, hollow ones stay hollow", () => {
    stubHighDecoration();
    const { container } = render(
      <DumbbellChart data={onboardingData} category="step" endKey="after" startKey="before" />,
    );
    const ids = seriesPatterns(container).map((pattern) => pattern.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const ends = Array.from(container.querySelectorAll('[data-slot="dumbbell-chart-marker-end"]'));
    expect(ends).toHaveLength(onboardingData.length);
    for (const marker of ends) {
      expect(marker.getAttribute("fill")).toMatch(/^url\(#bp-series-/);
      expect(marker.getAttribute("stroke-width")).toBe("1");
    }
    for (const marker of container.querySelectorAll('[data-slot="dumbbell-chart-marker-start"]')) {
      expect(marker.getAttribute("fill")).toBe("var(--chart-background)");
    }
  });

  it("paints no pattern at low decoration", () => {
    const { container } = render(
      <DumbbellChart data={onboardingData} category="step" endKey="after" startKey="before" />,
    );
    expect(seriesPatterns(container)).toHaveLength(0);
  });
});

// RM-116 — dot / range / arrow plots: variant="arrow", variant="dots",
// extended sortBy, groupBy, delta config.
describe('DumbbellChart variant="arrow" (RM-116)', () => {
  const changeData = [
    { region: "North", team: "A", before: 100, after: 140 },
    { region: "South", team: "A", before: 80, after: 60 },
    { region: "East", team: "B", before: 20, after: 50 },
  ];

  it("draws an arrow head + connector per row, coloured by sign, no start/end markers", () => {
    const { container } = render(
      <DumbbellChart
        category="region"
        data={changeData}
        endKey="after"
        startKey="before"
        variant="arrow"
      />,
    );
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-arrow-head"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-connector"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-marker-start"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-marker-end"]')).toHaveLength(0);
    const heads = Array.from(container.querySelectorAll('[data-slot="dumbbell-chart-arrow-head"]'));
    // North/East increase (positive), South decreases (negative) — two
    // distinct fills, never all three the same (WCAG 1.4.1: direction is the
    // second channel, but the fills still have to differ for sign to read at
    // all in a screenshot/print).
    const fills = new Set(heads.map((h) => h.getAttribute("fill")));
    expect(fills.size).toBe(2);
    expect(fills.has("var(--chart-div-pos-2)")).toBe(true);
    expect(fills.has("var(--chart-div-neg-2)")).toBe(true);
  });

  it('delta with mode="percent" labels the signed % change', () => {
    const { container } = render(
      <DumbbellChart
        category="region"
        data={changeData}
        delta={{ show: true, mode: "percent" }}
        endKey="after"
        startKey="before"
        variant="arrow"
      />,
    );
    const labels = Array.from(
      container.querySelectorAll('[data-slot="dumbbell-chart-delta-label"]'),
    ).map((n) => n.textContent);
    expect(labels).toEqual(["+40%", "-25%", "+150%"]);
  });

  it("groupBy renders one header band per first-seen group value, with a separator", () => {
    const { container } = render(
      <DumbbellChart
        category="region"
        data={changeData}
        endKey="after"
        groupBy="team"
        startKey="before"
        variant="arrow"
      />,
    );
    const headers = container.querySelectorAll('[data-slot="dumbbell-chart-group-header"]');
    expect(headers).toHaveLength(2);
    expect(headers[0]?.textContent).toBe("A");
    expect(headers[1]?.textContent).toBe("B");
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-group-separator"]')).toHaveLength(
      2,
    );
    // Every row still draws its own arrow head — grouping only adds bands.
    expect(container.querySelectorAll('[data-slot="dumbbell-chart-arrow-head"]')).toHaveLength(3);
  });

  it('sortBy="deltaPercent" orders rows by |delta / start|, descending', () => {
    const { container } = render(
      <DumbbellChart
        category="region"
        data={changeData}
        endKey="after"
        sortBy="deltaPercent"
        startKey="before"
        variant="arrow"
      />,
    );
    const categories = Array.from(
      container.querySelectorAll('[data-slot="dumbbell-chart-category-label"]'),
    ).map((n) => n.textContent);
    // East: |30/20| = 1.5, South: |20/80| = 0.25, North: |40/100| = 0.4
    expect(categories).toEqual(["East", "North", "South"]);
  });

  it("reverse flips the resolved sort order", () => {
    const { container } = render(
      <DumbbellChart
        category="region"
        data={changeData}
        endKey="after"
        reverse
        sortBy="label"
        startKey="before"
        variant="arrow"
      />,
    );
    const categories = Array.from(
      container.querySelectorAll('[data-slot="dumbbell-chart-category-label"]'),
    ).map((n) => n.textContent);
    expect(categories).toEqual(["South", "North", "East"]);
  });
});

describe('DumbbellChart variant="dots" (RM-116)', () => {
  const scoresData = [
    { product: "Alpha", us: 40, themA: 55, themB: 70 },
    { product: "Beta", us: 60, themA: 45, themB: 50 },
  ];

  it("renders one dot per valueKey per row", () => {
    const { container } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    const dots = container.querySelectorAll('[data-slot="dumbbell-chart-dot"]');
    expect(dots).toHaveLength(6); // 3 keys x 2 rows
  });

  it("draws a range bar between each row's extremes only when range is set", () => {
    const { container: withoutRange } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    expect(withoutRange.querySelectorAll('[data-slot="dumbbell-chart-range-bar"]')).toHaveLength(0);

    const { container: withRange } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        range
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    expect(withRange.querySelectorAll('[data-slot="dumbbell-chart-range-bar"]')).toHaveLength(2);
  });

  it("lists every valueKey in the colour key legend", () => {
    const { getByText } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    expect(getByText("us")).toBeInTheDocument();
    expect(getByText("themA")).toBeInTheDocument();
    expect(getByText("themB")).toBeInTheDocument();
  });
});

describe("DumbbellChart legend (RM-118)", () => {
  const scoresData = [
    { product: "Alpha", us: 40, themA: 55, themB: 70 },
    { product: "Beta", us: 60, themA: 45, themB: 50 },
  ];

  it("leaves RM-116's own corner dot-key badge exactly as it always rendered when legend is unset (R1)", () => {
    const { container } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    expect(container.querySelector('[data-slot="dumbbell-chart-dot-legend"]')).toBeInTheDocument();
    // The new shared engine adds nothing of its own unasked.
    expect(container.querySelector(".legend-container")).not.toBeInTheDocument();
  });

  it("legend + variant='dots' replaces the corner badge with the container legend — one row per valueKey, no buttons (no toggle, R3)", () => {
    const { container } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        legend
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    // Old badge is gone — never both at once.
    expect(
      container.querySelector('[data-slot="dumbbell-chart-dot-legend"]'),
    ).not.toBeInTheDocument();
    const rows = container.querySelectorAll(".legend-container > *");
    expect(rows).toHaveLength(3);
    expect(container.querySelectorAll(".legend-container button")).toHaveLength(0);
  });

  it('an interactive: "toggle" request downgrades to hover — no aria-pressed buttons (no per-key hide)', () => {
    const { container } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        legend={{ interactive: "toggle" }}
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    expect(container.querySelectorAll(".legend-container [aria-pressed]")).toHaveLength(0);
  });

  it("hovering a legend row dims every OTHER dot key's dots, on every row, never the hovered key's own", () => {
    const { container } = render(
      <DumbbellChart
        category="product"
        data={scoresData}
        endKey="themB"
        legend
        startKey="us"
        valueKeys={["us", "themA", "themB"]}
        variant="dots"
      />,
    );
    const rows = container.querySelectorAll(".legend-container > div");
    expect(rows).toHaveLength(3);
    fireEvent.mouseEnter(rows[0] as Element);
    // "us" is dotIndex 0, drawn first on every row (2 rows x 3 keys).
    const dots = container.querySelectorAll('[data-slot="dumbbell-chart-dot"]');
    expect(dots).toHaveLength(6);
    for (const dot of dots) {
      const isUs = dot.getAttribute("data-dot-key") === "us";
      expect(dot.getAttribute("opacity")).toBe(isUs ? "1" : "0.35");
    }
    fireEvent.mouseLeave(rows[0] as Element);
    for (const dot of dots) {
      expect(dot.getAttribute("opacity")).toBe("1");
    }
  });

  it("a truthy legend on the default 'dumbbell' variant renders nothing — no discrete key to show", () => {
    const { container } = render(
      <DumbbellChart
        category="step"
        data={[
          { step: "Sign up", before: 100, after: 100 },
          { step: "Verify email", before: 82, after: 94 },
        ]}
        endKey="after"
        legend
        startKey="before"
      />,
    );
    expect(container.querySelector(".legend-container")).not.toBeInTheDocument();
  });
});
