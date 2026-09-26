/**
 * The palette group, looped (RM-186, ADR 0042 §4).
 *
 * - Default colours: every family in the palette group, rendered from its fixture with NO
 *   `palette`, draws exactly the colour references it drew before RM-186 — the frozen
 *   `DEFAULT_COLORS` below was recorded from the pre-RM-186 code (744f17a2) with this same
 *   harness, so a default that moved fails here by name.
 * - Recolour: passing a `palette` the family accepts changes the colours it draws, and the
 *   chosen ramp's tokens appear in the DOM.
 *
 * DensityScatterChart paints its dots on a canvas; its probe turns on `colorBy` category mode
 * and the legend, so the colours reach the DOM through the legend swatches.
 */

import { cleanup, render } from "@testing-library/react";
import { createElement, type JSXElementConstructor, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@elabs-ai/components-ui";

const BOX = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("./chart-parent-size", async () => {
  const { createElement: h, Fragment } = await import("react");
  return {
    ChartParentSize: ({
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

import { Candlestick } from "./candlestick";
import { ChoroplethFeature } from "./choropleth/choropleth-feature";
import { LiveLine } from "./live-line";
import { PieSlice } from "./pie-slice";
import { RadarArea } from "./radar-area";
import { RadarAxis } from "./radar-axis";
import { RadarGrid } from "./radar-grid";
import { RadarLabels } from "./radar-labels";
import { Ring } from "./ring";
import { SankeyLink } from "./sankey/sankey-link";
import { SankeyNode } from "./sankey/sankey-node";
import { SeriesBar } from "./series-bar";
import type { ChartPalette } from "./chart-context";
import { paletteGroup } from "./props/palette";
import { installCanvasContextStub } from "../test/primitives";
import { CHART_COMPONENTS, PART_COMPONENTS } from "../definitions/components";
import { CHART_DEFINITIONS } from "../definitions/registry";
import type { ChartFixture } from "../definitions/__fixtures__/types";
import { AREA_CHART_FIXTURE } from "../definitions/__fixtures__/area-chart.fixture";
import { BAR_CHART_FIXTURE } from "../definitions/__fixtures__/bar-chart.fixture";
import { BULLET_CHART_FIXTURE } from "../definitions/__fixtures__/bullet-chart.fixture";
import { BUMP_CHART_FIXTURE } from "../definitions/__fixtures__/bump-chart.fixture";
import { CANDLESTICK_CHART_FIXTURE } from "../definitions/__fixtures__/candlestick-chart.fixture";
import { CHOROPLETH_CHART_FIXTURE } from "../definitions/__fixtures__/choropleth-chart.fixture";
import { COMPOSED_CHART_FIXTURE } from "../definitions/__fixtures__/composed-chart.fixture";
import { DENSITY_SCATTER_CHART_FIXTURE } from "../definitions/__fixtures__/density-scatter-chart.fixture";
import { DISTRIBUTION_CHART_FIXTURE } from "../definitions/__fixtures__/distribution-chart.fixture";
import { DUMBBELL_CHART_FIXTURE } from "../definitions/__fixtures__/dumbbell-chart.fixture";
import { FUNNEL_CHART_FIXTURE } from "../definitions/__fixtures__/funnel-chart.fixture";
import { HEATMAP_CHART_FIXTURE } from "../definitions/__fixtures__/heatmap-chart.fixture";
import { LINE_CHART_FIXTURE } from "../definitions/__fixtures__/line-chart.fixture";
import { LIVE_LINE_CHART_FIXTURE } from "../definitions/__fixtures__/live-line-chart.fixture";
import { NETWORK_CHART_FIXTURE } from "../definitions/__fixtures__/network-chart.fixture";
import { PARALLEL_COORDINATES_CHART_FIXTURE } from "../definitions/__fixtures__/parallel-coordinates-chart.fixture";
import { PIE_CHART_FIXTURE } from "../definitions/__fixtures__/pie-chart.fixture";
import { RADAR_CHART_FIXTURE } from "../definitions/__fixtures__/radar-chart.fixture";
import { RING_CHART_FIXTURE } from "../definitions/__fixtures__/ring-chart.fixture";
import { SANKEY_CHART_FIXTURE } from "../definitions/__fixtures__/sankey-chart.fixture";
import { SCATTER_CHART_FIXTURE } from "../definitions/__fixtures__/scatter-chart.fixture";
import { TREE_CHART_FIXTURE } from "../definitions/__fixtures__/tree-chart.fixture";
import { TREEMAP_CHART_FIXTURE } from "../definitions/__fixtures__/treemap-chart.fixture";
import { UNIT_CHART_FIXTURE } from "../definitions/__fixtures__/unit-chart.fixture";
import { WATERFALL_CHART_FIXTURE } from "../definitions/__fixtures__/waterfall-chart.fixture";

type AnyProps = Readonly<Record<string, unknown>>;

/** Every family in the palette group, by definition id, with its fixture. */
const FIXTURES: Readonly<Record<string, ChartFixture>> = {
  AreaChart: AREA_CHART_FIXTURE,
  BarChart: BAR_CHART_FIXTURE,
  BulletChart: BULLET_CHART_FIXTURE,
  BumpChart: BUMP_CHART_FIXTURE,
  CandlestickChart: CANDLESTICK_CHART_FIXTURE,
  ChoroplethChart: CHOROPLETH_CHART_FIXTURE,
  ComposedChart: COMPOSED_CHART_FIXTURE,
  DensityScatterChart: DENSITY_SCATTER_CHART_FIXTURE,
  DistributionChart: DISTRIBUTION_CHART_FIXTURE,
  DumbbellChart: DUMBBELL_CHART_FIXTURE,
  FunnelChart: FUNNEL_CHART_FIXTURE,
  HeatmapChart: HEATMAP_CHART_FIXTURE,
  LineChart: LINE_CHART_FIXTURE,
  LiveLineChart: LIVE_LINE_CHART_FIXTURE,
  NetworkChart: NETWORK_CHART_FIXTURE,
  ParallelCoordinatesChart: PARALLEL_COORDINATES_CHART_FIXTURE,
  PieChart: PIE_CHART_FIXTURE,
  RadarChart: RADAR_CHART_FIXTURE,
  RingChart: RING_CHART_FIXTURE,
  SankeyChart: SANKEY_CHART_FIXTURE,
  ScatterChart: SCATTER_CHART_FIXTURE,
  TreeChart: TREE_CHART_FIXTURE,
  TreemapChart: TREEMAP_CHART_FIXTURE,
  UnitChart: UNIT_CHART_FIXTURE,
  WaterfallChart: WATERFALL_CHART_FIXTURE,
};

/**
 * Extra props a family's probe render needs before its colours reach the DOM. The same
 * props go into BOTH renders (with and without `palette`), so the comparison stays fair.
 */
const PROBE_PROPS: Readonly<Record<string, AnyProps>> = {
  BarChart: {
    data: [
      { name: "A", value: 3, target: 4 },
      { name: "B", value: 5, target: 2 },
    ],
  },
  // Two groups of leaves: the default `depth: 2` lays tiles out only under a group.
  TreemapChart: {
    data: {
      name: "root",
      children: [
        {
          name: "G1",
          children: [
            { name: "A", value: 40 },
            { name: "B", value: 20 },
          ],
        },
        { name: "G2", children: [{ name: "C", value: 30 }] },
      ],
    },
  },
  DensityScatterChart: {
    data: Array.from({ length: 20 }, (_, i) => ({ x: i, y: (i * 13) % 20, segment: `S${i % 3}` })),
    colorBy: { kind: "category", key: "segment" },
    legend: true,
  },
};

/**
 * Extra children a family's probe render needs: `BarChart` colours its series from a palette
 * only once two unfilled `Bar`s would otherwise collide (RM-027).
 */
const PROBE_CHILDREN: Readonly<Record<string, ChartFixture["children"]>> = {
  BarChart: [
    { component: "Bar", props: { dataKey: "value" } },
    { component: "Bar", props: { dataKey: "target" } },
  ],
  // A `Ring` grows its progress arc from zero; unanimated, jsdom sees the painted arc.
  RingChart: [
    { component: "Ring", props: { index: 0, animate: false } },
    { component: "Ring", props: { index: 1, animate: false } },
  ],
};

const COMPONENTS: Readonly<Record<string, JSXElementConstructor<never>>> = {
  ...CHART_COMPONENTS,
  ...PART_COMPONENTS,
  Candlestick,
  LiveLine,
  SeriesBar,
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

function componentFor(name: string): JSXElementConstructor<AnyProps> {
  const component = COMPONENTS[name];
  if (!component) throw new Error(`palette-group.test: no component for "${name}"`);
  return component as JSXElementConstructor<AnyProps>;
}

function renderFamily(id: string, palette?: string): HTMLElement {
  const fixture = FIXTURES[id] as ChartFixture;
  const children = (PROBE_CHILDREN[id] ?? fixture.children).map((child) =>
    createElement(componentFor(child.component), child.props),
  );
  const props = {
    ...fixture.props,
    ...PROBE_PROPS[id],
    ...(palette === undefined ? {} : { palette }),
  };
  const { container } = render(
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(componentFor(id), props, ...children),
    }),
  );
  return container;
}

const VAR_RE = /var\(--[a-z0-9-]+\)/g;

/**
 * Every colour-bearing `var(--…)` reference the render paints, as `tag[attr]=var(--…)` in
 * document order, repeats kept — so two marks that swap colours fail, not just a colour
 * that appears or disappears.
 */
function colorsIn(container: HTMLElement): string[] {
  const found: string[] = [];
  for (const el of Array.from(container.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      if (!["fill", "stroke", "stop-color", "color", "style"].includes(attr.name)) continue;
      for (const match of attr.value.match(VAR_RE) ?? []) {
        found.push(`${el.tagName.toLowerCase()}[${attr.name}]=${match}`);
      }
    }
  }
  return found;
}

/** The palette field a definition carries — its own, or the shared group's. */
function paletteValuesOf(id: string): readonly string[] {
  const definition = CHART_DEFINITIONS[id as keyof typeof CHART_DEFINITIONS] as unknown as {
    fields: Record<string, { values?: readonly string[] } | undefined>;
    groups?: readonly { id: string }[];
  };
  const own = definition.fields.palette?.values;
  if (own) return own;
  if (definition.groups?.some((group) => group.id === "palette")) {
    return (paletteGroup.fields.palette as unknown as { values: readonly string[] }).values;
  }
  return [];
}

/**
 * A palette the family accepts whose tokens its default render does not use — so a
 * recolour is visible whichever palette the family falls back to in code.
 */
function probePalette(id: string, defaultColors: readonly string[]): ChartPalette {
  const values = paletteValuesOf(id);
  for (const candidate of ["mono", "sequential", "categorical"] as const) {
    if (!values.includes(candidate)) continue;
    if (defaultColors.some((color) => TOKEN_OF[candidate].test(color))) continue;
    return candidate;
  }
  throw new Error(`palette-group.test: no probe palette for ${id}`);
}

/** The token family a palette paints with, as it appears in a `var()` reference. */
const TOKEN_OF: Readonly<Record<ChartPalette, RegExp>> = {
  categorical: /var\(--chart-\d+\)/,
  sequential: /var\(--chart-seq-\d\)/,
  diverging: /var\(--chart-div-/,
  mono: /var\(--chart-mono-\d\)/,
  accent: /var\(--chart-accent\)/,
};

/**
 * The colour references each family drew with no `palette`, in document order (`colorsIn`),
 * recorded from the pre-RM-186 code (744f17a2) with this harness
 * (`PALETTE_GROUP_RECORD=1`). RM-186 moves no default, so this never changes with it.
 */
const DEFAULT_COLORS: Readonly<Record<string, readonly string[]>> = {
  AreaChart: [
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "path[stroke]=var(--chart-line-primary)",
  ],
  BarChart: [
    "g[style]=var(--t-fast)",
    "g[style]=var(--ease-standard)",
    "rect[fill]=var(--chart-1)",
    "g[style]=var(--t-fast)",
    "g[style]=var(--ease-standard)",
    "rect[fill]=var(--chart-1)",
    "g[style]=var(--t-fast)",
    "g[style]=var(--ease-standard)",
    "rect[fill]=var(--chart-2)",
    "g[style]=var(--t-fast)",
    "g[style]=var(--ease-standard)",
    "rect[fill]=var(--chart-2)",
  ],
  BulletChart: [
    "rect[fill]=var(--chart-ring-background)",
    "rect[fill]=var(--chart-1)",
    "line[stroke]=var(--chart-foreground)",
  ],
  BumpChart: [
    "path[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "path[stroke]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
  ],
  CandlestickChart: [
    "stop[stop-color]=var(--chart-1)",
    "stop[stop-color]=var(--chart-1)",
    "stop[stop-color]=var(--chart-5)",
    "stop[stop-color]=var(--chart-5)",
  ],
  ChoroplethChart: [
    "g[style]=var(--t-fast)",
    "g[style]=var(--ease-entrance)",
    "path[fill]=var(--chart-1)",
    "path[stroke]=var(--background)",
  ],
  ComposedChart: [
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "rect[fill]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
  ],
  DensityScatterChart: [
    "div[style]=var(--chart-1)",
    "div[style]=var(--chart-2)",
    "div[style]=var(--chart-3)",
    "g[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
  ],
  DistributionChart: [
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "text[fill]=var(--chart-foreground)",
    "rect[fill]=var(--chart-1)",
    "rect[fill]=var(--chart-1)",
    "rect[fill]=var(--chart-1)",
    "rect[fill]=var(--chart-1)",
    "line[stroke]=var(--chart-foreground)",
    "text[fill]=var(--chart-label)",
  ],
  DumbbellChart: [
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-background)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-2)",
    "circle[fill]=var(--chart-background)",
    "circle[stroke]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[stroke]=var(--chart-2)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-3)",
    "circle[fill]=var(--chart-background)",
    "circle[stroke]=var(--chart-3)",
    "circle[fill]=var(--chart-3)",
    "circle[stroke]=var(--chart-3)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
  ],
  FunnelChart: [
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-1)",
  ],
  HeatmapChart: [
    "line[stroke]=var(--chart-foreground-muted)",
    "rect[fill]=var(--chart-seq-4)",
    "rect[fill]=var(--chart-seq-1)",
    "rect[fill]=var(--chart-seq-7)",
    "rect[stroke]=var(--chart-foreground)",
    "rect[fill]=var(--chart-seq-6)",
    "text[fill]=var(--chart-label)",
    "text[fill]=var(--chart-label)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[fill]=var(--chart-foreground-muted)",
    "span[style]=var(--chart-seq-1)",
    "span[style]=var(--chart-seq-3)",
    "span[style]=var(--chart-seq-4)",
    "span[style]=var(--chart-seq-6)",
    "span[style]=var(--chart-seq-7)",
  ],
  LineChart: [
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
    "stop[style]=var(--chart-line-primary)",
  ],
  LiveLineChart: [
    "stop[stop-color]=var(--chart-line-primary)",
    "stop[stop-color]=var(--chart-line-primary)",
    "stop[stop-color]=var(--chart-line-primary)",
    "stop[stop-color]=var(--chart-line-primary)",
    "line[stroke]=var(--chart-line-primary)",
    "circle[stroke]=var(--chart-line-primary)",
    "circle[fill]=var(--chart-line-primary)",
    "circle[fill]=var(--chart-line-primary)",
    "circle[stroke]=var(--chart-background)",
    "rect[fill]=var(--popover)",
    "text[fill]=var(--popover-foreground)",
  ],
  NetworkChart: [
    "path[stroke]=var(--chart-grid)",
    "path[stroke]=var(--chart-grid)",
    "circle[fill]=var(--chart-mono-7)",
    "circle[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-mono-7)",
    "circle[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-mono-7)",
    "circle[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
  ],
  ParallelCoordinatesChart: [
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "path[stroke]=var(--chart-mono-1)",
    "path[stroke]=var(--chart-mono-4)",
    "path[stroke]=var(--chart-mono-7)",
  ],
  PieChart: ["path[fill]=var(--chart-1)", "path[fill]=var(--chart-2)", "path[fill]=var(--chart-3)"],
  RadarChart: [
    "path[stroke]=var(--chart-grid)",
    "path[stroke]=var(--chart-grid)",
    "path[stroke]=var(--chart-grid)",
    "path[stroke]=var(--chart-grid)",
    "path[stroke]=var(--chart-grid)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[fill]=var(--chart-foreground-muted)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "path[fill]=var(--chart-1)",
    "path[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-background)",
  ],
  RingChart: [
    "path[fill]=var(--chart-ring-background)",
    "path[fill]=var(--chart-1)",
    "path[fill]=var(--chart-ring-background)",
    "path[fill]=var(--chart-2)",
  ],
  SankeyChart: [
    "rect[fill]=var(--chart-1)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-2)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-3)",
    "text[fill]=var(--chart-label)",
    "text[stroke]=var(--chart-background)",
    "text[fill]=var(--chart-foreground-muted)",
    "text[stroke]=var(--chart-background)",
    "stop[stop-color]=var(--chart-1)",
    "stop[stop-color]=var(--chart-2)",
    "stop[stop-color]=var(--chart-2)",
    "stop[stop-color]=var(--chart-3)",
  ],
  ScatterChart: [
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[stroke]=var(--chart-1)",
  ],
  TreeChart: [
    "rect[fill]=var(--chart-background)",
    "path[stroke]=var(--flow-edge)",
    "path[stroke]=var(--flow-edge)",
    "circle[fill]=var(--chart-mono-1)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-mono-7)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "circle[fill]=var(--chart-mono-7)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
  ],
  TreemapChart: [
    "rect[fill]=var(--chart-background)",
    "rect[fill]=var(--chart-mono-2)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-mono-2)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-mono-4)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-mono-4)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "rect[fill]=var(--chart-mono-4)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
  ],
  UnitChart: [
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-1)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "circle[fill]=var(--chart-2)",
    "div[style]=var(--chart-1)",
    "div[style]=var(--chart-2)",
  ],
  WaterfallChart: [
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "line[stroke]=var(--chart-grid)",
    "path[fill]=var(--chart-foreground)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "path[fill]=var(--chart-2)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "path[fill]=var(--chart-2)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "path[fill]=var(--chart-foreground)",
    "text[fill]=var(--chart-foreground)",
    "text[stroke]=var(--chart-background)",
    "path[stroke]=var(--chart-foreground-muted)",
    "path[stroke]=var(--chart-foreground-muted)",
    "path[stroke]=var(--chart-foreground-muted)",
  ],
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
  // `layoutSize` (TreemapChart and friends) reads the border box through `offset*`.
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => BOX.width,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
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

const FAMILIES = Object.keys(FIXTURES).sort();

describe("palette group — every family", () => {
  it("covers every chart definition that carries a palette field", () => {
    const withPalette = Object.keys(CHART_DEFINITIONS)
      .filter((id) => paletteValuesOf(id).length > 0)
      .sort();
    expect(withPalette).toEqual(FAMILIES);
  });

  it.each(FAMILIES)("%s draws its pre-RM-186 colours when no palette is passed", (id) => {
    const colors = colorsIn(renderFamily(id));
    if (process.env.PALETTE_GROUP_RECORD) {
      console.log(`PALETTE_GROUP_RECORD ${JSON.stringify({ [id]: colors })}`);
      return;
    }
    expect(colors).toEqual(DEFAULT_COLORS[id]);
  });

  it.each(FAMILIES)("%s recolours when its palette changes", (id) => {
    const before = colorsIn(renderFamily(id));
    const palette = probePalette(id, before);
    cleanup();
    const after = colorsIn(renderFamily(id, palette));
    expect(after).not.toEqual(before);
    expect(after.some((color) => TOKEN_OF[palette].test(color))).toBe(true);
  });
});
