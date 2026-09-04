import { cleanup, render } from "@testing-library/react";
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
  DumbbellChart,
  sortDumbbellRows,
  spaceSlopeLabels,
  type DumbbellRow,
} from "./dumbbell-chart";

afterEach(cleanup);

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

  it('sorts ascending by "delta"', () => {
    const sorted = sortDumbbellRows(rows, "delta");
    expect(sorted.map((r) => r.category)).toEqual([
      "Sign up",
      "Verify email",
      "Add payment",
      "First project",
    ]);
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
});
