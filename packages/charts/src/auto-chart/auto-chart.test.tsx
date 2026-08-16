/**
 * auto-chart.test.tsx — Vitest + Testing Library smoke tests for AutoChart.
 *
 * Charts use ResizeObserver (via @visx/responsive's ParentSize and FunnelChart's
 * own observer) and react-use-measure, none of which are implemented in jsdom.
 *
 * Mocking strategy (mirrors bar-chart.test.tsx and scatter-chart.test.tsx):
 * - Mock @visx/responsive to return a fixed 560×288 via a fake ParentSize.
 * - Mock react-use-measure to return fixed bounds.
 * - Stub window.ResizeObserver (for FunnelChart's direct usage).
 *
 * Real render/interaction/a11y is covered by the Storybook stories.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ── @visx/responsive → fixed 560×288 ─────────────────────────────────────────
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// ── react-use-measure → fixed 560×288 ────────────────────────────────────────
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

// ── ResizeObserver stub (FunnelChart uses it directly) ────────────────────────
beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom does not implement SVGPathElement or SVGGeometryElement.getTotalLength().
  // Line and Area series children call it via usePathStrokeMetrics (path-stroke-utils.ts:56).
  // Stub it on Element.prototype so any SVG path element created in jsdom resolves to 0.
  if (typeof Element !== "undefined" && !("getTotalLength" in Element.prototype)) {
    // @ts-expect-error jsdom stub: getTotalLength is not in the TS lib for Element
    Element.prototype.getTotalLength = () => 0;
  }
});

import { AutoChart } from "./auto-chart";
import { inferChartType, isNumericField, isTemporalField } from "./infer-chart-type";
import type { ChartSpec } from "./chart-spec";

afterEach(cleanup);

// ── Shared fixtures ────────────────────────────────────────────────────────────

const temporalData = [
  { date: "2024-01-01", revenue: 12000 },
  { date: "2024-02-01", revenue: 15200 },
  { date: "2024-03-01", revenue: 14100 },
];

const categoricalData = [
  { name: "A", value: 10, other: 5 },
  { name: "B", value: 20, other: 8 },
  { name: "C", value: 15, other: 6 },
];

/** Big enough that the compact formatter actually compacts (≥ 1000). */
const millionsData = [
  { name: "A", value: 1_500_000 },
  { name: "B", value: 2_400_000 },
  { name: "C", value: 900_000 },
];

const numericXData = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
];

const smallPositiveData = [
  { label: "Alpha", count: 30 },
  { label: "Beta", count: 20 },
  { label: "Gamma", count: 50 },
];

// ── inferChartType unit tests ──────────────────────────────────────────────────

describe("inferChartType", () => {
  it("returns 'line' for temporal ISO-date x values", () => {
    const spec: ChartSpec = {
      data: temporalData,
      x: "date",
      series: ["revenue"],
    };
    expect(inferChartType(spec)).toBe("line");
  });

  it("returns 'line' when xType is 'time' regardless of data values", () => {
    const spec: ChartSpec = {
      data: categoricalData,
      x: "name",
      xType: "time",
      series: ["value"],
    };
    expect(inferChartType(spec)).toBe("line");
  });

  it("returns 'scatter' for numeric x with a single numeric series", () => {
    const spec: ChartSpec = {
      data: numericXData,
      x: "x",
      xType: "number",
      series: ["y"],
    };
    expect(inferChartType(spec)).toBe("scatter");
  });

  it("returns 'pie' for single positive numeric series + categorical x + ≤8 rows", () => {
    const spec: ChartSpec = {
      data: smallPositiveData,
      x: "label",
      series: ["count"],
    };
    expect(inferChartType(spec)).toBe("pie");
  });

  it("returns 'bar' (default) for categorical multi-series data", () => {
    const spec: ChartSpec = {
      data: categoricalData,
      x: "name",
      series: ["value", "other"],
    };
    expect(inferChartType(spec)).toBe("bar");
  });

  it("returns 'bar' (default) for categorical single-series with >8 rows", () => {
    const manyRows = Array.from({ length: 10 }, (_, i) => ({ name: `n${i}`, v: i + 1 }));
    const spec: ChartSpec = { data: manyRows, x: "name", series: ["v"] };
    expect(inferChartType(spec)).toBe("bar");
  });

  it("explicit type overrides inference — temporal data + type='bar' stays bar", () => {
    // inferChartType is only called when type is absent — verify the base case
    const spec: ChartSpec = {
      data: temporalData,
      x: "date",
      series: ["revenue"],
    };
    // Without the type field, should infer "line"
    expect(inferChartType(spec)).toBe("line");
  });
});

// ── isTemporalField helper ────────────────────────────────────────────────────

describe("isTemporalField", () => {
  it("returns true for ISO date string values", () => {
    expect(isTemporalField(temporalData, "date")).toBe(true);
  });

  it("returns true for Date object values", () => {
    const data = [{ d: new Date("2024-01-01") }, { d: new Date("2024-02-01") }];
    expect(isTemporalField(data, "d")).toBe(true);
  });

  it("returns false for numeric values", () => {
    expect(isTemporalField(numericXData, "x")).toBe(false);
  });

  it("returns false for plain strings", () => {
    expect(isTemporalField(categoricalData, "name")).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isTemporalField([], "date")).toBe(false);
  });
});

// ── isNumericField helper ─────────────────────────────────────────────────────

describe("isNumericField", () => {
  it("returns true for numeric values", () => {
    expect(isNumericField(numericXData, "x")).toBe(true);
  });

  it("returns false for string values", () => {
    expect(isNumericField(categoricalData, "name")).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isNumericField([], "x")).toBe(false);
  });
});

// ── AutoChart render tests ─────────────────────────────────────────────────────

describe("AutoChart", () => {
  it("renders without throwing for 'line' type", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "line", data: temporalData, x: "date", series: ["revenue"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'area' type", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "area", data: temporalData, x: "date", series: ["revenue"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'bar' type", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "bar", data: categoricalData, x: "name", series: ["value", "other"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  // #394: the auto-legend row label must reach the density-aware `text-meta`
  // ROLE, not the raw `text-xs` UTILITY the type dial cannot see
  // (styling-and-tokens.md "Type is a role, not a size"). Multi-series data
  // (2 series) makes `showLegend` default true, rendering <AutoLegend>.
  it("renders the auto-legend rows with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "bar", data: categoricalData, x: "name", series: ["value", "other"] }}
        height={280}
      />,
    );
    const legend = container.querySelector('ul[aria-label="Chart legend"]');
    expect(legend).not.toBeNull();
    const rows = legend?.querySelectorAll("li") ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveClass("text-meta");
      expect(row).not.toHaveClass("text-xs");
    }
  });

  it("renders without throwing for 'pie' type", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "pie", data: smallPositiveData, x: "label", series: ["count"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'scatter' type", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "scatter", data: numericXData, x: "x", xType: "number", series: ["y"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'scatter' type with a categorical (non-Date) x (#352)", () => {
    // No `xType: "time"` hint, so `renderChart`'s scatter branch does NOT
    // coerce `x` to Date — the raw categorical strings reach ScatterChart's
    // xAccessor directly (`new Date("A")` is Invalid), matching the exact
    // repro: `<AutoChart spec={{type:"scatter", x:"ch", ...}}/>`.
    const categoricalXData = [
      { ch: "A", value: 5 },
      { ch: "B", value: 8 },
    ];
    const { container } = render(
      <AutoChart
        spec={{ type: "scatter", data: categoricalXData, x: "ch", series: ["value"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'radar' type", () => {
    const radarData = [
      { metric: "Speed", teamA: 80, teamB: 70 },
      { metric: "Accuracy", teamA: 90, teamB: 85 },
      { metric: "Efficiency", teamA: 75, teamB: 88 },
    ];
    const { container } = render(
      <AutoChart
        spec={{ type: "radar", data: radarData, x: "metric", series: ["teamA", "teamB"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without throwing for 'funnel' type", () => {
    const funnelData = [
      { stage: "Awareness", users: 10000 },
      { stage: "Interest", users: 6800 },
      { stage: "Purchase", users: 980 },
    ];
    const { container } = render(
      <AutoChart
        spec={{ type: "funnel", data: funnelData, x: "stage", series: ["users"] }}
        height={280}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders ChartFallback with 'No data to display' for empty data", () => {
    const { getByRole } = render(<AutoChart spec={{ data: [], x: "date", series: ["revenue"] }} />);
    const fallback = getByRole("status");
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent).toContain("No data to display");
  });

  it("renders ChartFallback with 'No data to display' for empty series", () => {
    const { getByRole } = render(
      <AutoChart spec={{ data: temporalData, x: "date", series: [] }} />,
    );
    const fallback = getByRole("status");
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent).toContain("No data to display");
  });

  it("renders ChartFallback with 'not supported yet' for an unsupported type", () => {
    const { getByRole } = render(
      <AutoChart
        spec={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional unsupported type for test
          type: "sankey" as any,
          data: categoricalData,
          x: "name",
          series: ["value"],
        }}
      />,
    );
    const fallback = getByRole("status");
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent).toContain("not supported yet");
  });

  it("explicit type overrides inference — bar renders for temporal data", () => {
    const { container, queryByText } = render(
      <AutoChart
        spec={{ type: "bar", data: temporalData, x: "date", series: ["revenue"] }}
        height={280}
      />,
    );
    /*
     * No fallback should appear. Asserted on the fallback's TEXT, not on the
     * absence of `role="status"`: a rendering AutoChart now carries its own
     * empty polite live region (the `copyValueOnActivate` announcement, which
     * has to be mounted from first paint to be announced — ARIA22), so
     * `role="status"` no longer discriminates chart from fallback.
     */
    expect(queryByText(/not supported yet|No data to display/)).toBeNull();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("forwards className to the root wrapper", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "bar", data: categoricalData, x: "name", series: ["value"] }}
        className="my-custom-chart"
      />,
    );
    expect(container.firstChild).toHaveClass("my-custom-chart");
  });

  it("forwards ref to the root wrapper div", () => {
    let captured: HTMLDivElement | null = null;
    render(
      <AutoChart
        spec={{ type: "bar", data: categoricalData, x: "name", series: ["value"] }}
        ref={(el) => {
          captured = el;
        }}
      />,
    );
    expect(captured).toBeInstanceOf(HTMLDivElement);
  });

  // Loading vs ready (#268): a layout-shaped skeleton at the chart's normal
  // height, with exactly one status live region (not per skeleton box).
  describe("loading", () => {
    it("renders a skeleton instead of resolving the spec", () => {
      const { container, queryByText } = render(
        <AutoChart
          loading
          spec={{ type: "line", data: temporalData, x: "date", series: ["revenue"] }}
        />,
      );
      expect(container.querySelector('[data-testid="parent-size"]')).not.toBeInTheDocument();
      expect(queryByText("No data to display")).not.toBeInTheDocument();
    });

    it("renders exactly one status live region for the not-ready state", () => {
      const { getAllByRole } = render(
        <AutoChart
          loading
          spec={{ type: "line", data: temporalData, x: "date", series: ["revenue"] }}
        />,
      );
      expect(getAllByRole("status")).toHaveLength(1);
    });
  });

  // The bar branch had NO value axis at all — a bar chart rendered categories
  // and no way to read a magnitude off it.
  describe("bar value axis", () => {
    it("renders a formatted y-axis for vertical bars", () => {
      const { getAllByText } = render(
        <AutoChart spec={{ type: "bar", data: millionsData, x: "name", series: ["value"] }} />,
      );
      // Compact by default, so the axis reads 1.5M — not 1500000 and not 1500k.
      expect(getAllByText(/M$/).length).toBeGreaterThan(0);
      expect(document.body.textContent).not.toContain("1500k");
    });

    it("renders NO y-axis for horizontal bars", () => {
      /*
       * Deliberate, not an omission: with `orientation="horizontal"` the chart
       * sets `yScale = valueScale` over `[0, innerWidth]`, and `YAxis` paints
       * scale OUTPUT as a `top` coordinate — it would plot x-pixels vertically.
       * The bottom value axis a horizontal bar chart wants is its own component.
       */
      const { queryAllByText } = render(
        <AutoChart
          spec={{
            type: "bar",
            data: millionsData,
            x: "name",
            series: ["value"],
            orientation: "horizontal",
          }}
        />,
      );
      expect(queryAllByText(/M$/)).toHaveLength(0);
    });

    it("threads spec.currency into the axis ticks", () => {
      const { container } = render(
        <AutoChart
          spec={{
            type: "bar",
            data: millionsData,
            x: "name",
            series: ["value"],
            valueFormat: "currency",
            currency: "EUR",
          }}
        />,
      );
      expect(container.textContent).toContain("€");
    });

    it("renders the title with the subtitle type role, not a raw font size", () => {
      const { getByText } = render(
        <AutoChart
          spec={{ type: "bar", data: categoricalData, x: "name", series: ["value"], title: "Rev" }}
        />,
      );
      expect(getByText("Rev").className).toContain("text-subtitle");
    });
  });

  // Compact axis labels are only acceptable if the exact value stays reachable,
  // so AutoChart — unlike a raw container — turns the copy path on by default.
  describe("copyValueOnActivate", () => {
    it("mounts the keyboard-operable datapoint layer by default", () => {
      const { container } = render(
        <AutoChart spec={{ type: "bar", data: millionsData, x: "name", series: ["value"] }} />,
      );
      expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeInTheDocument();
    });

    it("keeps the pre-existing DOM when opted out", () => {
      const { container } = render(
        <AutoChart
          copyValueOnActivate={false}
          spec={{ type: "bar", data: millionsData, x: "name", series: ["value"] }}
        />,
      );
      expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
      // …and no live region either — the announcement only exists with the copy.
      expect(container.querySelector('[role="status"]')).toBeNull();
    });
  });
});
