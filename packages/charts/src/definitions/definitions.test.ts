/**
 * The cartesian-core definitions (RM-175, ADR 0042 §5–6).
 *
 * - Completeness: every chart and part definition accounts for each of its component's
 *   props (checked at compile time by `assertDefinitionComplete`'s signature, called once per
 *   definition with its literal type), its own defaults validate, and its fixture validates.
 * - Golden contract: each chart definition's `contract` deep-equals a FROZEN fixture
 *   (`__fixtures__/contract-golden.ts`, `CONTRACT_GOLDEN`) — the object literal `test/doubles.tsx`
 *   hand-kept before RM-177, moved there verbatim. RM-177 made the double's own
 *   `CHART_CONTRACT_SPECS` derive from `CHART_DEFINITIONS` (same object, not a second copy), so
 *   comparing the two is now an identity check, not a value pin — this suite is what still pins
 *   the VALUES. A deliberate contract change (a rename touching `requiredProps`/`propNamedKeys`/…)
 *   updates `CONTRACT_GOLDEN` in the same PR; anything else failing here is a real drift.
 * - Defaults parity: rendering each fixture with every definition default passed explicitly
 *   (`resolveProps`) gives the same DOM as rendering it with none. Charts are rendered as their
 *   fixture; parts inside their fixture's host chart.
 * - Direction: no definition module imports the registry or the component bindings.
 * - `useResolvedChartProps`: aliases first, then defaults; memoised; one warning per old name.
 *
 * jsdom has no layout, so the measurement seams (`@visx/responsive`, `react-use-measure`,
 * `getBoundingClientRect`, `ResizeObserver`, `getTotalLength`) are stubbed to a fixed box, as
 * in the interaction policy test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanup, render, renderHook } from "@testing-library/react";
import { createElement, type JSXElementConstructor, type ReactNode } from "react";
import ts from "typescript";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@elabs-ai/components-ui";
import {
  type AnyComponentDefinition,
  assertDefinitionComplete,
  defineComponent,
  field,
  resetWarnOnce,
  resolveProps,
} from "@elabs-ai/components-ui/definition";

const BOX = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("@visx/responsive", async () => {
  const { createElement: h, Fragment } = await import("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => ReactNode;
    }) => h(Fragment, null, children({ width: BOX.width, height: BOX.height })),
  };
});

vi.mock("react-use-measure", () => ({
  default: () => [
    () => undefined,
    { ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0 },
  ],
}));

import { Candlestick } from "../charts/candlestick";
import { ChoroplethFeature } from "../charts/choropleth/choropleth-feature";
import { LiveLine } from "../charts/live-line";
import { PieSlice } from "../charts/pie-slice";
import { RadarArea } from "../charts/radar-area";
import { RadarAxis } from "../charts/radar-axis";
import { RadarGrid } from "../charts/radar-grid";
import { RadarLabels } from "../charts/radar-labels";
import { Ring } from "../charts/ring";
import { SeriesBar } from "../charts/series-bar";
import { SankeyLink } from "../charts/sankey/sankey-link";
import { SankeyNode } from "../charts/sankey/sankey-node";
import { useResolvedChartProps } from "../charts/use-resolved-chart-props";
import { installCanvasContextStub } from "../test/primitives";
import { AREA_FIXTURE } from "./__fixtures__/area.fixture";
import { AREA_CHART_FIXTURE } from "./__fixtures__/area-chart.fixture";
import { BAR_FIXTURE } from "./__fixtures__/bar.fixture";
import { BAR_CHART_FIXTURE } from "./__fixtures__/bar-chart.fixture";
import { BAR_VALUE_AXIS_FIXTURE } from "./__fixtures__/bar-value-axis.fixture";
import { BULLET_CHART_FIXTURE } from "./__fixtures__/bullet-chart.fixture";
import { BUMP_CHART_FIXTURE } from "./__fixtures__/bump-chart.fixture";
import { CANDLESTICK_CHART_FIXTURE } from "./__fixtures__/candlestick-chart.fixture";
import { CHART_CARD_FIXTURE } from "./__fixtures__/chart-card.fixture";
import { CHOROPLETH_CHART_FIXTURE } from "./__fixtures__/choropleth-chart.fixture";
import { COMPOSED_CHART_FIXTURE } from "./__fixtures__/composed-chart.fixture";
import { CONTRACT_GOLDEN } from "./__fixtures__/contract-golden";
import { DENSITY_SCATTER_CHART_FIXTURE } from "./__fixtures__/density-scatter-chart.fixture";
import { DISTRIBUTION_CHART_FIXTURE } from "./__fixtures__/distribution-chart.fixture";
import { DUMBBELL_CHART_FIXTURE } from "./__fixtures__/dumbbell-chart.fixture";
import { FUNNEL_CHART_FIXTURE } from "./__fixtures__/funnel-chart.fixture";
import { GANTT_FIXTURE } from "./__fixtures__/gantt.fixture";
import { GAUGE_FIXTURE } from "./__fixtures__/gauge.fixture";
import { GRID_FIXTURE } from "./__fixtures__/grid.fixture";
import { HEATMAP_CHART_FIXTURE } from "./__fixtures__/heatmap-chart.fixture";
import { LINE_FIXTURE } from "./__fixtures__/line.fixture";
import { LINE_CHART_FIXTURE } from "./__fixtures__/line-chart.fixture";
import { LIVE_LINE_CHART_FIXTURE } from "./__fixtures__/live-line-chart.fixture";
import { LIVE_X_AXIS_FIXTURE } from "./__fixtures__/live-x-axis.fixture";
import { METRIC_GRID_FIXTURE } from "./__fixtures__/metric-grid.fixture";
import { NETWORK_CHART_FIXTURE } from "./__fixtures__/network-chart.fixture";
import { PARALLEL_COORDINATES_CHART_FIXTURE } from "./__fixtures__/parallel-coordinates-chart.fixture";
import { PIE_CHART_FIXTURE } from "./__fixtures__/pie-chart.fixture";
import { RADAR_CHART_FIXTURE } from "./__fixtures__/radar-chart.fixture";
import { REFERENCE_LINE_FIXTURE } from "./__fixtures__/reference-line.fixture";
import { RING_CHART_FIXTURE } from "./__fixtures__/ring-chart.fixture";
import { SANKEY_CHART_FIXTURE } from "./__fixtures__/sankey-chart.fixture";
import { SCATTER_FIXTURE } from "./__fixtures__/scatter.fixture";
import { SCATTER_CHART_FIXTURE } from "./__fixtures__/scatter-chart.fixture";
import { SPARKLINE_FIXTURE } from "./__fixtures__/sparkline.fixture";
import { TREE_CHART_FIXTURE } from "./__fixtures__/tree-chart.fixture";
import { TREEMAP_CHART_FIXTURE } from "./__fixtures__/treemap-chart.fixture";
import type { ChartFixture, PartFixture } from "./__fixtures__/types";
import { UNIT_CHART_FIXTURE } from "./__fixtures__/unit-chart.fixture";
import { WATERFALL_CHART_FIXTURE } from "./__fixtures__/waterfall-chart.fixture";
import { X_AXIS_FIXTURE } from "./__fixtures__/x-axis.fixture";
import { Y_AXIS_FIXTURE } from "./__fixtures__/y-axis.fixture";
import { CHART_COMPONENTS, PART_COMPONENTS, SURFACE_COMPONENTS } from "./components";
import {
  CHART_DEFINITIONS,
  type ChartDefinitionId,
  PART_DEFINITIONS,
  type PartDefinitionId,
  SURFACE_DEFINITIONS,
  type SurfaceDefinitionId,
} from "./registry";

// ── Fixtures, keyed like the registry ───────────────────────────────────────

const CHART_FIXTURES: Record<ChartDefinitionId, ChartFixture> = {
  LineChart: LINE_CHART_FIXTURE,
  AreaChart: AREA_CHART_FIXTURE,
  ComposedChart: COMPOSED_CHART_FIXTURE,
  BarChart: BAR_CHART_FIXTURE,
  ScatterChart: SCATTER_CHART_FIXTURE,
  CandlestickChart: CANDLESTICK_CHART_FIXTURE,
  LiveLineChart: LIVE_LINE_CHART_FIXTURE,
  WaterfallChart: WATERFALL_CHART_FIXTURE,
  PieChart: PIE_CHART_FIXTURE,
  RingChart: RING_CHART_FIXTURE,
  FunnelChart: FUNNEL_CHART_FIXTURE,
  RadarChart: RADAR_CHART_FIXTURE,
  UnitChart: UNIT_CHART_FIXTURE,
  BulletChart: BULLET_CHART_FIXTURE,
  TreemapChart: TREEMAP_CHART_FIXTURE,
  TreeChart: TREE_CHART_FIXTURE,
  SankeyChart: SANKEY_CHART_FIXTURE,
  NetworkChart: NETWORK_CHART_FIXTURE,
  ParallelCoordinatesChart: PARALLEL_COORDINATES_CHART_FIXTURE,
  ChoroplethChart: CHOROPLETH_CHART_FIXTURE,
  HeatmapChart: HEATMAP_CHART_FIXTURE,
  Gantt: GANTT_FIXTURE,
  DistributionChart: DISTRIBUTION_CHART_FIXTURE,
  DensityScatterChart: DENSITY_SCATTER_CHART_FIXTURE,
  DumbbellChart: DUMBBELL_CHART_FIXTURE,
  BumpChart: BUMP_CHART_FIXTURE,
};

const SURFACE_FIXTURES: Record<SurfaceDefinitionId, ChartFixture> = {
  Gauge: GAUGE_FIXTURE,
  Sparkline: SPARKLINE_FIXTURE,
  ChartCard: CHART_CARD_FIXTURE,
  MetricGrid: METRIC_GRID_FIXTURE,
};

const PART_FIXTURES: Record<PartDefinitionId, PartFixture> = {
  XAxis: X_AXIS_FIXTURE,
  YAxis: Y_AXIS_FIXTURE,
  BarValueAxis: BAR_VALUE_AXIS_FIXTURE,
  LiveXAxis: LIVE_X_AXIS_FIXTURE,
  Grid: GRID_FIXTURE,
  Bar: BAR_FIXTURE,
  Line: LINE_FIXTURE,
  Area: AREA_FIXTURE,
  Scatter: SCATTER_FIXTURE,
  ReferenceLine: REFERENCE_LINE_FIXTURE,
};

/** Every component a fixture names: the registered ones, plus children with no definition yet. */
const COMPONENTS: Readonly<Record<string, JSXElementConstructor<never>>> = {
  ...CHART_COMPONENTS,
  ...PART_COMPONENTS,
  ...SURFACE_COMPONENTS,
  Candlestick,
  LiveLine,
  SeriesBar,
  // RM-176: Pie/Ring/Radar/Sankey/Choropleth children, no part definition yet.
  PieSlice,
  Ring,
  RadarGrid,
  RadarAxis,
  RadarLabels,
  RadarArea,
  SankeyNode,
  SankeyLink,
  ChoroplethFeature,
};

// ── jsdom seams ─────────────────────────────────────────────────────────────

let canvasStub: ReturnType<typeof installCanvasContextStub> | null = null;

beforeAll(() => {
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              ...BOX,
              top: 0,
              left: 0,
              right: BOX.width,
              bottom: BOX.height,
              x: 0,
              y: 0,
            },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...BOX,
    top: 0,
    left: 0,
    right: BOX.width,
    bottom: BOX.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => BOX.width,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => BOX.height,
  });
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
  canvasStub = installCanvasContextStub();
});

afterAll(() => {
  canvasStub?.restore();
  vi.restoreAllMocks();
});

afterEach(cleanup);

// ── Rendering ───────────────────────────────────────────────────────────────

type AnyProps = Readonly<Record<string, unknown>>;

function componentFor(name: string): JSXElementConstructor<AnyProps> {
  const component = COMPONENTS[name];
  if (!component) throw new Error(`No component named "${name}" for a fixture.`);
  return component as unknown as JSXElementConstructor<AnyProps>;
}

/**
 * The fixture chart, in a fixed locale. `swap` replaces one child's props: the child whose
 * props object is `swap.of` renders with `swap.with` instead.
 */
function fixtureElement(
  chart: ChartFixture,
  chartProps: AnyProps,
  swap?: { readonly of: AnyProps; readonly with: AnyProps },
) {
  const children = chart.children.map((child) =>
    createElement(
      componentFor(child.component),
      swap && child.props === swap.of ? swap.with : child.props,
    ),
  );
  return createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(componentFor(chart.id), chartProps, ...children),
  });
}

/**
 * Renders, reads the markup and unmounts. Ids minted per render (React's `useId`, per-instance
 * counters) are renamed by order of first appearance, so two renders of the same tree compare
 * equal while every reference between elements still has to line up.
 */
function markup(element: ReturnType<typeof fixtureElement>): string {
  const { container, unmount } = render(element);
  const html = container.innerHTML;
  unmount();
  const ids: string[] = [];
  // `useId` tokens wherever they appear (ids, class names, `url(#…)`), then any other id.
  for (const match of html.matchAll(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:|\sid="([^"]+)"/g)) {
    const id = (match[1] ?? match[0]) as string;
    if (!ids.includes(id)) ids.push(id);
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  let out = html;
  for (const id of [...ids].sort((a, b) => b.length - a.length)) {
    out = out.split(id).join(`@id${order.get(id)}@`);
  }
  return out;
}

// ── Completeness ────────────────────────────────────────────────────────────

describe("completeness", () => {
  it("every registered chart and part has a fixture, and every fixture a definition", () => {
    expect(Object.keys(CHART_FIXTURES).sort()).toEqual(Object.keys(CHART_DEFINITIONS).sort());
    expect(Object.keys(PART_FIXTURES).sort()).toEqual(Object.keys(PART_DEFINITIONS).sort());
    expect(Object.keys(SURFACE_FIXTURES).sort()).toEqual(Object.keys(SURFACE_DEFINITIONS).sort());
    for (const [id, fixture] of Object.entries({
      ...CHART_FIXTURES,
      ...PART_FIXTURES,
      ...SURFACE_FIXTURES,
    })) {
      expect(fixture.id).toBe(id);
    }
  });

  // One call per definition, with its literal type: a prop the definition does not account
  // for is a compile error here, and a default or fixture that does not validate throws.
  it("the chart definitions", () => {
    const props = (id: ChartDefinitionId) => [CHART_FIXTURES[id].props];
    assertDefinitionComplete(CHART_DEFINITIONS.LineChart, { examples: props("LineChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.AreaChart, { examples: props("AreaChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.ComposedChart, {
      examples: props("ComposedChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.BarChart, { examples: props("BarChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.ScatterChart, { examples: props("ScatterChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.CandlestickChart, {
      examples: props("CandlestickChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.LiveLineChart, {
      examples: props("LiveLineChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.WaterfallChart, {
      examples: props("WaterfallChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.PieChart, { examples: props("PieChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.RingChart, { examples: props("RingChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.FunnelChart, { examples: props("FunnelChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.RadarChart, { examples: props("RadarChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.UnitChart, { examples: props("UnitChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.BulletChart, { examples: props("BulletChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.TreemapChart, { examples: props("TreemapChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.TreeChart, { examples: props("TreeChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.SankeyChart, { examples: props("SankeyChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.NetworkChart, { examples: props("NetworkChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.ParallelCoordinatesChart, {
      examples: props("ParallelCoordinatesChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.ChoroplethChart, {
      examples: props("ChoroplethChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.HeatmapChart, { examples: props("HeatmapChart") });
    assertDefinitionComplete(CHART_DEFINITIONS.Gantt, { examples: props("Gantt") });
    assertDefinitionComplete(CHART_DEFINITIONS.DistributionChart, {
      examples: props("DistributionChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.DensityScatterChart, {
      examples: props("DensityScatterChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.DumbbellChart, {
      examples: props("DumbbellChart"),
    });
    assertDefinitionComplete(CHART_DEFINITIONS.BumpChart, { examples: props("BumpChart") });
  });

  it("the surface definitions", () => {
    const props = (id: SurfaceDefinitionId) => [SURFACE_FIXTURES[id].props];
    assertDefinitionComplete(SURFACE_DEFINITIONS.Gauge, { examples: props("Gauge") });
    assertDefinitionComplete(SURFACE_DEFINITIONS.Sparkline, { examples: props("Sparkline") });
    assertDefinitionComplete(SURFACE_DEFINITIONS.ChartCard, { examples: props("ChartCard") });
    assertDefinitionComplete(SURFACE_DEFINITIONS.MetricGrid, { examples: props("MetricGrid") });
  });

  it("the part definitions", () => {
    const props = (id: PartDefinitionId) => [PART_FIXTURES[id].props];
    assertDefinitionComplete(PART_DEFINITIONS.XAxis, { examples: props("XAxis") });
    assertDefinitionComplete(PART_DEFINITIONS.YAxis, { examples: props("YAxis") });
    assertDefinitionComplete(PART_DEFINITIONS.BarValueAxis, { examples: props("BarValueAxis") });
    assertDefinitionComplete(PART_DEFINITIONS.LiveXAxis, { examples: props("LiveXAxis") });
    assertDefinitionComplete(PART_DEFINITIONS.Grid, { examples: props("Grid") });
    assertDefinitionComplete(PART_DEFINITIONS.Bar, { examples: props("Bar") });
    assertDefinitionComplete(PART_DEFINITIONS.Line, { examples: props("Line") });
    assertDefinitionComplete(PART_DEFINITIONS.Area, { examples: props("Area") });
    assertDefinitionComplete(PART_DEFINITIONS.Scatter, { examples: props("Scatter") });
    assertDefinitionComplete(PART_DEFINITIONS.ReferenceLine, {
      examples: props("ReferenceLine"),
    });
  });

  it("the check fails on a fixture that does not validate", () => {
    expect(() =>
      assertDefinitionComplete(CHART_DEFINITIONS.LineChart, {
        examples: [{ data: LINE_CHART_FIXTURE.props.data, xScale: "polar" }],
      }),
    ).toThrow(/xScale/);
  });
});

// ── Golden contract ─────────────────────────────────────────────────────────
//
// Comparing against `CHART_CONTRACT_SPECS` (the double's own export) would compare
// `CHART_DEFINITIONS[id].contract` to itself since RM-177 (`contractSpecsFromDefinitions`
// makes them the SAME object) — a tautology, never red. `CONTRACT_GOLDEN` is a frozen, hand-kept
// fixture (`__fixtures__/contract-golden.ts`) with no relationship to the registry, so this is
// the one place a family's contract is still pinned by VALUE.

describe("golden contract", () => {
  it("CONTRACT_GOLDEN covers exactly the registered chart definitions — no family added or dropped silently", () => {
    expect(Object.keys(CONTRACT_GOLDEN).sort()).toStrictEqual(
      Object.keys(CHART_DEFINITIONS).sort(),
    );
  });

  it.each(Object.keys(CHART_DEFINITIONS) as ChartDefinitionId[])(
    "%s: the definition's contract matches the golden fixture",
    (id) => {
      expect(CHART_DEFINITIONS[id].contract).toStrictEqual(CONTRACT_GOLDEN[id]);
    },
  );
});

// ── Defaults parity ─────────────────────────────────────────────────────────

describe("defaults parity", () => {
  // A live chart places its window at the current time: freeze the clock so every render of
  // one fixture reads the same instant. Timers stay real.
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.UTC(2024, 1, 1), toFake: ["Date", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(Object.keys(CHART_DEFINITIONS) as ChartDefinitionId[])(
    "%s: every default passed explicitly renders the same DOM as none",
    (id) => {
      const def: AnyComponentDefinition = CHART_DEFINITIONS[id];
      const fixture = CHART_FIXTURES[id];
      const resolved = resolveProps(def, fixture.props);
      // The fixture leaves defaults to fill, so the comparison is not vacuous.
      expect(Object.keys(resolved).length).toBeGreaterThan(Object.keys(fixture.props).length);
      // A first render warms every module-level cache both compared renders then share.
      markup(fixtureElement(fixture, fixture.props));
      const bare = markup(fixtureElement(fixture, fixture.props));
      const explicit = markup(fixtureElement(fixture, resolved));
      expect(bare.length).toBeGreaterThan(0);
      expect(explicit).toBe(bare);
    },
  );

  it.each(Object.keys(SURFACE_DEFINITIONS) as SurfaceDefinitionId[])(
    "%s: every default passed explicitly renders the same DOM as none",
    (id) => {
      const def: AnyComponentDefinition = SURFACE_DEFINITIONS[id];
      const fixture = SURFACE_FIXTURES[id];
      const resolved = resolveProps(def, fixture.props);
      // The fixture leaves defaults to fill, so the comparison is not vacuous.
      expect(Object.keys(resolved).length).toBeGreaterThan(Object.keys(fixture.props).length);
      // A first render warms every module-level cache both compared renders then share.
      markup(fixtureElement(fixture, fixture.props));
      const bare = markup(fixtureElement(fixture, fixture.props));
      const explicit = markup(fixtureElement(fixture, resolved));
      expect(bare.length).toBeGreaterThan(0);
      expect(explicit).toBe(bare);
    },
  );

  it.each(Object.keys(PART_DEFINITIONS) as PartDefinitionId[])(
    "%s: every default passed explicitly renders the same DOM in its host as none",
    (id) => {
      const def: AnyComponentDefinition = PART_DEFINITIONS[id];
      const fixture = PART_FIXTURES[id];
      const resolved = resolveProps(def, fixture.props);
      expect(Object.keys(resolved).length).toBeGreaterThan(Object.keys(fixture.props).length);
      const { host } = fixture;
      markup(fixtureElement(host, host.props));
      const bare = markup(fixtureElement(host, host.props));
      const explicit = markup(
        fixtureElement(host, host.props, { of: fixture.props, with: resolved }),
      );
      expect(bare.length).toBeGreaterThan(0);
      expect(explicit).toBe(bare);
    },
  );
});

// ── Direction ───────────────────────────────────────────────────────────────

describe("direction", () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const definitionFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__fixtures__" ? [] : definitionFiles(path);
      return entry.name.endsWith(".definition.ts") ? [path] : [];
    });

  it("no chart or part definition imports the registry or the component bindings", () => {
    const files = definitionFiles(HERE);
    expect(files.length).toBe(
      Object.keys(CHART_DEFINITIONS).length +
        Object.keys(PART_DEFINITIONS).length +
        Object.keys(SURFACE_DEFINITIONS).length,
    );
    const offenders = files.flatMap((file) =>
      ts
        .preProcessFile(readFileSync(file, "utf8"), true, true)
        .importedFiles.map((imported) => imported.fileName)
        .filter((name) => /(^|\/)(registry|components)$/.test(name))
        .map((name) => `${relative(HERE, file)} imports ${name}`),
    );
    expect(offenders).toEqual([]);
  });
});

// ── useResolvedChartProps ───────────────────────────────────────────────────

interface DemoProps {
  value?: number;
  label?: string;
}

const DEMO = defineComponent<DemoProps>()({
  id: "DemoChart",
  version: 1,
  label: "Demo chart",
  groups: [],
  fields: { value: field.number(), label: field.string() },
  codeOnly: [],
  defaults: { label: "none" },
  targets: [],
  aliases: [
    { from: "amount", to: "value", transform: "identity", since: "5.0.0", removeIn: "6.0.0" },
  ],
});

describe("useResolvedChartProps", () => {
  // Only this spy is restored: the jsdom seams above stay mocked for the whole file.
  const spyOnWarn = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  let warn: ReturnType<typeof spyOnWarn> | undefined;
  const silenceWarnings = () => (warn = spyOnWarn());

  afterEach(() => {
    resetWarnOnce();
    warn?.mockRestore();
    warn = undefined;
  });

  it("fills the definition's defaults", () => {
    const { result } = renderHook(() =>
      useResolvedChartProps(CHART_DEFINITIONS.LineChart, LINE_CHART_FIXTURE.props),
    );
    expect(result.current).toMatchObject({
      data: LINE_CHART_FIXTURE.props.data,
      xDataKey: "date",
      animationDuration: 1100,
      status: "ready",
      tooltip: true,
    });
  });

  it("returns the props object itself when there is nothing to rename or fill", () => {
    const props = { value: 1, label: "x" };
    const { result } = renderHook(() => useResolvedChartProps(DEMO, props));
    expect(result.current).toBe(props);
  });

  it("is memoised on the definition and the props object", () => {
    const props = { value: 1 };
    const { result, rerender } = renderHook(({ p }) => useResolvedChartProps(DEMO, p), {
      initialProps: { p: props as Record<string, unknown> },
    });
    const first = result.current;
    expect(first).toEqual({ value: 1, label: "none" });
    rerender({ p: props });
    expect(result.current).toBe(first);
    rerender({ p: { value: 1 } });
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual(first);
  });

  it("maps an old name before filling defaults, and warns once per old name", () => {
    const spy = silenceWarnings();
    const { result, rerender } = renderHook(({ p }) => useResolvedChartProps(DEMO, p), {
      initialProps: { p: { amount: 3 } as Record<string, unknown> },
    });
    expect(result.current).toEqual({ value: 3, label: "none" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '[DemoChart] "amount" is deprecated and will be removed in 6.0.0. Use "value".',
    );
    rerender({ p: { amount: 4 } });
    expect(result.current).toEqual({ value: 4, label: "none" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps the new name when a caller passes both", () => {
    silenceWarnings();
    const { result } = renderHook(() =>
      useResolvedChartProps(DEMO, { amount: 3, value: 5 } as Record<string, unknown>),
    );
    expect(result.current).toEqual({ value: 5, label: "none" });
  });
});
