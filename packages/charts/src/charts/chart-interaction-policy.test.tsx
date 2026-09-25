/**
 * RM-167 — the host's interaction policy (`ChartConfigProvider` `interactions`)
 * reaches EVERY chart family, not only the modules that read it first
 * (`ChartTooltip`, `ChartBrush`, `ChartDatapointLayer`).
 *
 * One loop over the 26 families of `ChartFamilyName`, each rendered from a
 * local fixture of minimal valid data:
 *
 * - `passive: false` — hovering (and focusing) every element of the chart
 *   shows no tooltip. Where the readout can be driven in jsdom, the same walk
 *   under the default policy shows one first, so the check cannot pass by
 *   hovering nothing.
 * - `active: false` — no navigator handles, brush, zoom controls, datapoint
 *   targets, selection gestures or drag affordances, and a wheel / pinch /
 *   `+` on every element gets no zoom response. Each family's surfaces are
 *   first shown to mount (and to zoom) under the default policy.
 * - `select: false` — a committing click reaches no handler
 *   (`onDatapointClick`, or the density scatter's zone intent), after the
 *   same click reached it under the default policy.
 *
 * A family whose hover readout cannot be driven in jsdom, or that has no
 * surface of a kind, says so with its reason in the fixture table; those
 * gates are exercised at the level of the gesture owner below the loop.
 * Nothing is skipped silently.
 *
 * jsdom has no layout, so the measurement seams (`@visx/responsive`,
 * `react-use-measure`, `getBoundingClientRect`, `ResizeObserver`,
 * `getTotalLength`) are stubbed to a fixed box — the interaction code is not.
 */

import { type ReactElement, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const BOX = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: BOX.width, height: BOX.height })}</>,
}));

vi.mock("react-use-measure", () => ({
  default: () => [
    () => undefined,
    { ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0 },
  ],
}));

import { installCanvasContextStub } from "../test/primitives";
import { CHART_CONTRACT_SPECS, type ChartFamilyName } from "../test/doubles";
import { Gantt } from "../gantt/gantt";
import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BulletChart } from "./bullet-chart";
import { BumpChart } from "./bump-chart";
import { Candlestick } from "./candlestick";
import { CandlestickChart } from "./candlestick-chart";
import { CanvasLayer } from "./canvas-layer/canvas-layer";
import { ChartBrush } from "./chart-brush";
import { ChartConfigProvider, type ChartInteractions } from "./chart-config-context";
import { ChoroplethChart } from "./choropleth/choropleth-chart";
import { ChoroplethFeature } from "./choropleth/choropleth-feature";
import { ChoroplethTooltip } from "./choropleth/choropleth-tooltip";
import { ComposedChart } from "./composed-chart";
import { DensityScatterChart } from "./density-scatter/density-scatter-chart";
import { buildLateralTraffic, LATERAL_ZONES } from "./density-scatter/fixtures";
import { DistributionChart } from "./distribution/distribution-chart";
import { DumbbellChart } from "./dumbbell-chart";
import { FunnelChart } from "./funnel-chart";
import { ChartZoomControls } from "./gestures/chart-zoom-controls";
import { usePinchGesture } from "./gestures/use-pinch-gesture";
import { HeatmapChart } from "./heatmap/heatmap-chart";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { LiveLine } from "./live-line";
import { LiveLineChart } from "./live-line-chart";
import { ChartNavigator } from "./navigator/chart-navigator";
import { NetworkChart } from "./network/network-chart";
import { ParallelCoordinatesChart } from "./parallel-coordinates/parallel-coordinates-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { RadarArea } from "./radar-area";
import { RadarChart } from "./radar-chart";
import { Ring } from "./ring";
import { RingChart } from "./ring-chart";
import { SankeyChart } from "./sankey/sankey-chart";
import { SankeyNode } from "./sankey/sankey-node";
import { SankeyThreadLinks } from "./sankey/sankey-threads";
import { SankeyTooltip } from "./sankey/sankey-tooltip";
import { Scatter, ScatterChart } from "./scatter-chart";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { TreeChart } from "./tree-chart";
import { TreeChartMiniMap } from "./tree-chart-viewport";
import { TreemapChart } from "./treemap/treemap-chart";
import { UnitChart } from "./unit-chart";
import { WaterfallChart } from "./waterfall-chart";

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
  // The scatter hit test maps client px into the svg: identity, as the box sits at 0,0.
  const identity = { inverse: () => identity };
  Object.defineProperty(SVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value: () => identity,
  });
  Object.defineProperty(SVGElement.prototype, "createSVGPoint", {
    configurable: true,
    value: () => {
      const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
      return point;
    },
  });
  // jsdom ships no PointerEvent: a MouseEvent carrying the pointer fields.
  if (typeof globalThis.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
  canvasStub = installCanvasContextStub();
});

afterAll(() => {
  canvasStub?.restore();
});

afterEach(cleanup);

// ── Policy harness ──────────────────────────────────────────────────────────

function renderWith(policy: ChartInteractions | undefined, element: ReactElement) {
  return render(
    <LocaleProvider locale="en-US">
      <ChartConfigProvider value={policy ? { interactions: policy } : undefined}>
        {element}
      </ChartConfigProvider>
    </LocaleProvider>,
  );
}

/** Any hover readout a family can show: the shared box, a Radix tooltip. */
const TOOLTIP = '[data-slot="chart-tooltip-box"], [role="tooltip"]';
const TARGET = '[data-slot="chart-datapoint-layer-target"]';

/** Every direct-manipulation surface the `active` layer owns, across the package. */
const ACTIVE_SURFACES = [
  '[data-slot="chart-navigator-handles"]',
  '[data-slot="chart-navigator-handle"]',
  '[data-slot="chart-navigator-track"].cursor-grab',
  ".chart-brush",
  '[data-slot="chart-zoom-controls"]',
  TARGET,
  '[data-slot="chart-selection-gesture"]',
  '[data-slot="chart-selection-gesture-host"]',
  '[data-slot="choropleth-zoom-controls"]',
  '[data-slot="tree-chart-viewport-controls"]',
  '[data-slot="tree-chart-minimap"].pointer-events-auto',
  '[data-slot="tree-chart"].cursor-grab',
  '[data-slot="density-scatter-chart-x-gutter"]',
  '[data-slot="density-scatter-chart-x-sliders"]',
  '[data-slot="density-scatter-chart-plot"].cursor-grab',
  '[data-slot="network-chart-body"].cursor-grab',
  '[data-slot="canvas-layer-cursor"]',
  'button[aria-label="Fit to width"]',
  "[data-task-id].cursor-grab",
] as const;

interface Spies {
  onDatapointClick: ReturnType<typeof vi.fn>;
  onWindowChange: ReturnType<typeof vi.fn>;
  onViewChange: ReturnType<typeof vi.fn>;
  onZoomChange: ReturnType<typeof vi.fn>;
  onPixelsPerDayChange: ReturnType<typeof vi.fn>;
  onSelectionIntent: ReturnType<typeof vi.fn>;
}

function makeSpies(): Spies {
  return {
    onDatapointClick: vi.fn(),
    onWindowChange: vi.fn(),
    onViewChange: vi.fn(),
    onZoomChange: vi.fn(),
    onPixelsPerDayChange: vi.fn(),
    onSelectionIntent: vi.fn(),
  };
}

interface Family {
  /** The chart, with the handlers and active surfaces the three checks need. */
  element: (spies: Spies) => ReactElement;
  /**
   * `passive`: `true` when the hover walk shows a readout under the default
   * policy (the positive control); otherwise why it cannot, in words.
   */
  hover: true | string;
  /**
   * `false` when hovering the family in jsdom cannot run at all (reason in
   * `hover`): its readout is then checked only at the gesture owner below.
   */
  hoverWalk?: false;
  /** `active`: the surfaces this family mounts under the default policy ([] = none, see `why`). */
  activeSlots: readonly string[];
  /** Why a family mounts no direct-manipulation surface at all. */
  noActiveWhy?: string;
  /** The callback a wheel / pinch / `+` zoom reaches under the default policy. */
  zoom?: keyof Spies;
  /** `select`: the committing click (target + handler), or why the family has none. */
  select: { target: string; handler: keyof Spies } | string;
}

// ── Fixtures: minimal valid data per family ─────────────────────────────────

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);
const daily = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(T0 + i * DAY),
  revenue: 100 + ((i * 37) % 50),
  profit: 20 + ((i * 13) % 10),
}));
const ohlc = daily.map((d, i) => ({
  date: d.date,
  open: 100 + i,
  high: 108 + i,
  low: 96 + i,
  close: 104 + i,
}));
const categories = Array.from({ length: 12 }, (_, i) => ({ name: `C${i + 1}`, value: 10 + i }));
const orgTree = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }] },
    { name: "Product", children: [{ name: "Billing" }] },
  ],
};
const records = Array.from({ length: 12 }, (_, i) => ({
  id: `P${i}`,
  minutes: i * 10,
  ward: i % 2 ? "A" : "B",
}));
const cells = ["Mon", "Tue"].flatMap((day, d) =>
  ["08", "09", "10", "11"].map((hour, h) => ({ day, hour, tickets: d * 4 + h })),
);
const square = (x: number, y: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, y],
      [x + 10, y],
      [x + 10, y + 10],
      [x, y + 10],
      [x, y],
    ],
  ],
});
const regions = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      id: "a",
      geometry: square(-100, 40),
      properties: { id: "a", name: "Alpha", value: 120 },
    },
    {
      type: "Feature" as const,
      id: "b",
      geometry: square(-80, 40),
      properties: { id: "b", name: "Beta", value: 60 },
    },
  ],
};
const sankey = {
  nodes: [{ name: "Src A" }, { name: "Hub" }, { name: "Dst X" }],
  links: [
    { source: 0, target: 1, value: 10, path: ["Src A", "Hub", "Dst X"] },
    { source: 1, target: 2, value: 10, path: ["Src A", "Hub", "Dst X"] },
  ],
};
const tasks = [
  { id: "t1", name: "Design", start: new Date(T0), end: new Date(T0 + 5 * DAY) },
  { id: "t2", name: "Build", start: new Date(T0 + 5 * DAY), end: new Date(T0 + 12 * DAY) },
];
const densityData = buildLateralTraffic(2_000);

const FAMILIES: Record<ChartFamilyName, Family> = {
  AreaChart: {
    element: (s) => (
      <AreaChart
        animationDuration={0}
        data={daily}
        onDatapointClick={s.onDatapointClick}
        onWindowChange={s.onWindowChange}
        scrollbar="miniChart"
        xDataKey="date"
      >
        <Area dataKey="revenue" />
      </AreaChart>
    ),
    hover: true,
    activeSlots: ['[data-slot="chart-navigator-handle"]', TARGET],
    zoom: "onWindowChange",
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  BarChart: {
    element: (s) => (
      <BarChart
        animationDuration={0}
        data={categories}
        maxVisibleItems={4}
        onDatapointClick={s.onDatapointClick}
        onSelectionIntent={s.onSelectionIntent}
        onWindowChange={s.onWindowChange}
        scrollbar="miniChart"
        selectionGestures={["rect"]}
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>
    ),
    hover: true,
    activeSlots: [
      '[data-slot="chart-navigator-handle"]',
      '[data-slot="chart-selection-gesture"]',
      TARGET,
    ],
    zoom: "onWindowChange",
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  LineChart: {
    element: (s) => (
      <LineChart
        animationDuration={0}
        data={daily}
        onDatapointClick={s.onDatapointClick}
        onWindowChange={s.onWindowChange}
        scrollbar="miniChart"
        xDataKey="date"
      >
        <Line dataKey="revenue" />
        <ChartBrush />
      </LineChart>
    ),
    hover: true,
    activeSlots: ['[data-slot="chart-navigator-handle"]', ".chart-brush", TARGET],
    zoom: "onWindowChange",
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  ComposedChart: {
    element: (s) => (
      <ComposedChart
        animationDuration={0}
        data={daily}
        onDatapointClick={s.onDatapointClick}
        onWindowChange={s.onWindowChange}
        xDataKey="date"
      >
        <Line dataKey="profit" />
      </ComposedChart>
    ),
    hover: true,
    activeSlots: [TARGET],
    zoom: "onWindowChange",
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  ScatterChart: {
    element: (s) => (
      <ScatterChart
        animationDuration={0}
        data={daily}
        onSelectionIntent={s.onSelectionIntent}
        selectionGestures={["rect"]}
      >
        <Scatter dataKey="revenue" />
      </ScatterChart>
    ),
    hover: true,
    activeSlots: ['[data-slot="chart-selection-gesture"]'],
    select:
      "ScatterChart takes no onDatapointClick; its committing path is the selection gesture, an active-layer surface checked above",
  },
  DensityScatterChart: {
    element: (s) => (
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={densityData}
        onSelectionIntent={s.onSelectionIntent}
        onViewChange={s.onViewChange}
        selectionGestures={["range"]}
        zones={LATERAL_ZONES}
      />
    ),
    hover: true,
    activeSlots: [
      '[data-slot="density-scatter-chart-x-gutter"]',
      '[data-slot="density-scatter-chart-x-sliders"]',
      '[data-slot="density-scatter-chart-plot"].cursor-grab',
    ],
    zoom: "onViewChange",
    select: {
      target: '[data-slot="density-scatter-chart-zone-tag"]',
      handler: "onSelectionIntent",
    },
  },
  CandlestickChart: {
    element: (s) => (
      <CandlestickChart
        animationDuration={0}
        data={ohlc}
        onWindowChange={s.onWindowChange}
        scrollbar="miniChart"
      >
        <Candlestick animate={false} />
      </CandlestickChart>
    ),
    hover:
      "hovering its plot under the fixed-box jsdom stubs trips an update loop that predates RM-167 (reproduced with this change reverted); its readout is the shared ChartTooltip, whose ChartTooltipBox is gated below",
    hoverWalk: false,
    activeSlots: ['[data-slot="chart-navigator-handle"]'],
    zoom: "onWindowChange",
    select: "CandlestickChart takes no onDatapointClick",
  },
  LiveLineChart: {
    element: () => (
      <LiveLineChart data={[{ time: 1, value: 3 }]} value={3}>
        <LiveLine dataKey="value" />
      </LiveLineChart>
    ),
    hover:
      "its readout is a ChartTooltip child, resolved inside a requestAnimationFrame loop jsdom cannot drive; ChartTooltip draws a ChartTooltipBox, gated below",
    activeSlots: [],
    noActiveWhy: "a streaming line owns its own window: no navigator, zoom, brush or drag",
    select: "LiveLineChart takes no onDatapointClick",
  },
  PieChart: {
    element: (s) => (
      <PieChart
        data={[
          { label: "Direct", value: 320 },
          { label: "Organic", value: 280 },
        ]}
        onDatapointClick={s.onDatapointClick}
        size={240}
      >
        <PieSlice index={0} />
        <PieSlice index={1} />
      </PieChart>
    ),
    hover: "no floating readout: a hovered slice restates its value in the centre label",
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  RingChart: {
    element: (s) => (
      <RingChart
        data={[
          { label: "Storage", value: 60, maxValue: 100 },
          { label: "Compute", value: 30, maxValue: 100 },
        ]}
        onDatapointClick={s.onDatapointClick}
        size={240}
      >
        <Ring index={0} />
        <Ring index={1} />
      </RingChart>
    ),
    hover: "no floating readout: a hovered ring restates its value in the centre label",
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  FunnelChart: {
    element: (s) => (
      <FunnelChart
        data={[
          { label: "Visitors", value: 12000 },
          { label: "Signups", value: 4800 },
          { label: "Paid", value: 840 },
        ]}
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: "no floating readout: every stage prints its own value",
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  RadarChart: {
    element: () => (
      <RadarChart
        animate={false}
        data={[{ label: "Series A", values: { speed: 80, reliability: 70, comfort: 60 } }]}
        metrics={[
          { key: "speed", label: "Speed" },
          { key: "reliability", label: "Reliability" },
          { key: "comfort", label: "Comfort" },
        ]}
        size={300}
      >
        <RadarArea index={0} />
      </RadarChart>
    ),
    hover: "no floating readout: a hovered polygon is emphasised in place",
    activeSlots: [],
    noActiveWhy: "no navigator, zoom, brush, drag or datapoint targets",
    select: "RadarChart takes no onDatapointClick",
  },
  ChoroplethChart: {
    element: () => (
      <ChoroplethChart data={regions} zoomControls>
        <ChoroplethFeature />
        <ChoroplethTooltip />
      </ChoroplethChart>
    ),
    hover: true,
    activeSlots: ['[data-slot="choropleth-zoom-controls"]'],
    select: "ChoroplethChart takes no onDatapointClick",
  },
  SankeyChart: {
    element: () => (
      <SankeyChart data={sankey} mode="threads">
        <SankeyThreadLinks />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    ),
    hover: true,
    activeSlots: [TARGET],
    select: "SankeyChart takes no onDatapointClick; a thread's pin is local view state",
  },
  Gantt: {
    element: (s) => (
      <Gantt
        onPixelsPerDayChange={s.onPixelsPerDayChange}
        onTaskMove={() => {}}
        style={{ height: 300 }}
        tasks={tasks}
      />
    ),
    hover: true,
    activeSlots: ['button[aria-label="Fit to width"]', "[data-task-id].cursor-grab"],
    zoom: "onPixelsPerDayChange",
    select: "Gantt takes no onDatapointClick",
  },
  DumbbellChart: {
    element: (s) => (
      <DumbbellChart
        category="step"
        data={[
          { step: "Sign up", before: 100, after: 100 },
          { step: "Verify email", before: 82, after: 94 },
        ]}
        endKey="after"
        onDatapointClick={s.onDatapointClick}
        startKey="before"
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  BulletChart: {
    element: () => <BulletChart value={82} />,
    hover: "no floating readout: the bullet prints its value and target",
    activeSlots: [],
    noActiveWhy: "a single measure: no navigator, zoom, brush, drag or datapoint targets",
    select: "BulletChart takes no onDatapointClick",
  },
  HeatmapChart: {
    element: (s) => (
      <HeatmapChart
        data={cells}
        onDatapointClick={s.onDatapointClick}
        onSelectionIntent={s.onSelectionIntent}
        selectionGestures={["range"]}
        valueKey="tickets"
        x="hour"
        y="day"
      />
    ),
    hover: true,
    activeSlots: ['[data-slot="chart-selection-gesture-host"]', TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  UnitChart: {
    element: (s) => (
      <UnitChart
        data={[
          { label: "Search", value: 41 },
          { label: "Social", value: 59 },
        ]}
        layout="waffle"
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  TreemapChart: {
    element: (s) => (
      <TreemapChart
        data={{
          name: "Work",
          children: [
            {
              name: "Platform",
              children: [
                { name: "CI", value: 40 },
                { name: "Infra", value: 30 },
              ],
            },
            { name: "Product", children: [{ name: "Search", value: 25 }] },
          ],
        }}
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  DistributionChart: {
    element: (s) => (
      <DistributionChart
        data={records}
        groupKey="ward"
        kind="strip"
        onDatapointClick={s.onDatapointClick}
        onSelectionIntent={s.onSelectionIntent}
        selectionGestures={["range"]}
        valueKey="minutes"
      />
    ),
    hover: true,
    activeSlots: ['[data-slot="chart-selection-gesture-host"]', TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  WaterfallChart: {
    element: (s) => (
      <WaterfallChart
        data={[
          { label: "Gross", value: 1000, kind: "total" },
          { label: "Refunds", value: -120 },
          { label: "Fees", value: -80 },
          { label: "Net", value: 800, kind: "total" },
        ]}
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  BumpChart: {
    element: (s) => (
      <BumpChart
        data={[
          { quarter: "Q1", product: "Atlas", share: 28 },
          { quarter: "Q1", product: "Nimbus", share: 34 },
          { quarter: "Q2", product: "Atlas", share: 31 },
          { quarter: "Q2", product: "Nimbus", share: 30 },
        ]}
        entity="product"
        onDatapointClick={s.onDatapointClick}
        period="quarter"
        valueKey="share"
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  ParallelCoordinatesChart: {
    element: (s) => (
      <ParallelCoordinatesChart
        data={[
          { product: "Atlas", price: 10, latency: 120 },
          { product: "Nimbus", price: 14, latency: 90 },
        ]}
        dimensions={[
          { key: "price", label: "Price" },
          { key: "latency", label: "Latency" },
        ]}
        entity="product"
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: true,
    activeSlots: [TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  TreeChart: {
    element: (s) => (
      <TreeChart
        collapsible={false}
        data={orgTree}
        minimap
        onDatapointClick={s.onDatapointClick}
        onZoomChange={s.onZoomChange}
        zoomable
      />
    ),
    hover: true,
    activeSlots: [
      '[data-slot="tree-chart-viewport-controls"]',
      '[data-slot="tree-chart-minimap"].pointer-events-auto',
      '[data-slot="tree-chart"].cursor-grab',
      TARGET,
    ],
    zoom: "onZoomChange",
    select: { target: TARGET, handler: "onDatapointClick" },
  },
  NetworkChart: {
    element: (s) => (
      <NetworkChart
        draggable
        layout="force"
        links={[{ source: "a", target: "b" }]}
        nodes={[
          { id: "a", label: "Alpha", value: 9, group: "one" },
          { id: "b", label: "Beta", value: 4, group: "one" },
        ]}
        onDatapointClick={s.onDatapointClick}
      />
    ),
    hover: true,
    activeSlots: ['[data-slot="network-chart-body"].cursor-grab', TARGET],
    select: { target: TARGET, handler: "onDatapointClick" },
  },
};

const CASES = (Object.keys(FAMILIES) as ChartFamilyName[]).map((name) => ({
  name,
  ...FAMILIES[name],
}));

// ── Gesture probes ──────────────────────────────────────────────────────────

/** A few points across the plot: jsdom lays nothing out, so client px == chart px. */
const POINTS: readonly [number, number][] = [
  [320, 160],
  [100, 100],
  [540, 120],
  [200, 240],
  [520, 150],
];

function allElements(root: HTMLElement): Element[] {
  return [root, ...root.querySelectorAll("*")].slice(0, 600);
}

function describeElement(el: Element): string {
  const slot = el.getAttribute("data-slot");
  const name = el.getAttribute("aria-label");
  return `<${el.tagName.toLowerCase()}${slot ? ` data-slot="${slot}"` : ""}${name ? ` aria-label="${name}"` : ""}>`;
}

/**
 * A Radix tooltip that only restates an icon-only control's own name (the
 * selection toolbar's mode buttons) is that control's visible label, not a
 * hover readout of the data — `passive` does not own it.
 */
function isControlLabel(tip: Element): boolean {
  if (tip.getAttribute("role") !== "tooltip" || !tip.id) return false;
  const control = document.querySelector(`[aria-describedby~="${tip.id}"]`);
  if (!(control instanceof HTMLButtonElement) || control.textContent?.trim()) return false;
  const name = control.getAttribute("aria-label")?.trim();
  return name !== undefined && name === tip.textContent?.trim();
}

function hasTooltip(): boolean {
  return [...document.body.querySelectorAll(TOOLTIP)].some((tip) => !isControlLabel(tip));
}

/** What readout is showing (for the failure message), or `null`. */
function shownTooltip(after: string): string | null {
  const tip = [...document.body.querySelectorAll(TOOLTIP)].find((t) => !isControlLabel(t));
  if (!tip) return null;
  return `${describeElement(tip)} "${(tip.textContent ?? "").slice(0, 60)}" after ${after}`;
}

/** Lets a readout that waits on a frame or a spring mount. */
async function tick() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
}

/**
 * Hovers every element at one point after another (so no later point moves a
 * readout away before it mounts), then each svg-level hover host on its own
 * with a frame to settle (a host that coalesces its moves into a frame sees
 * only the last event), then focuses every focusable. Returns the first
 * readout that showed, or `null`; `stopOnTooltip: false` walks on to the end
 * regardless.
 */
async function hoverWalk(root: HTMLElement, stopOnTooltip: boolean): Promise<string | null> {
  let seen: string | null = null;
  const elements = allElements(root);
  const hosts = elements
    .filter(
      (el) =>
        el instanceof SVGElement &&
        (el.tagName === "svg" ||
          el.hasAttribute("data-slot") ||
          el.parentElement?.tagName === "svg"),
    )
    .slice(0, 15);
  const hover = (el: Element, init: object) => {
    fireEvent.pointerOver(el, init);
    fireEvent.pointerEnter(el, init);
    fireEvent.mouseEnter(el, init);
    fireEvent.mouseOver(el, init);
    fireEvent.pointerMove(el, init);
    fireEvent.mouseMove(el, init);
  };
  for (const [clientX, clientY] of POINTS) {
    const init = { clientX, clientY, pointerId: 1, pointerType: "mouse", bubbles: true };
    for (const el of elements) {
      hover(el, init);
      seen ??= shownTooltip(`hovering ${describeElement(el)} at ${clientX},${clientY}`);
      if (seen && stopOnTooltip) return seen;
    }
    await tick();
    seen ??= shownTooltip(`hovering at ${clientX},${clientY}`);
    if (seen && stopOnTooltip) return seen;
    for (const el of hosts) {
      hover(el, init);
      await tick();
      seen ??= shownTooltip(`hovering ${describeElement(el)} at ${clientX},${clientY}`);
      if (seen && stopOnTooltip) return seen;
    }
  }
  const focusables = elements.filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.tabIndex >= 0,
  );
  for (const [index, el] of focusables.entries()) {
    act(() => el.focus());
    seen ??= shownTooltip(`focusing ${describeElement(el)}`);
    if (index < 5 || index % 10 === 0 || index === focusables.length - 1) {
      await tick();
      seen ??= shownTooltip(`focusing ${describeElement(el)}`);
    }
    if (seen && stopOnTooltip) return seen;
  }
  return seen;
}

/** Wheel (plain and pinch), and the `+` / `=` zoom keys, on every element. */
function zoomProbe(root: HTMLElement) {
  for (const el of allElements(root)) {
    const at = { bubbles: true, cancelable: true, clientX: 320, clientY: 160 };
    act(() => {
      el.dispatchEvent(new WheelEvent("wheel", { ...at, deltaY: -120 }));
      el.dispatchEvent(new WheelEvent("wheel", { ...at, deltaY: -40, ctrlKey: true }));
    });
    fireEvent.keyDown(el, { key: "+" });
    fireEvent.keyDown(el, { key: "=" });
  }
}

/** Lets the wheel pan / pinch commits (rAF, a 200 ms quiet timer) land. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 260)));
}

async function waitForSelector(container: HTMLElement, selector: string) {
  for (let i = 0; i < 20 && !container.querySelector(selector); i++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  return container.querySelector(selector);
}

// ── The loop ────────────────────────────────────────────────────────────────

describe("interaction policy — completeness", () => {
  it("the fixture table covers every ChartFamilyName", () => {
    expect(Object.keys(FAMILIES).sort()).toEqual(Object.keys(CHART_CONTRACT_SPECS).sort());
    expect(CASES).toHaveLength(26);
  });
});

describe("passive: false — no tooltip on hover", () => {
  it.each(CASES)(
    "$name",
    async ({ element, hover, hoverWalk: walk }) => {
      if (walk === false) {
        expect(hover, "a family that cannot be hovered in jsdom names why").toMatch(/\w{8}/);
        renderWith({ passive: false }, element(makeSpies()));
        await settle();
        expect(hasTooltip()).toBe(false);
        return;
      }
      if (hover === true) {
        // Positive control: the same walk shows a readout under the default policy.
        const shown = renderWith(undefined, element(makeSpies()));
        await settle();
        expect(
          await hoverWalk(shown.container, true),
          "no readout under the default policy",
        ).not.toBeNull();
        cleanup();
      } else {
        expect(hover, "a family without a driven readout names why").toMatch(/\w{8}/);
      }
      const quiet = renderWith({ passive: false }, element(makeSpies()));
      await settle();
      expect(await hoverWalk(quiet.container, false)).toBeNull();
      expect(hasTooltip()).toBe(false);
    },
    30_000,
  ); // Two full hover walks: several seconds per family under a loaded run.
});

describe("active: false — no handles, controls or zoom response", () => {
  it.each(CASES)("$name", async ({ element, activeSlots, noActiveWhy, zoom }) => {
    if (activeSlots.length === 0) {
      expect(noActiveWhy, "a family with no active surface names why").toMatch(/\w{8}/);
    } else {
      const on = makeSpies();
      const shown = renderWith(undefined, element(on));
      for (const slot of activeSlots) {
        expect(
          await waitForSelector(shown.container, slot),
          `${slot} under the default policy`,
        ).not.toBeNull();
      }
      if (zoom) {
        zoomProbe(shown.container);
        await settle();
        expect(on[zoom], `${zoom} under the default policy`).toHaveBeenCalled();
      }
      cleanup();
    }

    const off = makeSpies();
    const inert = renderWith({ active: false }, element(off));
    await settle();
    for (const slot of ACTIVE_SURFACES) {
      expect(inert.container.querySelector(slot), `${slot} with active: false`).toBeNull();
    }
    zoomProbe(inert.container);
    await settle();
    expect(off.onWindowChange).not.toHaveBeenCalled();
    expect(off.onViewChange).not.toHaveBeenCalled();
    expect(off.onZoomChange).not.toHaveBeenCalled();
    expect(off.onPixelsPerDayChange).not.toHaveBeenCalled();
    for (const slot of ACTIVE_SURFACES) {
      expect(inert.container.querySelector(slot), `${slot} after the zoom probe`).toBeNull();
    }
  });
});

describe("select: false — a committing click reaches no handler", () => {
  it.each(CASES)("$name", async ({ element, select }) => {
    if (typeof select === "string") {
      expect(select, "a family without a committing click names why").toMatch(/\w{8}/);
      return;
    }
    const on = makeSpies();
    const shown = renderWith(undefined, element(on));
    const target = await waitForSelector(shown.container, select.target);
    expect(target, `${select.target} under the default policy`).not.toBeNull();
    fireEvent.click(target as Element);
    expect(on[select.handler]).toHaveBeenCalled();
    cleanup();

    const off = makeSpies();
    const kept = renderWith({ select: false }, element(off));
    // The layer stays (activation is a no-op), so the same target is there to click.
    const again = await waitForSelector(kept.container, select.target);
    expect(again).not.toBeNull();
    fireEvent.click(again as Element);
    fireEvent.keyDown(again as Element, { key: "Enter" });
    expect(off[select.handler]).not.toHaveBeenCalled();
  });
});

// ── Gesture owners, below the families ──────────────────────────────────────
// Every hand-mounted readout and every zoom primitive, checked where it lives.

describe("gesture owners", () => {
  it("ChartTooltipBox renders nothing with passive: false (every hand-mounted caller, and ChartTooltip's box)", () => {
    function Probe() {
      const ref = useRef<HTMLDivElement | null>(null);
      return (
        <div ref={ref}>
          <ChartTooltipBox
            containerHeight={200}
            containerRef={ref}
            containerWidth={400}
            visible
            x={20}
            y={20}
          >
            readout
          </ChartTooltipBox>
        </div>
      );
    }
    renderWith(undefined, <Probe />);
    expect(screen.getByText("readout")).toBeInTheDocument();
    cleanup();
    renderWith({ passive: false }, <Probe />);
    expect(screen.queryByText("readout")).toBeNull();
    expect(document.querySelector('[data-slot="chart-tooltip-box"]')).toBeNull();
  });

  it("usePinchGesture binds nothing with active: false", () => {
    function Target({ onPinch }: { onPinch: () => void }) {
      const ref = useRef<HTMLDivElement | null>(null);
      usePinchGesture(ref, { onPinch });
      return <div data-testid="pinch" ref={ref} />;
    }
    const pinch = (el: Element) =>
      act(() => {
        el.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -20 }),
        );
      });
    const on = vi.fn();
    renderWith(undefined, <Target onPinch={on} />);
    pinch(screen.getByTestId("pinch"));
    expect(on).toHaveBeenCalled();
    cleanup();
    const off = vi.fn();
    renderWith({ active: false }, <Target onPinch={off} />);
    pinch(screen.getByTestId("pinch"));
    expect(off).not.toHaveBeenCalled();
  });

  it("ChartZoomControls renders nothing with active: false", () => {
    const controls = (
      <ChartZoomControls onReset={() => {}} onZoomIn={() => {}} onZoomOut={() => {}} />
    );
    renderWith(undefined, controls);
    expect(screen.getByRole("group", { name: "Chart zoom" })).toBeInTheDocument();
    cleanup();
    renderWith({ active: false }, controls);
    expect(screen.queryByRole("group", { name: "Chart zoom" })).toBeNull();
  });

  it("ChartNavigator stays a read-only overview with active: false: no handles, no drag, no wheel pan", async () => {
    const strip = (onWindowChange: () => void) => (
      <ChartNavigator
        data={categories}
        defaultWindow={{ kind: "index", start: 0, end: 4 }}
        extent={[0, 12]}
        kind="index"
        length={400}
        onWindowChange={onWindowChange}
        valueKeys={["value"]}
      />
    );
    const on = vi.fn();
    const shown = renderWith(undefined, strip(on));
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    zoomProbe(shown.container);
    await settle();
    expect(on).toHaveBeenCalled();
    cleanup();

    const off = vi.fn();
    const inert = renderWith({ active: false }, strip(off));
    expect(inert.container.querySelector('[data-slot="chart-navigator"]')).not.toBeNull();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    const track = inert.container.querySelector('[data-slot="chart-navigator-track"]') as Element;
    expect(track.className).not.toMatch(/cursor-grab|touch-none/);
    fireEvent.pointerDown(track, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 350, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 350, pointerId: 1 });
    zoomProbe(inert.container);
    await settle();
    expect(off).not.toHaveBeenCalled();
  });

  it("CanvasLayer: passive gates hover, active the keyboard cursor, select the activation", () => {
    const layer = (spies: { hover: () => void; activate: () => void }) => (
      <CanvasLayer
        accessibleLabel="Points"
        draw={() => {}}
        height={200}
        hitTest={() => records[0]!}
        onDatapointActivate={spies.activate}
        onDatapointHover={spies.hover}
        points={records}
        width={400}
      />
    );
    const surface = () => document.querySelector('[data-slot="canvas-layer-surface"]') as Element;
    const cursor = () => document.querySelector('[data-slot="canvas-layer-cursor"]');

    const on = { hover: vi.fn(), activate: vi.fn() };
    renderWith(undefined, layer(on));
    fireEvent.pointerMove(surface(), { clientX: 10, clientY: 10 });
    fireEvent.click(surface(), { clientX: 10, clientY: 10 });
    expect(on.hover).toHaveBeenCalled();
    expect(on.activate).toHaveBeenCalled();
    expect(cursor()).not.toBeNull();
    cleanup();

    const quiet = { hover: vi.fn(), activate: vi.fn() };
    renderWith({ passive: false }, layer(quiet));
    fireEvent.pointerMove(surface(), { clientX: 10, clientY: 10 });
    expect(quiet.hover).not.toHaveBeenCalled();
    cleanup();

    const inert = { hover: vi.fn(), activate: vi.fn() };
    renderWith({ active: false }, layer(inert));
    expect(cursor()).toBeNull();
    cleanup();

    const kept = { hover: vi.fn(), activate: vi.fn() };
    renderWith({ select: false }, layer(kept));
    fireEvent.click(surface(), { clientX: 10, clientY: 10 });
    const button = cursor() as HTMLElement;
    act(() => button.focus());
    fireEvent.click(button);
    expect(kept.activate).not.toHaveBeenCalled();
  });

  it("TreeChartMiniMap is a read-only overview when not interactive", () => {
    const map = (onCenter: () => void, interactive?: boolean) => (
      <TreeChartMiniMap
        height={100}
        interactive={interactive}
        nodes={[{ id: "a", x: 0, y: 0, width: 20, height: 10 }]}
        onCenter={onCenter}
        viewport={{ x: 0, y: 0, width: 50, height: 50 }}
        width={200}
      />
    );
    const on = vi.fn();
    renderWith(undefined, map(on));
    fireEvent.pointerDown(screen.getByRole("img"), { clientX: 10, clientY: 10, pointerId: 1 });
    expect(on).toHaveBeenCalled();
    cleanup();
    const off = vi.fn();
    renderWith(undefined, map(off, false));
    const img = screen.getByRole("img");
    expect(img.getAttribute("class")).not.toMatch(/pointer-events-auto|cursor-pointer/);
    fireEvent.pointerDown(img, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(off).not.toHaveBeenCalled();
  });
});
