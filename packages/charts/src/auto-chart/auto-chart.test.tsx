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
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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
  // HeatmapChart's reveal path mounts framer-motion's `useInView`, which reads
  // the global directly — jsdom has no IntersectionObserver at all (RM-038).
  if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
    class StubIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as Record<string, unknown>).IntersectionObserver = StubIntersectionObserver;
  }
  // jsdom does not implement SVGPathElement or SVGGeometryElement.getTotalLength().
  // Line and Area series children call it via usePathStrokeMetrics (path-stroke-utils.ts:56).
  // Stub it on Element.prototype so any SVG path element created in jsdom resolves to 0.
  if (typeof Element !== "undefined" && !("getTotalLength" in Element.prototype)) {
    // @ts-expect-error jsdom stub: getTotalLength is not in the TS lib for Element
    Element.prototype.getTotalLength = () => 0;
  }
});

import { LocaleProvider } from "@elabs-ai/components-ui";
import { AutoChart } from "./auto-chart";
import {
  CHART_SPEC_PALETTES,
  CHART_TYPES,
  inferChartType,
  isChartSpecPalette,
  isNumericField,
  isTemporalField,
} from "./infer-chart-type";
import type { ChartSpec } from "./chart-spec";
// Choropleth — RM-124
import type { FeatureCollection, Geometry } from "geojson";
import type { ChoroplethFeatureProperties } from "../charts/choropleth/choropleth-context";
import { ChartFrame } from "../chart-frame/chart-frame";
import { SELECTION_EXCLUDED_OPACITY } from "../charts/chart-selection";
import { Line, LineChart } from "../charts";

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

// Choropleth — RM-124: two squares wide apart, each carrying its own `id`
// and `name`, so a join can be proved on either property.
const choroplethSquare = (
  id: string,
  name: string,
  lon: number,
): FeatureCollection<Geometry, ChoroplethFeatureProperties>["features"][number] => ({
  type: "Feature",
  id,
  // Winding SW → NW → NE → SE, as `squareStateFeature` documents: d3-geo reads
  // a reversed ring as the whole sphere minus the square.
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lon - 5, -5],
        [lon - 5, 5],
        [lon + 5, 5],
        [lon + 5, -5],
        [lon - 5, -5],
      ],
    ],
  },
  properties: { id, name },
});

const choroplethGeo: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [choroplethSquare("A", "Alpha", -20), choroplethSquare("B", "Beta", 20)],
};

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

  // #394: the legend row label must reach the density-aware `text-meta`
  // ROLE, not the raw `text-xs` UTILITY the type dial cannot see
  // (styling-and-tokens.md "Type is a role, not a size"). Multi-series data
  // (2 series) makes `showLegend` default true. RM-118 Part B: `bar` now
  // renders the SAME container legend engine line/area/stream already used
  // (`useContainerLegend`), not the retired `<AutoLegend>` — its `<li>` row
  // WAS the label element (`text-muted-foreground text-meta`); the engine's
  // `ChartLegend` row is a wrapper `<div>`/`<button>` around a label `<span>`
  // instead, so the assertion now reaches through to that span — same
  // meaning (the rendered label text carries `text-meta`, never `text-xs`),
  // adjusted for the new DOM shape. Fix round 1 restores this after it was
  // wrongly weakened to a `not.toHaveClass("text-xs")`-only check that would
  // have passed even with the plain `text-sm font-medium` regression this
  // guards against. See `useContainerLegend`'s `labelClassName: "text-meta"`
  // for the source-level fix this test locks in.
  it("renders the legend rows through the text-meta role, never the raw text-xs utility", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "bar", data: categoricalData, x: "name", series: ["value", "other"] }}
        height={280}
      />,
    );
    const legend = container.querySelector('[data-slot="container-legend-root"] .legend-container');
    expect(legend).not.toBeNull();
    // #607: a hover-only row (the default here — no toggle/drill-down wired)
    // is now a real focusable `<button>`, not a `<div>`.
    const rows = legend?.querySelectorAll(":scope > div, :scope > button") ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const label = row.querySelector("span");
      expect(label).toHaveClass("text-meta");
      expect(label).not.toHaveClass("text-xs");
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

  // Post-merge fix (orchestrator ruling): `ChartSpec` has one `sort` field,
  // shared with BarChart's row order (`BarSort`), narrowed per chart family
  // in `auto-chart.tsx` rather than a separate `pieSort`.
  it("pie: sort 'desc' orders slices largest-first; sort 'asc' is ignored, keeping data order", () => {
    // AMER is the largest value but listed last in `data` — its position in
    // `data` never changes (PieSlice is index-based), only its ANGULAR
    // placement does. Read that placement off each slice's hitbox path's
    // starting point (the `M` command's x). Every slice shares the same
    // outer radius, so two slices placed at the same angular POSITION start
    // at the same x, regardless of the chart's own start-angle convention —
    // no need to assume where "angle 0" is.
    const regions = [
      { label: "EMEA", value: 42 },
      { label: "APAC", value: 31 },
      { label: "AMER", value: 55 },
    ];
    const startX = (d: string | null): number => {
      const match = d?.match(/^M(-?[\d.]+),/);
      if (!match?.[1]) {
        throw new Error(`no M command found in path: ${d}`);
      }
      return Number(match[1]);
    };
    const sliceStartXs = (sort: "none" | "asc" | "desc" | undefined): number[] => {
      const { container, unmount } = render(
        <AutoChart
          spec={{ type: "pie", data: regions, x: "label", series: ["value"], sort }}
          height={280}
        />,
      );
      const hitboxes = container.querySelectorAll('path[fill="transparent"]');
      expect(hitboxes.length).toBe(3);
      const xs = Array.from(hitboxes).map((h) => startX(h.getAttribute("d")));
      unmount();
      return xs;
    };

    // Default (`sort` unset → "none"): data order kept, so EMEA (index 0)
    // is placed FIRST and AMER (index 2) is placed LAST.
    const [firstSliceStartX, , amerStartXNone] = sliceStartXs(undefined);

    // sort: "desc" — AMER (largest) is placed FIRST, so it starts at the
    // same angular position EMEA occupied above.
    const [, , amerStartXDesc] = sliceStartXs("desc");
    expect(amerStartXDesc).toBeCloseTo(firstSliceStartX!, 5);

    // sort: "asc" is not a pie value (only "desc"/"none" are honoured) — the
    // pie narrowing in auto-chart.tsx drops it, so AMER stays LAST, exactly
    // as under the unset default.
    const [, , amerStartXAsc] = sliceStartXs("asc");
    expect(amerStartXAsc).toBeCloseTo(amerStartXNone!, 5);
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

  it("'scatter' with xType: 'number' renders numeric x ticks, never an epoch date (#302)", () => {
    // The spec-level lock: `xType: "number"` is a documented, public
    // `ChartSpec` field (`chart-spec.ts`) — a caller who sets it correctly
    // must not get `new Date(weight)` silently mislabeling the axis.
    const weightMpgData = [
      { weight: 1240, mpg: 41 },
      { weight: 2900, mpg: 22 },
      { weight: 3400, mpg: 18 },
    ];
    const { container } = render(
      <AutoChart
        spec={{
          type: "scatter",
          data: weightMpgData,
          x: "weight",
          xType: "number",
          series: ["mpg"],
        }}
        height={280}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("1240");
    expect(text).not.toMatch(/1970|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
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

  it("'scatter' with spec.colorBy colours points by that column (one ChartSpec field shared with 'bar')", () => {
    // Orchestrator ruling: ChartSpec has ONE `colorBy` field — bar (RM-113)
    // and scatter (RM-115) both read `spec.colorBy`, since `ChartColorBy`'s
    // shape (`{ key, scale?, steps? }`) already covers both. This is the
    // scatter-side half of that contract: a categorical `colorBy.key` must
    // reach `<Scatter colorBy>` and paint a different fill per group.
    const studentLoanData = [
      { income: 20000, repaymentRate: 2, eu: "eu" },
      { income: 25000, repaymentRate: 3, eu: "eu" },
      { income: 30000, repaymentRate: 5, eu: "non-eu" },
      { income: 35000, repaymentRate: 6, eu: "non-eu" },
    ];
    const { container } = render(
      <AutoChart
        spec={{
          type: "scatter",
          data: studentLoanData,
          x: "income",
          xType: "number",
          series: ["repaymentRate"],
          colorBy: { key: "eu" },
        }}
        height={280}
      />,
    );
    // Each point renders 2 circles (an inner filled shape, an unfilled outer
    // ring) — keep only the filled one.
    const fills = Array.from(container.querySelectorAll('[data-slot="scatter-point"] circle'))
      .map((el) => el.getAttribute("fill"))
      .filter((f) => f !== "none");
    expect(fills).toHaveLength(4);
    expect(fills.every((f) => Boolean(f))).toBe(true);
    // Two distinct groups ("eu" vs "non-eu") must resolve to two distinct fills.
    expect(new Set(fills).size).toBe(2);
    // Same-group points share exactly one fill.
    expect(fills[0]).toBe(fills[1]);
    expect(fills[2]).toBe(fills[3]);
    expect(fills[0]).not.toBe(fills[2]);
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

  it("draws the empty box, never throws, for a spec that is still arriving (no series, no data yet)", () => {
    // An agent streaming an A2UI surface delivers `type` before `data` before `series`.
    const partials = [{ type: "line" }, { type: "line", data: temporalData, x: "date" }];
    for (const partial of partials) {
      const { getByRole, unmount } = render(<AutoChart spec={partial as unknown as ChartSpec} />);
      expect(getByRole("status").textContent).toContain("No data to display");
      unmount();
    }
  });

  // #304 — the unsupported fallback speaks to the reader (not about the
  // library's roadmap), resolves through t(), is a settled result rather than a
  // live region, and names the bad type only on the developer channel.
  describe("unsupported type fallback (#304)", () => {
    const unsupportedSpec = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional unsupported type for test
      type: "sankey" as any,
      data: categoricalData,
      x: "name",
      series: ["value"],
    };

    it("renders user-facing copy, never a statement about the library", () => {
      const { container } = render(<AutoChart spec={unsupportedSpec} />);
      const fallback = container.querySelector('[data-slot="chart-fallback"]');
      expect(fallback).toHaveAttribute("data-kind", "unsupported");
      expect(fallback).toHaveTextContent("This chart can’t be displayed.");
      expect(fallback?.textContent ?? "").not.toMatch(/not supported|unsupported|yet|sankey/i);
    });

    it("resolves every fallback string through the locale seam", () => {
      const { container } = render(
        <LocaleProvider
          messages={{
            "charts.chart.unsupported": "Dieses Diagramm kann nicht angezeigt werden.",
            "charts.chart.empty": "Keine Daten",
          }}
        >
          <AutoChart spec={unsupportedSpec} />
          <AutoChart spec={{ data: [], x: "date", series: ["revenue"] }} />
        </LocaleProvider>,
      );
      const fallbacks = container.querySelectorAll('[data-slot="chart-fallback"]');
      expect(fallbacks[0]).toHaveTextContent("Dieses Diagramm kann nicht angezeigt werden.");
      expect(fallbacks[1]).toHaveTextContent("Keine Daten");
    });

    it("is not a live region, while the loading state still is", () => {
      const { container } = render(
        <>
          <AutoChart spec={unsupportedSpec} />
          <AutoChart spec={unsupportedSpec} loading />
        </>,
      );
      const fallback = container.querySelector('[data-slot="chart-fallback"]');
      expect(fallback).not.toHaveAttribute("aria-live");
      expect(fallback).not.toHaveAttribute("role");
      const loading = container.querySelector('[role="status"]');
      expect(loading).toHaveAttribute("aria-live", "polite");
      expect(loading).toHaveTextContent("Loading chart…");
    });

    it("names the unsupported type in a dev console warning", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        render(<AutoChart spec={{ ...unsupportedSpec, type: "invented-by-a-model" as never }} />);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"invented-by-a-model"'));
      } finally {
        warn.mockRestore();
      }
    });
  });

  it("explicit type overrides inference — bar renders for temporal data", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "bar", data: temporalData, x: "date", series: ["revenue"] }}
        height={280}
      />,
    );
    // No fallback should appear. Asserted on the fallback's own slot: a
    // rendering AutoChart carries its own polite live region (the
    // `copyValueOnActivate` announcement, ARIA22), so `role="status"` does not
    // discriminate chart from fallback.
    expect(container.querySelector('[data-slot="chart-fallback"]')).toBeNull();
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

  // ── RM-038: every new ChartType reaches a real container ────────────────────
  //
  // The `type` is EXPLICIT in each case: this asserts the render switch, not
  // the inference (which `infer-chart-type.test.ts` owns end to end). A type
  // with no branch returns `null` from `renderChart` and AutoChart renders the
  // unsupported fallback — so "is the fallback absent" is the real
  // assertion here, not "did something render".
  describe("the RM-038 families", () => {
    const specs: Array<[string, ChartSpec]> = [
      [
        "candlestick",
        {
          type: "candlestick",
          data: [
            { date: "2024-01-15", open: 112, high: 119, low: 110, close: 118 },
            { date: "2024-01-16", open: 118, high: 124, low: 116, close: 121 },
          ],
          x: "date",
          series: ["open", "high", "low", "close"],
        },
      ],
      [
        "heatmap",
        {
          type: "heatmap",
          data: [
            { day: "Mon", hour: "09", visits: 12 },
            { day: "Tue", hour: "10", visits: 22 },
          ],
          x: "day",
          series: ["visits"],
        },
      ],
      [
        "calendar",
        {
          type: "calendar",
          data: [
            { date: "2024-01-01", commits: 3 },
            { date: "2024-01-02", commits: 7 },
          ],
          x: "date",
          series: ["commits"],
        },
      ],
      [
        "waterfall",
        {
          type: "waterfall",
          data: [
            { stage: "Gross revenue", value: 480 },
            { stage: "Discounts", value: -60 },
            { stage: "Net total", value: 420 },
          ],
          x: "stage",
          series: ["value"],
        },
      ],
      [
        "dumbbell",
        {
          type: "dumbbell",
          data: [
            { region: "North", before: 42, after: 61 },
            { region: "South", before: 31, after: 46 },
          ],
          x: "region",
          series: ["before", "after"],
        },
      ],
      [
        "unit",
        {
          type: "unit",
          data: [
            { group: "Cycled", share: 41 },
            { group: "Walked", share: 59 },
          ],
          x: "group",
          series: ["share"],
        },
      ],
      [
        "treemap",
        {
          type: "treemap",
          data: [],
          x: "name",
          series: [],
          hierarchy: {
            name: "Spend",
            children: [
              { name: "Cloud", value: 40 },
              { name: "Salaries", value: 60 },
            ],
          },
        },
      ],
      [
        "histogram",
        {
          type: "histogram",
          data: [{ ms: 120 }, { ms: 340 }, { ms: 95 }, { ms: 610 }],
          x: "ms",
          series: ["ms"],
        },
      ],
      [
        "box",
        {
          type: "box",
          data: Array.from({ length: 40 }, (_, i) => ({
            cohort: i % 2 === 0 ? "A" : "B",
            ms: 100 + ((i * 37) % 300),
          })),
          x: "cohort",
          series: ["ms"],
          group: "cohort",
        },
      ],
      [
        "strip",
        {
          type: "strip",
          data: Array.from({ length: 20 }, (_, i) => ({
            cohort: i % 2 === 0 ? "A" : "B",
            ms: 100 + ((i * 37) % 300),
          })),
          x: "cohort",
          series: ["ms"],
          group: "cohort",
        },
      ],
      [
        "bump",
        {
          type: "bump",
          data: [
            { quarter: "Q1", team: "Alpha", rank: 1 },
            { quarter: "Q1", team: "Beta", rank: 2 },
            { quarter: "Q2", team: "Alpha", rank: 2 },
            { quarter: "Q2", team: "Beta", rank: 1 },
          ],
          x: "quarter",
          series: ["rank"],
        },
      ],
      [
        "stream",
        {
          type: "stream",
          data: [
            { date: "2024-01-01", a: 4, b: 6 },
            { date: "2024-02-01", a: 5, b: 4 },
          ],
          x: "date",
          series: ["a", "b"],
          stacked: true,
        },
      ],
      [
        "diverging-bar",
        {
          type: "diverging-bar",
          data: [
            { region: "North", change: 12 },
            { region: "South", change: -8 },
          ],
          x: "region",
          series: ["change"],
        },
      ],
      // Choropleth — RM-124
      [
        "choropleth",
        {
          type: "choropleth",
          geo: choroplethGeo,
          match: { row: "code", feature: "id" },
          data: [
            { code: "A", region: "Alpha", cooling: 120 },
            { code: "B", region: "Beta", cooling: 40 },
          ],
          x: "region",
          series: ["cooling"],
          scale: { type: "stepped", method: "quantile", steps: 2 },
        },
      ],
      // Dual-axis — RM-121
      [
        "dual-axis",
        {
          type: "dual-axis",
          data: [
            { month: "2024-01-01", orders: 182, conversion: 2.4 },
            { month: "2024-02-01", orders: 236, conversion: 3.1 },
          ],
          x: "month",
          series: [
            { key: "orders", mark: "column" },
            { key: "conversion", axis: "right" },
          ],
          axes: { y2: { align: "ticks" } },
        },
      ],
    ];

    for (const [name, spec] of specs) {
      it(`renders a real container for '${name}' — not the unsupported fallback`, () => {
        const { container } = render(<AutoChart spec={spec} height={280} />);
        expect(container.firstChild).toBeInTheDocument();
        expect(container.querySelector('[data-kind="unsupported"]')).toBeNull();
      });
    }

    it("covers every member of the ChartType union", () => {
      // Seven Core-7 cases already have their own tests above; between the two
      // sets every union member must have a render assertion, so a type added
      // to the union with no `renderChart` branch cannot slip through.
      const covered = new Set<string>([
        ...specs.map(([name]) => name),
        "line",
        "area",
        "bar",
        "pie",
        "scatter",
        "radar",
        "funnel",
      ]);
      expect([...CHART_TYPES].filter((t) => !covered.has(t))).toEqual([]);
    });

    it("falls back for a type outside the union", () => {
      const { container } = render(
        <AutoChart
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately out-of-catalogue
          spec={{ type: "sankey" as any, data: categoricalData, x: "name", series: ["value"] }}
        />,
      );
      expect(container.querySelector('[data-slot="chart-fallback"]')).toHaveAttribute(
        "data-kind",
        "unsupported",
      );
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

// A treemap is shape-sensitive — its whole quality depends on tile aspect
// ratios — so `height` must be a FLOOR, not a fixed box, matching the
// heatmap/dumbbell convention (#306: a wide+short fixed box degenerated the
// layout into a row of slivers).
describe("AutoChart treemap sizing (#306)", () => {
  const treemapSpec: ChartSpec = {
    type: "treemap",
    data: [],
    x: "name",
    series: [],
    hierarchy: {
      name: "Spend",
      children: [
        { name: "Cloud", value: 40 },
        { name: "Salaries", value: 60 },
      ],
    },
  };

  it("passes height as a minHeight floor, never a fixed height", () => {
    const { container } = render(<AutoChart height={280} spec={treemapSpec} />);
    const chartRoot = container.querySelector('[data-slot="treemap-chart"]') as HTMLElement;
    expect(chartRoot).toBeInTheDocument();
    expect(chartRoot.style.minHeight).toBe("280px");
    expect(chartRoot.style.height).toBe("");
  });
});

// `palette` is a DATA encoding (value / group / nothing), so the spec surface
// exposes it for the treemap (#306); the mono default is untouched.
describe("AutoChart treemap palette (#306)", () => {
  const hierarchy = {
    name: "Work",
    children: [
      {
        name: "Platform",
        children: [
          { name: "CI", value: 40 },
          { name: "Infra", value: 30 },
        ],
      },
      {
        name: "Product",
        children: [
          { name: "Onboarding", value: 25 },
          { name: "Search", value: 5 },
        ],
      },
    ],
  };

  const distinctLeafFills = (palette?: unknown): number => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    const spec = {
      type: "treemap",
      data: [],
      x: "name",
      series: [],
      hierarchy,
      ...(palette === undefined ? {} : { palette }),
    } as ChartSpec;
    const { container } = render(<AutoChart spec={spec} />);
    spy.mockRestore();
    const leaves = Array.from(container.querySelectorAll("[data-treemap-leaf-id]"));
    expect(leaves.length).toBe(4);
    return new Set(leaves.map((leaf) => leaf.getAttribute("fill"))).size;
  };

  it("omitting palette keeps the mono default: one leaf fill", () => {
    expect(distinctLeafFills()).toBe(1);
  });

  it('passes "mono" through: one leaf fill', () => {
    expect(distinctLeafFills("mono")).toBe(1);
  });

  it('passes "categorical" through: one fill per top-level group', () => {
    expect(distinctLeafFills("categorical")).toBe(2);
  });

  it('passes "sequential" through: a value ramp', () => {
    expect(distinctLeafFills("sequential")).toBeGreaterThan(1);
  });

  it("an invented palette falls back to mono instead of reaching the layout", () => {
    expect(distinctLeafFills("rainbow")).toBe(1);
    expect(distinctLeafFills(42)).toBe(1);
  });

  it("CHART_SPEC_PALETTES lists exactly the ChartSpecPalette union", () => {
    expect([...CHART_SPEC_PALETTES].sort()).toEqual(["categorical", "mono", "sequential"]);
    expect(isChartSpecPalette("categorical")).toBe(true);
    expect(isChartSpecPalette("rainbow")).toBe(false);
    expect(isChartSpecPalette(undefined)).toBe(false);
  });
});

// Selection/Hover inputs — RM-073
describe("AutoChart selection pass-through (RM-073)", () => {
  const spec: ChartSpec = {
    type: "bar",
    data: [
      { region: "EMEA", code: "E", sales: 12 },
      { region: "APAC", code: "A", sales: 24 },
      { region: "AMER", code: "M", sales: 8 },
    ],
    x: "region",
    series: ["sales"],
  };
  const states = { EMEA: "selected", APAC: "associated", AMER: "excluded" } as const;

  it("renders the same data-selection attributes as the underlying BarChart", () => {
    const { container } = render(
      <AutoChart
        copyValueOnActivate={false}
        selectionStates={(c) => states[String(c) as keyof typeof states]}
        spec={spec}
      />,
    );
    const painted = [...container.querySelectorAll("[data-selection]")].map((el) =>
      el.getAttribute("data-selection"),
    );
    expect(painted).toEqual(["selected", "associated", "excluded"]);
  });

  it("re-keys the resolver onto spec.fields.category", () => {
    const byCode = { E: "excluded", A: "excluded", M: "selected" } as const;
    const { container } = render(
      <AutoChart
        copyValueOnActivate={false}
        selectionStates={(c) => byCode[String(c) as keyof typeof byCode] ?? "associated"}
        spec={{ ...spec, fields: { category: "code" } }}
      />,
    );
    expect(container.querySelectorAll('[data-selection="excluded"]')).toHaveLength(2);
  });

  it.each([
    { type: "line" },
    { type: "area" },
    { type: "pie" },
    { type: "dumbbell", series: ["sales", "target"] },
    { type: "unit" },
    { type: "treemap" },
  ] as const)("forwards selectionStates to the $type family", ({ type, ...rest }) => {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 600,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 0,
      y: 0,
    } as DOMRect);
    const typed: ChartSpec = {
      ...spec,
      data: spec.data?.map((row) => ({ ...row, target: Number(row.sales) + 5 })),
      hierarchy: {
        name: "Sales",
        children: [
          {
            name: "All",
            children: (spec.data ?? []).map((row) => ({
              name: String(row.region),
              value: Number(row.sales),
            })),
          },
        ],
      },
      type,
      xType: "category",
      series: "series" in rest && rest.series ? [...rest.series] : spec.series,
    };
    const { container } = render(
      <AutoChart
        copyValueOnActivate={false}
        selectionStates={(c) => states[String(c) as keyof typeof states] ?? "associated"}
        spec={typed}
      />,
    );
    rect.mockRestore();
    const painted = new Set(
      [...container.querySelectorAll("[data-selection]")].map((el) =>
        el.getAttribute("data-selection"),
      ),
    );
    expect(painted).toEqual(new Set(["selected", "associated", "excluded"]));
  });
});

// nulls / curve / symbols — RM-112
describe("AutoChart nulls/curve/symbols pass-through (RM-112)", () => {
  const nullsData = [
    { date: "2024-01-01", revenue: 12000 },
    { date: "2024-01-02", revenue: 15200 },
    { date: "2024-01-03", revenue: null },
    { date: "2024-01-04", revenue: 14100 },
  ];

  it("spec.nulls reaches the 'line' family and breaks the path at the gap", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "line", data: nullsData, x: "date", series: ["revenue"], nulls: "gap" }}
        height={280}
      />,
    );
    const d = container.querySelector("path.visx-linepath")?.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it("spec.nulls reaches the 'area' family and breaks the crest at the gap", () => {
    const { container } = render(
      <AutoChart
        spec={{ type: "area", data: nullsData, x: "date", series: ["revenue"], nulls: "gap" }}
        height={280}
      />,
    );
    const d = container.querySelector("path.visx-linepath")?.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it("spec.curve reaches every 'line' series", () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "line",
          data: temporalData,
          x: "date",
          series: ["revenue"],
          curve: "step-after",
        }}
        height={280}
      />,
    );
    const stepD = container.querySelector("path.visx-linepath")?.getAttribute("d") ?? "";
    const { container: monotoneContainer } = render(
      <AutoChart
        spec={{ type: "line", data: temporalData, x: "date", series: ["revenue"] }}
        height={280}
      />,
    );
    const monotoneD =
      monotoneContainer.querySelector("path.visx-linepath")?.getAttribute("d") ?? "";
    expect(stepD).not.toBe(monotoneD);
  });

  it("spec.symbols reaches every 'line'/'area' series as hollow markers", () => {
    const { container: lineContainer } = render(
      <AutoChart
        spec={{
          type: "line",
          data: temporalData,
          x: "date",
          series: ["revenue"],
          symbols: { style: "hollow" },
        }}
        height={280}
      />,
    );
    expect(lineContainer.querySelectorAll("circle").length).toBeGreaterThan(0);

    const { container: areaContainer } = render(
      <AutoChart
        spec={{
          type: "area",
          data: temporalData,
          x: "date",
          series: ["revenue"],
          symbols: { style: "hollow" },
        }}
        height={280}
      />,
    );
    expect(areaContainer.querySelectorAll("circle").length).toBeGreaterThan(0);
  });
});

// Tooltip presets — RM-119
describe("AutoChart spec.tooltip.focus reaches the line family standalone (RM-119)", () => {
  const twoSeriesData = [
    { date: "2024-01-01", a: 10, b: 30 },
    { date: "2024-01-02", a: 20, b: 25 },
    { date: "2024-01-03", a: 15, b: 28 },
  ];

  it("dims the other series on hover with no focusOnHover on the rendered container", async () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "line",
          data: twoSeriesData,
          x: "date",
          series: ["a", "b"],
          tooltip: { focus: true },
        }}
        height={280}
      />,
    );

    // Same seam the `Focus` story (`tooltip.stories.tsx`) asserts in the
    // browser: `<ChartTooltip focus />` alone — AutoChart never sets
    // `focusOnHover` on the `LineChart` it renders — registers "focus
    // requested" on `ChartSeriesModeProvider` (`time-series-chart-shell.tsx`),
    // which `SeriesHoverDim` (`series-hover-dim.tsx`) reads to widen each
    // series' invisible hit-stroke path (RM-112) and gate its dim. No real
    // timer involved: the reveal animation only tweens the visible stroke's
    // clip/opacity, never whether these path elements are mounted.
    await waitFor(() => {
      expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
    });
    const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
    const seriesAGroup = paths[0]?.closest("g");
    const seriesBGroup = paths[1]?.closest("g");
    expect(seriesAGroup).toBeTruthy();
    expect(seriesBGroup).toBeTruthy();

    fireEvent.mouseOver(seriesBGroup as Element);

    await waitFor(() => {
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    });

    fireEvent.mouseOut(seriesBGroup as Element);

    await waitFor(() => {
      expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
    });
  });

  // issue 545: `<ChartTooltip focus>`'s own standalone focus-dim
  // registration had the identical keyboard gap as a plain `focusOnHover`
  // container — nothing outside a pointer/touch could reach the spotlight.
  // `SeriesFocusTargets` reads `focusOnHover` from `ChartSeriesModeProvider`'s
  // context (not a prop), which already ORs in `setFocusRequested` from a
  // `<ChartTooltip focus>` registration — so the SAME keyboard targets this
  // fix adds for a plain `focusOnHover` container also cover this seam, with
  // no `chart-tooltip.tsx` change.
  it("keyboard-focusing a SeriesFocusTargets button dims the other series with no focusOnHover on the container", async () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "line",
          data: twoSeriesData,
          x: "date",
          series: ["a", "b"],
          tooltip: { focus: true },
          // No legend: AutoChart auto-enables one for ≥2 series that aren't
          // all end-labelled (RM-118) — forced off here so this exercises
          // `SeriesFocusTargets`, the fallback keyboard target, not a real
          // legend's own `onFocus`/`onBlur`.
          legend: false,
        }}
        height={280}
      />,
    );

    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();

    await waitFor(() => {
      expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
    });
    const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
    const seriesAGroup = paths[0]?.closest("g");
    const seriesBGroup = paths[1]?.closest("g");

    const focusTargets = container.querySelectorAll('[data-slot="series-focus-target"]');
    await waitFor(() => expect(focusTargets.length).toBe(2));

    const seriesBTarget = focusTargets[1] as HTMLButtonElement;
    fireEvent.focus(seriesBTarget);

    await waitFor(() => {
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    });

    fireEvent.blur(seriesBTarget);

    await waitFor(() => {
      expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
    });
  });
});

// A dashboard chart tile is `ChartFrame chrome="tile"` with no plot height: the
// frame hands its chart "fill", i.e. `height: 100%`. That only resolves when
// EVERY box from the frame body down to the plot is definite — an auto-height
// link collapses the plot to 0 px and no bars render (wave-0 gate, cluster B).
describe("AutoChart inside a fill-host tile", () => {
  const definite = (el: HTMLElement) =>
    el.style.height !== "" || /(^|\s)(h-full|size-full|flex-1)(\s|$)/.test(el.className);

  it.each([
    ["bar", { type: "bar", x: "region", series: [{ key: "revenue" }] }],
    ["heatmap", { type: "heatmap", x: "hour", series: [{ key: "count" }] }],
  ] as const)("keeps a definite height chain from the tile body to the %s plot", (_t, partial) => {
    const spec = {
      ...partial,
      data: [
        { region: "EMEA", hour: "09", day: "Mon", revenue: 41, count: 4 },
        { region: "APAC", hour: "10", day: "Tue", revenue: 30, count: 7 },
      ],
    } as unknown as ChartSpec;
    const { container } = render(
      <ChartFrame chrome="tile" title="Revenue">
        <AutoChart spec={spec} />
      </ChartFrame>,
    );
    const body = container.querySelector<HTMLElement>('[data-slot="chart-frame-body"]');
    const plots = [...container.querySelectorAll<HTMLElement>("[style]")].filter(
      (el) => el.style.height === "100%",
    );
    expect(body).not.toBeNull();
    expect(plots.length, "no fill plot box rendered").toBeGreaterThan(0);
    for (const plot of plots) {
      for (let el = plot.parentElement; el && el !== body; el = el.parentElement) {
        expect(definite(el), `auto-height link: <div class="${el.className}">`).toBe(true);
      }
    }
  });
});

// Labels — RM-110 (maintainer decision 7): the legend steps aside for a
// line/area spec only when every series gets an end label under the default.
// RM-118: `line`/`area` now render their legend through `useContainerLegend`
// (`LineChart`/`AreaChart`'s own `legend` prop, forwarded from `spec.legend`)
// instead of the plain-`<ul>` `AutoLegend` — same show/hide decision, new root.
describe("AutoChart legend vs series end labels", () => {
  const trend = [
    { date: "2024-01-01", ebikes: 10, cargo: 4 },
    { date: "2024-02-01", ebikes: 14, cargo: 6 },
    { date: "2024-03-01", ebikes: 19, cargo: 9 },
  ];
  const legendOf = (spec: ChartSpec) =>
    render(<AutoChart spec={spec} height={280} />).container.querySelector(
      '[data-slot="container-legend-root"]',
    );

  it("hides the legend when every line series has a real name", () => {
    const spec: ChartSpec = {
      type: "line",
      data: trend,
      x: "date",
      series: [
        { key: "ebikes", label: "E-bikes" },
        { key: "cargo", label: "Cargo bikes" },
      ],
    };
    expect(legendOf(spec)).toBeNull();
  });

  it("keeps the legend when a series is known only by its column name", () => {
    const spec: ChartSpec = {
      type: "line",
      data: trend,
      x: "date",
      series: [{ key: "ebikes", label: "E-bikes" }, { key: "cargo" }],
    };
    expect(legendOf(spec)).not.toBeNull();
  });

  it("keeps the legend when labels.series opts out, and hides it for an explicit end", () => {
    const base: ChartSpec = { type: "area", data: trend, x: "date", series: ["ebikes", "cargo"] };
    expect(legendOf({ ...base, labels: { series: "none" } })).not.toBeNull();
    cleanup();
    expect(legendOf({ ...base, labels: { series: "end" } })).toBeNull();
  });

  // Acceptance-4 (RM-118, orchestrator ruling): AutoChart never calls
  // `useContainerLegend` itself — it only forwards `spec.legend` into
  // `LineChart`'s own `legend` prop. Proving DOM equality of the rendered
  // legend (not the plot, which AutoChart and this comparison compose from
  // different children — `Grid`, `ChartTooltip`, axes — on purpose) against a
  // `LineChart` built by hand with the SAME normalized series (key-only
  // labels → `var(--chart-N)` palette colors, same order) is proof that
  // forwarding, not a second implementation, is what produces the legend.
  it("renders the identical legend DOM as calling LineChart directly with the same series (Acceptance-4)", () => {
    const spec: ChartSpec = {
      type: "line",
      data: trend,
      x: "date",
      series: [{ key: "ebikes" }, { key: "cargo" }],
    };
    const auto = render(<AutoChart spec={spec} height={280} />);
    const autoLegend = auto.container.querySelector(
      '[data-slot="container-legend-root"] .legend-container',
    );
    expect(autoLegend).not.toBeNull();
    cleanup();

    const explicit = render(
      <LineChart data={trend} xDataKey="date" legend>
        <Line dataKey="ebikes" name="ebikes" stroke="var(--chart-1)" />
        <Line dataKey="cargo" name="cargo" stroke="var(--chart-2)" />
      </LineChart>,
    );
    const explicitLegend = explicit.container.querySelector(
      '[data-slot="container-legend-root"] .legend-container',
    );
    expect(explicitLegend).not.toBeNull();

    expect(autoLegend?.outerHTML).toBe(explicitLegend?.outerHTML);
  });

  // Task 3(a)/(c) (sitting 3): the pre-existing suite above only ever
  // selected `[data-slot="container-legend-root"]` — this locks in the
  // accessible-name parity that selector swap (from AutoLegend's old
  // `ul[aria-label="Chart legend"]`) must not have lost. `AutoLegend` gave
  // its `<ul>` role "list" (native) plus this SAME name; `ChartLegend`'s
  // root is a plain `<div>` with no ARIA list role, so the engine instead
  // exposes `role="group"` + the identical name (`chart-legend.tsx`'s new
  // `aria-label` prop, `use-container-legend.ts`'s `t("charts.legend.label")`
  // default) — see the result file's "Existing keys" section for the full
  // base-vs-branch accessibility-tree comparison (role/name/item count).
  it("keeps an accessible name on the legend after the AutoLegend → engine swap (Acceptance-4, a11y)", () => {
    const spec: ChartSpec = {
      type: "line",
      data: trend,
      x: "date",
      series: [{ key: "ebikes" }, { key: "cargo" }],
    };
    const { getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    // Item count parity with the old `<li>`-per-series `AutoLegend`.
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
  });

  // RM-118 Part B: 'bar' and 'pie' join the container legend engine this
  // wave (see `LEGEND_ENGINE_TYPES`) — same accessible name + item-count
  // parity proof as 'line' above, one per family.
  it("keeps the 'Chart legend' name and item-count parity for 'bar' (RM-118 Part B)", () => {
    const spec: ChartSpec = {
      type: "bar",
      data: categoricalData,
      x: "name",
      series: ["value", "other"],
    };
    const { getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
  });

  it("keeps the 'Chart legend' name and item-count parity for 'pie' (RM-118 Part B)", () => {
    const spec: ChartSpec = {
      type: "pie",
      data: smallPositiveData,
      x: "label",
      series: ["count"],
    };
    const { getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    // One legend row per pie ROW (slice), not per series — `smallPositiveData`
    // is declared further up this file for the existing 'pie' tests.
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(smallPositiveData.length);
  });

  it("keeps the 'Chart legend' name and item-count parity for 'scatter' (RM-118 Part B)", () => {
    const spec: ChartSpec = {
      type: "scatter",
      data: [
        { x: 1, y: 10, z: 5 },
        { x: 2, y: 20, z: 8 },
        { x: 3, y: 15, z: 12 },
      ],
      x: "x",
      xType: "number",
      series: ["y", "z"],
    };
    const { getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
  });

  it("keeps the 'Chart legend' name and item-count parity for 'treemap' (RM-118 Part B)", () => {
    // `palette: "categorical"` is required here: AutoChart's treemap branch
    // falls back to the documented "mono" default otherwise (#306), and a
    // mono treemap has nothing to key — no legend at all, by design. jsdom
    // never sizes the plot (`getBoundingClientRect` is 0 unmocked), so the
    // layout — and with it every legend item — mock the same way the
    // existing "AutoChart treemap palette" describe block above does.
    // `legend: true` is explicit: AutoChart's own default-visibility
    // heuristic (`showLegend`) keys off the normalized SERIES count, which
    // is 0 for a hierarchy-shaped treemap spec — unlike bar/pie/scatter,
    // treemap never defaults to a visible legend, so this proves the
    // forwarded prop actually reaches `TreemapChart`, not the default.
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    } as DOMRect);
    const spec: ChartSpec = {
      type: "treemap",
      data: [],
      x: "name",
      series: [],
      palette: "categorical",
      legend: true,
      hierarchy: {
        name: "Work",
        children: [
          { name: "Platform", children: [{ name: "CI", value: 40 }] },
          { name: "Product", children: [{ name: "Onboarding", value: 25 }] },
        ],
      },
    };
    const { getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    // One legend row per top-level GROUP ("Platform", "Product"), not per leaf.
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
    spy.mockRestore();
  });

  it("#610: a 2-series inferred 'dumbbell' spec with legend:true takes the shared engine legend, not AutoLegend", () => {
    // Owner decision (2026-09-23, #610 "MAKE ALL MATCH"): the two-marker
    // dumbbell reads (`dumbbell`/`slope`/`arrow`) key their ends by marker
    // SHAPE (hollow start / filled end) rather than by category colour, so
    // the shared legend now draws a two-entry start/end key instead of
    // `AutoLegend`'s old before/after `<li>` list — see `DumbbellChart`'s
    // `legend` prop doc and `LegendItem.marker: "hollow"` (`chart-legend.tsx`).
    // This test replaces the old "keeps dumbbell OUT of the legend engine"
    // pin, which locked in exactly the behaviour #610 asks to change.
    const spec: ChartSpec = {
      type: "dumbbell",
      data: [
        { region: "North", before: 42, after: 61 },
        { region: "South", before: 31, after: 46 },
      ],
      x: "region",
      series: ["before", "after"],
      legend: true,
    };
    const { container, queryByRole } = render(<AutoChart spec={spec} height={280} />);
    expect(container.querySelector("ul[aria-label]")).toBeNull();
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    const legend = queryByRole("group", { name: "Chart legend" });
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain("before");
    expect(legend?.textContent).toContain("after");
    // Shape channel (WCAG 1.4.1): the start ("before") entry's swatch is the
    // hollow ring, the end ("after") entry's is the plain filled dot — a
    // DOM-observable difference, not colour alone (both share one neutral ink).
    const hollow = legend?.querySelectorAll('[data-marker="hollow"]');
    expect(hollow).toHaveLength(1);
  });

  it("#610: the same spec with legend left unset still shows the engine legend by the existing >1-series default", () => {
    // The same "before"/"after" spec as the published
    // `charts-autochart--dumbbell-inferred` story: `legend` unset, 2 series,
    // so the pre-existing `showLegend` heuristic
    // (`spec.legend ?? legendItems.length > 1 && …`) already defaulted to
    // `true` before #610 — only WHICH legend renders changed (engine, not
    // AutoLegend), not whether one renders at all.
    const spec: ChartSpec = {
      type: "dumbbell",
      data: [
        { region: "North", before: 42, after: 61 },
        { region: "South", before: 31, after: 46 },
      ],
      x: "region",
      series: ["before", "after"],
    };
    const { container, queryByRole } = render(<AutoChart spec={spec} height={280} />);
    expect(container.querySelector("ul[aria-label]")).toBeNull();
    const legend = queryByRole("group", { name: "Chart legend" });
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain("before");
    expect(legend?.textContent).toContain("after");
  });
});

// Facet + legend engine (RM-118 × RM-120, orchestrator ruling after the
// wave-2 merge): before the merge, a faceted line/area AutoChart with
// `legend` set rendered one shared `AutoLegend` below the grid; the merge
// dropped it entirely (see the result file's "Wave-2 merge" section). This
// restores it, as ONE shared `ChartLegend` — not `AutoLegend` — above the
// grid, matching the maintainer's "new shared look" for every other family.
describe("AutoChart faceted line legend (RM-118 × RM-120 regression fix)", () => {
  const facetedTrend = [
    { date: "2024-01-01", region: "East", ebikes: 10, cargo: 4 },
    { date: "2024-02-01", region: "East", ebikes: 14, cargo: 6 },
    { date: "2024-01-01", region: "West", ebikes: 8, cargo: 3 },
    { date: "2024-02-01", region: "West", ebikes: 12, cargo: 5 },
  ];
  const facetedSpec = (legend: ChartSpec["legend"]): ChartSpec => ({
    type: "line",
    data: facetedTrend,
    x: "date",
    series: [{ key: "ebikes" }, { key: "cargo" }],
    facet: { by: "region" },
    legend,
  });

  it("legend: true → exactly one shared 'Chart legend' group with 2 items, above the grid", () => {
    const { container, getAllByRole } = render(<AutoChart spec={facetedSpec(true)} height={280} />);
    const groups = getAllByRole("group", { name: "Chart legend" });
    expect(groups).toHaveLength(1);
    const legend = groups[0];
    if (!legend) throw new Error("expected exactly one 'Chart legend' group");
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "ebikes",
      "cargo",
    ]);

    // "above the grid": the legend root is the grid's previous sibling, not
    // a per-panel legend inside it and not a second one below it.
    const root = container.querySelector('[data-slot="auto-chart-facet-legend-root"]');
    expect(root).not.toBeNull();
    const grid = root?.querySelector('[data-slot="chart-multiples"]');
    expect(grid).not.toBeNull();
    expect(legend.nextElementSibling).toBe(grid);
    expect(grid?.querySelectorAll('[role="group"][aria-label="Chart legend"]')).toHaveLength(0);
  });

  it("legend: false → no legend at all", () => {
    const { queryAllByRole, container } = render(
      <AutoChart spec={facetedSpec(false)} height={280} />,
    );
    expect(queryAllByRole("group", { name: "Chart legend" })).toHaveLength(0);
    expect(container.querySelector('[data-slot="auto-chart-facet-legend-root"]')).toBeNull();
  });
});

// RM-118 Part B × RM-120, sitting 2 (integration): once 'bar' and 'pie' join
// `LEGEND_ENGINE_TYPES` (this branch), the generic `showFacetLegend` check in
// `AutoChart` already covers them for free — `FACETED_CHART_TYPES ∩
// LEGEND_ENGINE_TYPES` is exactly line/area/bar/pie. Same regression class
// Part A fixed for line/area: an `AutoChart`-driven facet whose legend is
// shown gets ONE shared `ChartLegend` above the grid, never one per panel.
describe("AutoChart faceted bar legend (RM-118 Part B × RM-120 sitting 2)", () => {
  const facetedSales = [
    { quarter: "Q1", region: "North", revenue: 40, profit: 12 },
    { quarter: "Q2", region: "North", revenue: 44, profit: 14 },
    { quarter: "Q1", region: "South", revenue: 30, profit: 9 },
    { quarter: "Q2", region: "South", revenue: 33, profit: 10 },
  ];
  const facetedBarSpec = (legend: ChartSpec["legend"]): ChartSpec => ({
    type: "bar",
    data: facetedSales,
    x: "quarter",
    series: [{ key: "revenue" }, { key: "profit" }],
    facet: { by: "region" },
    legend,
  });

  it("legend: true → exactly one shared 'Chart legend' group with 2 items, above the grid", () => {
    const { container, getAllByRole } = render(
      <AutoChart spec={facetedBarSpec(true)} height={280} />,
    );
    const groups = getAllByRole("group", { name: "Chart legend" });
    expect(groups).toHaveLength(1);
    const legend = groups[0];
    if (!legend) throw new Error("expected exactly one 'Chart legend' group");
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(2);
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "revenue",
      "profit",
    ]);

    const root = container.querySelector('[data-slot="auto-chart-facet-legend-root"]');
    expect(root).not.toBeNull();
    const grid = root?.querySelector('[data-slot="chart-multiples"]');
    expect(grid).not.toBeNull();
    expect(legend.nextElementSibling).toBe(grid);
    // A per-panel FAIL would show a second group inside the grid — assert none.
    expect(grid?.querySelectorAll('[role="group"][aria-label="Chart legend"]')).toHaveLength(0);
  });

  it("legend: false → no legend at all", () => {
    const { queryAllByRole, container } = render(
      <AutoChart spec={facetedBarSpec(false)} height={280} />,
    );
    expect(queryAllByRole("group", { name: "Chart legend" })).toHaveLength(0);
    expect(container.querySelector('[data-slot="auto-chart-facet-legend-root"]')).toBeNull();
  });

  // RM-118 fix round 2: `renderFacetedChart` mounts its own direct
  // `<ChartLegend>` for this one shared legend — a separate call site from
  // `useContainerLegend`'s (the non-faceted path), so the round-1 source fix
  // there didn't cover it. This row must reach the same `text-meta` role,
  // never `ChartLegend`'s own bare-caller default.
  it("legend: true → the shared legend label reaches the text-meta role, never text-sm/text-xs", () => {
    const { getAllByRole } = render(<AutoChart spec={facetedBarSpec(true)} height={280} />);
    const groups = getAllByRole("group", { name: "Chart legend" });
    expect(groups).toHaveLength(1);
    const legend = groups[0];
    if (!legend) throw new Error("expected exactly one 'Chart legend' group");
    const rows = legend.querySelectorAll(":scope > *");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const label = row.querySelector("span");
      expect(label).toHaveClass("text-meta");
      expect(label).not.toHaveClass("text-sm");
      expect(label).not.toHaveClass("text-xs");
    }
  });
});

describe("AutoChart faceted pie legend (RM-118 Part B × RM-120 sitting 2)", () => {
  // Two panels (region), same 3 channels in both — the shared legend must
  // list each CATEGORY once (deduped across panels), not once per panel and
  // not the value column ("share"). This is the exact shape that was broken
  // before the `legendItems`-not-`series` fix: `series` here normalizes to a
  // single "share" entry, never the 3 channel names.
  const facetedChannels = [
    { region: "North", channel: "Direct", share: 42 },
    { region: "North", channel: "Organic", share: 33 },
    { region: "North", channel: "Referral", share: 25 },
    { region: "South", channel: "Direct", share: 38 },
    { region: "South", channel: "Organic", share: 36 },
    { region: "South", channel: "Referral", share: 26 },
  ];
  const facetedPieSpec = (legend: ChartSpec["legend"]): ChartSpec => ({
    type: "pie",
    data: facetedChannels,
    x: "channel",
    series: ["share"],
    facet: { by: "region" },
    legend,
  });

  it("legend: true → exactly one shared 'Chart legend' group with one item per category, above the grid", () => {
    const { container, getAllByRole } = render(
      <AutoChart spec={facetedPieSpec(true)} height={280} />,
    );
    const groups = getAllByRole("group", { name: "Chart legend" });
    expect(groups).toHaveLength(1);
    const legend = groups[0];
    if (!legend) throw new Error("expected exactly one 'Chart legend' group");
    // One item per CATEGORY (Direct/Organic/Referral), deduped across the two
    // panels — not 6 (one per data row) and not 1 (the "share" value column).
    expect(legend.querySelectorAll(":scope > *")).toHaveLength(3);
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "Direct",
      "Organic",
      "Referral",
    ]);

    const root = container.querySelector('[data-slot="auto-chart-facet-legend-root"]');
    expect(root).not.toBeNull();
    const grid = root?.querySelector('[data-slot="chart-multiples"]');
    expect(grid).not.toBeNull();
    expect(legend.nextElementSibling).toBe(grid);
    // A per-panel FAIL would show a second group inside the grid — assert none.
    expect(grid?.querySelectorAll('[role="group"][aria-label="Chart legend"]')).toHaveLength(0);
  });

  it("legend: false → no legend at all", () => {
    const { queryAllByRole, container } = render(
      <AutoChart spec={facetedPieSpec(false)} height={280} />,
    );
    expect(queryAllByRole("group", { name: "Chart legend" })).toHaveLength(0);
    expect(container.querySelector('[data-slot="auto-chart-facet-legend-root"]')).toBeNull();
  });
});

// BarChart — RM-113: the comparison label mode is a ChartLabelsSpec field.
describe("AutoChart bar comparison labels", () => {
  const sales = [
    { region: "North", now: 40, prev: 22 },
    { region: "South", now: 18, prev: 27 },
  ];

  // The comparison labels are gated behind BarChart's own enter-reveal gate
  // (`useChartRevealGate`, default `revealOn="mount"`): they only paint once
  // `isLoaded` flips true, on a real `setTimeout(animationDuration)` (default
  // 1100ms) that AutoChart has no prop to shorten (#488). A real-clock
  // `waitFor` raced that timer against whatever else was on the machine and
  // sometimes lost; `bar-chart-reveal.test.tsx` already drives the same gate
  // deterministically with fake timers — same seam here.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Longer than BarChart's default 1100ms reveal, so it has settled. */
  const PAST_REVEAL_MS = 1500;

  it("paints grey difference labels from labels.comparison and none without it", () => {
    const spec: ChartSpec = {
      type: "bar",
      data: sales,
      x: "region",
      series: ["now"],
      comparison: { key: "prev" },
    };
    const { container } = render(
      <AutoChart spec={{ ...spec, labels: { comparison: "difference" } }} />,
    );
    // Settle the bars' enter animation deterministically instead of racing it.
    act(() => {
      vi.advanceTimersByTime(PAST_REVEAL_MS);
    });
    const labels = [...container.querySelectorAll('[data-slot="bar-chart-comparison-label"]')].map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(["+18", "−9"]);
    cleanup();
    const plain = render(<AutoChart spec={spec} />);
    act(() => {
      vi.advanceTimersByTime(PAST_REVEAL_MS);
    });
    expect(
      plain.container.querySelectorAll('[data-slot="bar-chart-comparison-label"]'),
    ).toHaveLength(0);
  });
});

// RM-122 — `ChartSpec.groupBy` (the one shared grouping field) maps to
// `WaterfallChart subtotalBy` for `type: "waterfall"`; there is no separate
// `ChartSpec.subtotalBy` (one field per concept).
describe("AutoChart waterfall groupBy → subtotalBy (RM-122)", () => {
  // AutoChart's own `kind` classifier (`readsAsTotalRow`) is regex-based on
  // the label text — it never reads a `kind` field off the raw spec row — so
  // "Opening"/"Closing" render as plain steps here, same as any other row.
  const quarters = [
    { stage: "Opening", value: 1000 },
    { stage: "Jan", value: 50, quarter: "Q1" },
    { stage: "Feb", value: 30, quarter: "Q1" },
    { stage: "Apr", value: 20, quarter: "Q2" },
    { stage: "May", value: -5, quarter: "Q2" },
    { stage: "Closing", value: 1095 },
  ];

  it("groupBy auto-inserts a subtotal checkpoint per group, filled like a total", () => {
    const spec: ChartSpec = {
      type: "waterfall",
      data: quarters,
      x: "stage",
      series: ["value"],
      groupBy: "quarter",
    };
    const { container } = render(<AutoChart spec={spec} />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    // 6 data rows + Q1/Q2 auto-inserted subtotals.
    expect(steps).toHaveLength(8);
    const totalFillSteps = [...steps].filter(
      (el) => el.getAttribute("fill") === "var(--chart-foreground)",
    );
    // Only the Q1/Q2 auto-inserted subtotals read as totals — "Opening" and
    // "Closing" don't match the total-label regex, so they stay plain steps.
    expect(totalFillSteps).toHaveLength(2);
  });

  it("without groupBy, no subtotal is inserted", () => {
    const spec: ChartSpec = {
      type: "waterfall",
      data: quarters,
      x: "stage",
      series: ["value"],
    };
    const { container } = render(<AutoChart spec={spec} />);
    // One step per row, no auto-inserted subtotal.
    expect(container.querySelectorAll('[data-slot="waterfall-chart-step"]')).toHaveLength(
      quarters.length,
    );
  });
});

// Dual-axis — RM-121
describe('AutoChart type "dual-axis" validation (RM-121)', () => {
  const data = [
    { month: "2024-01-01", orders: 182, conversion: 2.4 },
    { month: "2024-02-01", orders: 236, conversion: 3.1 },
  ];

  it("renders ChartFallback kind=unsupported when no series is a line", () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "dual-axis",
          data,
          x: "month",
          series: [
            { key: "orders", mark: "column" },
            { key: "conversion", mark: "area", axis: "right" },
          ],
        }}
      />,
    );
    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  });

  it("renders ChartFallback kind=unsupported for columns on the right axis", () => {
    const { container } = render(
      <AutoChart
        spec={{
          type: "dual-axis",
          data,
          x: "month",
          series: [{ key: "orders", mark: "column", axis: "right" }, { key: "conversion" }],
        }}
      />,
    );
    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  });

  it("is never inferred", () => {
    expect(
      inferChartType({
        data,
        x: "month",
        series: [
          { key: "orders", mark: "column" },
          { key: "conversion", axis: "right" },
        ],
      }),
    ).not.toBe("dual-axis");
  });
});

// Choropleth — RM-124
describe('AutoChart type "choropleth" (RM-124)', () => {
  const rows = [
    { code: "A", region: "Alpha", cooling: 120 },
    { code: "B", region: "Beta", cooling: 40 },
  ];
  const spec = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: "choropleth",
    geo: choroplethGeo,
    match: { row: "code", feature: "id" },
    data: rows,
    x: "region",
    series: ["cooling"],
    ...extra,
  });
  const regions = (container: HTMLElement) => [
    ...container.querySelectorAll(".choropleth-features path"),
  ];

  it("joins rows to regions by `match` and colours them from `scale`", () => {
    const { container } = render(
      <AutoChart spec={spec({ scale: { type: "stepped", steps: 2 } })} />,
    );
    const fills = regions(container).map((path) => path.getAttribute("fill"));
    expect(fills).toHaveLength(2);
    // Two values, two classes: token references, and not the same one.
    for (const fill of fills) expect(fill).toMatch(/^var\(--chart-/);
    expect(new Set(fills).size).toBe(2);
  });

  it("joins on `spec.x` and the feature id when `match` is omitted", () => {
    const { container } = render(
      <AutoChart
        spec={spec({
          match: undefined,
          x: "code",
          scale: { key: "cooling", type: "stepped", steps: 2 },
        })}
      />,
    );
    // No `match`: `row` falls back to `spec.x` ("code") and `feature` to "id",
    // so both regions still find their row and take two different classes.
    const fills = regions(container).map((path) => path.getAttribute("fill"));
    expect(new Set(fills).size).toBe(2);
  });

  it("leaves a region with no row at the no-data fill", () => {
    const { container } = render(
      <AutoChart spec={spec({ data: [rows[0] as Record<string, unknown>] })} />,
    );
    const fills = regions(container).map((path) => path.getAttribute("fill"));
    expect(fills).toHaveLength(2);
    // The unjoined region paints the no-data ink, never a ramp token.
    expect(fills.filter((fill) => fill?.startsWith("var(--chart-"))).toHaveLength(1);
  });

  it("renders ChartFallback kind=unsupported without a map", () => {
    const { container } = render(<AutoChart spec={spec({ geo: undefined })} />);
    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  });

  it("renders ChartFallback kind=unsupported for a bundled map it does not have", () => {
    const { container } = render(
      <AutoChart spec={spec({ geo: "atlantis" as unknown as ChartSpec["geo"] })} />,
    );
    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull();
  });

  it("loads a named fixture on demand, announcing the wait", async () => {
    const { container } = render(
      <AutoChart
        spec={spec({
          geo: "us-states",
          match: { row: "code", feature: "id" },
          data: [
            { code: "CA", region: "California", cooling: 120 },
            { code: "TX", region: "Texas", cooling: 40 },
          ],
        })}
      />,
    );
    // The map is a dynamic import, so the first paint is the status skeleton.
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(regions(container).length).toBeGreaterThan(10));
  });

  it("draws proportional symbols from `symbols`, sqrt-scaled", () => {
    const { container } = render(
      <AutoChart spec={spec({ symbols: { key: "cooling", sizeKey: "cooling" } })} />,
    );
    const radii = [...container.querySelectorAll('[data-slot="choropleth-symbol"]')]
      .map((node) => Number(node.getAttribute("data-radius")))
      .sort((a, b) => b - a);
    expect(radii).toHaveLength(2);
    const [largest = 0, smallest = 0] = radii;
    // 120 : 40 is 3×, so the radius ratio is √3.
    expect(largest / smallest).toBeCloseTo(Math.sqrt(3), 2);
  });

  it("is never inferred", () => {
    expect(inferChartType({ data: rows, x: "region", series: ["cooling"] })).not.toBe("choropleth");
  });
});

// #610 — the shared facet legend drives every panel; radar, funnel and the
// dots dumbbell render through the container legend engine, not AutoLegend.
describe("AutoChart legend parity and faceted interactivity (#610)", () => {
  const sales = [
    { quarter: "Q1", region: "North", revenue: 40, profit: 12 },
    { quarter: "Q2", region: "North", revenue: 44, profit: 14 },
    { quarter: "Q1", region: "South", revenue: 30, profit: 9 },
    { quarter: "Q2", region: "South", revenue: 33, profit: 10 },
  ];
  const facetedBar = (legend: ChartSpec["legend"]): ChartSpec => ({
    type: "bar",
    data: sales,
    x: "quarter",
    series: [
      { key: "revenue", color: "var(--chart-1)" },
      { key: "profit", color: "var(--chart-2)" },
    ],
    facet: { by: "region" },
    legend,
  });
  const panels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-slot="chart-multiples"] > *'));
  const opacities = (root: Element, fill: string) =>
    Array.from(root.querySelectorAll(`rect[fill="${fill}"]`)).map((r) => r.getAttribute("opacity"));

  // BarChart paints its bars behind its enter-reveal gate
  // (`useChartRevealGate`), a real `setTimeout` of its default 1100ms that
  // AutoChart has no prop to shorten (#488). A real-clock `waitFor` raced it
  // and often lost; drive it with fake timers, the same seam the
  // `labels.comparison` tests above use.
  describe("the shared facet legend drives every panel", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Longer than BarChart's default 1100ms reveal, so it has settled. */
    const PAST_REVEAL_MS = 1500;
    const settle = () =>
      act(() => {
        vi.advanceTimersByTime(PAST_REVEAL_MS);
      });

    it("hovering a shared legend item dims the other series in EVERY panel", () => {
      const { container, getByRole } = render(<AutoChart spec={facetedBar(true)} height={280} />);
      settle();
      const legend = getByRole("group", { name: "Chart legend" });
      const items = legend.querySelectorAll(":scope > button");
      expect(items).toHaveLength(2);
      expect(panels(container)).toHaveLength(2);
      for (const panel of panels(container)) {
        expect(opacities(panel, "var(--chart-1)").length).toBeGreaterThan(0);
        expect(opacities(panel, "var(--chart-1)").every((o) => o === "1")).toBe(true);
      }

      fireEvent.mouseEnter(items[1] as Element);
      settle();
      for (const panel of panels(container)) {
        expect(opacities(panel, "var(--chart-1)").every((o) => o === "0.3")).toBe(true);
        expect(opacities(panel, "var(--chart-2)").every((o) => o === "1")).toBe(true);
      }

      fireEvent.mouseLeave(items[1] as Element);
      settle();
      for (const panel of panels(container)) {
        expect(opacities(panel, "var(--chart-1)").every((o) => o === "1")).toBe(true);
      }
    });

    it("interactive: 'toggle' hides the series from every panel", () => {
      const { container, getByRole } = render(
        <AutoChart spec={facetedBar({ interactive: "toggle" })} height={280} />,
      );
      settle();
      const legend = getByRole("group", { name: "Chart legend" });
      const profit = Array.from(legend.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("profit"),
      );
      expect(profit).toBeDefined();
      for (const panel of panels(container)) {
        expect(opacities(panel, "var(--chart-2)").length).toBeGreaterThan(0);
      }
      fireEvent.click(profit as Element);
      settle();
      expect(profit?.getAttribute("aria-pressed")).toBe("false");
      expect(panels(container)).toHaveLength(2);
      for (const panel of panels(container)) {
        expect(opacities(panel, "var(--chart-2)")).toHaveLength(0);
        expect(opacities(panel, "var(--chart-1)").length).toBeGreaterThan(0);
      }
    });
  });

  it("radar renders the engine legend (one item per polygon), not AutoLegend", () => {
    const spec: ChartSpec = {
      type: "radar",
      data: [
        { metric: "Speed", a: 80, b: 60 },
        { metric: "Range", a: 50, b: 90 },
        { metric: "Price", a: 70, b: 40 },
      ],
      x: "metric",
      series: [
        { key: "a", label: "Model A" },
        { key: "b", label: "Model B" },
      ],
    };
    const { container, getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "Model A",
      "Model B",
    ]);
    expect(container.querySelector("ul[aria-label]")).toBeNull();
  });

  it("funnel renders the engine legend for its one measure when asked, not AutoLegend", () => {
    const spec: ChartSpec = {
      type: "funnel",
      data: [
        { stage: "Visit", users: 1000 },
        { stage: "Sign-up", users: 400 },
        { stage: "Paid", users: 90 },
      ],
      x: "stage",
      series: [{ key: "users", label: "Users" }],
      legend: true,
    };
    const { container, getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "Users",
    ]);
    expect(container.querySelector("ul[aria-label]")).toBeNull();
  });

  it("dots dumbbell: ChartSpec.valueKeys reaches DumbbellChart and gets the engine legend", () => {
    const spec: ChartSpec = {
      type: "dumbbell",
      variant: "dots",
      data: [
        { team: "Core", low: 10, mid: 20, high: 30 },
        { team: "Edge", low: 12, mid: 18, high: 26 },
      ],
      x: "team",
      series: ["low", "high"],
      valueKeys: ["low", "mid", "high"],
      legend: true,
    };
    const { container, getByRole } = render(<AutoChart spec={spec} height={280} />);
    const legend = getByRole("group", { name: "Chart legend" });
    expect(Array.from(legend.querySelectorAll(":scope > *")).map((el) => el.textContent)).toEqual([
      "low",
      "mid",
      "high",
    ]);
    expect(container.querySelector("ul[aria-label]")).toBeNull();
    expect(container.querySelectorAll('[data-dot-key="mid"]').length).toBeGreaterThan(0);
  });
});
