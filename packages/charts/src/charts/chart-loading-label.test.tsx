/**
 * ChartLoadingLabel — its words come from the chart's messages (wave-3 review F3).
 *
 * Every family that renders the label itself passes `charts.chart.loading` through its own
 * `useChartTranslate()`, so a chart's `messages` override (and the `LocaleProvider`) reach the
 * loading announcement. The component keeps its literal `"Loading"` default for a caller that
 * renders it bare.
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@elabs-ai/components-ui";

import { HEATMAP_CHART_FIXTURE } from "../definitions/__fixtures__/heatmap-chart.fixture";
import { NETWORK_CHART_FIXTURE } from "../definitions/__fixtures__/network-chart.fixture";
import { PARALLEL_COORDINATES_CHART_FIXTURE } from "../definitions/__fixtures__/parallel-coordinates-chart.fixture";
import { SANKEY_CHART_FIXTURE } from "../definitions/__fixtures__/sankey-chart.fixture";
import { TREE_CHART_FIXTURE } from "../definitions/__fixtures__/tree-chart.fixture";
import { TREEMAP_CHART_FIXTURE } from "../definitions/__fixtures__/treemap-chart.fixture";
import { ChartLoadingLabel } from "./chart-loading-label";
import { HeatmapChart, type HeatmapChartProps } from "./heatmap/heatmap-chart";
import { NetworkChart, type NetworkChartProps } from "./network/network-chart";
import {
  ParallelCoordinatesChart,
  type ParallelCoordinatesChartProps,
} from "./parallel-coordinates/parallel-coordinates-chart";
import { SankeyChart, type SankeyChartProps } from "./sankey/sankey-chart";
import { TreeChart, type TreeChartProps } from "./tree-chart";
import { TreemapChart, type TreemapChartProps } from "./treemap/treemap-chart";

// jsdom lays nothing out: give every element one box, so a family that draws its body only
// once measured (Heatmap's `ChartParentSize`) reaches its loading label.
const BOX = { width: 640, height: 400 };
const RECT = { ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0 };

beforeAll(() => {
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: RECT } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...RECT,
    toJSON: () => ({}),
  } as DOMRect);
  for (const [prop, value] of [
    ["clientWidth", BOX.width],
    ["clientHeight", BOX.height],
    ["offsetWidth", BOX.width],
    ["offsetHeight", BOX.height],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value });
  }
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(cleanup);

const OVERRIDE = "Diagramm lädt…";
const messages = { "charts.chart.loading": OVERRIDE };

/**
 * The per-chart `messages` path. ParallelCoordinatesChart is absent: it has no `messages` prop
 * (it never adopted the messages group), so its only override path is the `LocaleProvider` —
 * covered for every family by the second suite below.
 */
const CASES: readonly [string, () => ReactElement][] = [
  [
    "TreemapChart",
    () => (
      <TreemapChart
        {...(TREEMAP_CHART_FIXTURE.props as TreemapChartProps)}
        messages={messages}
        status="loading"
      />
    ),
  ],
  [
    "TreeChart",
    () => (
      <TreeChart
        {...(TREE_CHART_FIXTURE.props as TreeChartProps)}
        messages={messages}
        status="loading"
      />
    ),
  ],
  [
    "SankeyChart",
    () => (
      <SankeyChart
        {...(SANKEY_CHART_FIXTURE.props as SankeyChartProps)}
        messages={messages}
        status="loading"
      />
    ),
  ],
  [
    "NetworkChart",
    () => (
      <NetworkChart
        {...(NETWORK_CHART_FIXTURE.props as NetworkChartProps)}
        messages={messages}
        status="loading"
      />
    ),
  ],
  [
    // Heatmap's loading switch is `loading`, not `status` (its definition's own field).
    "HeatmapChart",
    () => (
      <HeatmapChart
        {...(HEATMAP_CHART_FIXTURE.props as HeatmapChartProps)}
        loading
        messages={messages}
      />
    ),
  ],
];

/** The same families, loading, with no per-chart override — for the `LocaleProvider` path. */
const LOADING: readonly [string, () => ReactElement][] = [
  [
    "TreemapChart",
    () => <TreemapChart {...(TREEMAP_CHART_FIXTURE.props as TreemapChartProps)} status="loading" />,
  ],
  [
    "TreeChart",
    () => <TreeChart {...(TREE_CHART_FIXTURE.props as TreeChartProps)} status="loading" />,
  ],
  [
    "SankeyChart",
    () => <SankeyChart {...(SANKEY_CHART_FIXTURE.props as SankeyChartProps)} status="loading" />,
  ],
  [
    "NetworkChart",
    () => <NetworkChart {...(NETWORK_CHART_FIXTURE.props as NetworkChartProps)} status="loading" />,
  ],
  [
    "ParallelCoordinatesChart",
    () => (
      <ParallelCoordinatesChart
        {...(PARALLEL_COORDINATES_CHART_FIXTURE.props as ParallelCoordinatesChartProps)}
        status="loading"
      />
    ),
  ],
  [
    "HeatmapChart",
    () => <HeatmapChart {...(HEATMAP_CHART_FIXTURE.props as HeatmapChartProps)} loading />,
  ],
];

describe("ChartLoadingLabel reads the chart's messages (wave-3 review F3)", () => {
  it.each(CASES)("%s announces a per-chart `messages` override while loading", (_name, chart) => {
    render(chart());
    expect(screen.getByText(OVERRIDE)).toBeInTheDocument();
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it.each(LOADING)("%s announces a `LocaleProvider` override while loading", (_name, chart) => {
    render(
      <LocaleProvider locale="de-DE" messages={messages}>
        {chart()}
      </LocaleProvider>,
    );
    expect(screen.getByText(OVERRIDE)).toBeInTheDocument();
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it.each(LOADING)("%s announces the catalogue's words by default", (_name, chart) => {
    render(chart());
    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
  });

  it("keeps its literal default when rendered bare (backward compatible)", () => {
    render(<ChartLoadingLabel />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});
