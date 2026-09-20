/**
 * The chart tiles' metadata — a plain module, so server components can read counts and names
 * from it (a "use client" module's non-component exports are opaque on the server). The renders
 * live in `chart-tiles.tsx`, keyed by the same ids; the `Record<ChartTileId, …>` type there
 * fails the build when the two drift.
 */
import type { galleryCopy } from "../../content/copy";

export type ChartGroupId = keyof typeof galleryCopy.charts.groups;
export type ChartTileId = keyof typeof galleryCopy.charts.tiles;

export interface ChartTileMeta {
  id: ChartTileId;
  /** The exported container name — also the key into `story-ids.json`. */
  component: string;
  group: ChartGroupId;
  /** Shown on the home page; every tile shows on `/charts`. */
  featured?: boolean;
  /** Spans two columns where the grid has them (wide marks: heatmap, sankey). */
  wide?: boolean;
  /** The mark sizes itself (a cell grid, a waffle); the tile gives it width, not a fixed height. */
  auto?: boolean;
}

export const CHART_TILE_META: ChartTileMeta[] = [
  { id: "line", component: "LineChart", group: "time", featured: true },
  { id: "area", component: "AreaChart", group: "time", featured: true },
  { id: "composed", component: "ComposedChart", group: "time", featured: true },
  { id: "live", component: "LiveLineChart", group: "time" },
  { id: "candlestick", component: "CandlestickChart", group: "time" },
  { id: "bump", component: "BumpChart", group: "time", featured: true },
  { id: "bar", component: "BarChart", group: "compare", featured: true },
  { id: "dumbbell", component: "DumbbellChart", group: "compare", featured: true },
  { id: "waterfall", component: "WaterfallChart", group: "compare", featured: true },
  { id: "radar", component: "RadarChart", group: "compare", featured: true },
  { id: "parallel", component: "ParallelCoordinatesChart", group: "compare" },
  { id: "bullet", component: "BulletChart", group: "compare" },
  { id: "pie", component: "PieChart", group: "share", featured: true },
  { id: "ring", component: "RingChart", group: "share", featured: true },
  { id: "unit", component: "UnitChart", group: "share", auto: true },
  { id: "treemap", component: "TreemapChart", group: "share", featured: true },
  { id: "funnel", component: "FunnelChart", group: "share", featured: true },
  {
    id: "heatmap",
    component: "HeatmapChart",
    group: "distribution",
    featured: true,
    wide: true,
    auto: true,
  },
  { id: "scatter", component: "ScatterChart", group: "distribution" },
  { id: "strip", component: "DistributionChart", group: "distribution", featured: true },
  { id: "box", component: "DistributionChart", group: "distribution" },
  { id: "sankey", component: "SankeyChart", group: "flow", wide: true, auto: true },
  { id: "network", component: "NetworkChart", group: "flow" },
  { id: "tree", component: "TreeChart", group: "flow" },
  { id: "gauge", component: "Gauge", group: "single" },
];

export const CHART_TILE_COUNT = CHART_TILE_META.length;
export const CHART_TILE_COMPONENTS = Array.from(new Set(CHART_TILE_META.map((t) => t.component)));
export const CHART_GROUP_IDS = Array.from(new Set(CHART_TILE_META.map((t) => t.group)));
