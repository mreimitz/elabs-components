/**
 * Binds each registered definition to the React component it describes (ADR 0042 §6,
 * RM-175). The one module under `definitions/` that imports renderers: the registry and
 * every definition stay pure, and a consumer that only reads definitions (a form, a JSON
 * schema, an agent's catalog) never loads a chart engine by importing them.
 *
 * The compiler checks each binding: every registered id has a component, no other id
 * does, and each component accepts the props its definition describes.
 *
 * Append-only: each entry sits under a `// <Name> — RM-NNN` comment naming the item that
 * added it.
 */

import type { JSXElementConstructor } from "react";

import type { PropsOf } from "@elabs-ai/components-ui/definition";

// LineChart — RM-175
import { LineChart } from "../charts/line-chart";
// AreaChart — RM-175
import { AreaChart } from "../charts/area-chart";
// ComposedChart — RM-175
import { ComposedChart } from "../charts/composed-chart";
// BarChart — RM-175
import { BarChart } from "../charts/bar-chart";
// ScatterChart — RM-175
import { ScatterChart } from "../charts/scatter-chart";
// CandlestickChart — RM-175
import { CandlestickChart } from "../charts/candlestick-chart";
// LiveLineChart — RM-175
import { LiveLineChart } from "../charts/live-line-chart";
// WaterfallChart — RM-175
import { WaterfallChart } from "../charts/waterfall-chart";
// XAxis — RM-175
import { XAxis } from "../charts/x-axis";
// YAxis — RM-175
import { YAxis } from "../charts/y-axis";
// BarValueAxis — RM-175
import { BarValueAxis } from "../charts/bar-value-axis";
// LiveXAxis — RM-175
import { LiveXAxis } from "../charts/live-x-axis";
// Grid — RM-175
import { Grid } from "../charts/grid";
// Bar — RM-175
import { Bar } from "../charts/bar";
// Line — RM-175
import { Line } from "../charts/line";
// Area — RM-175
import { Area } from "../charts/area";
// Scatter — RM-175
import { Scatter } from "../charts/scatter";
// ReferenceLine — RM-175
import { ReferenceLine } from "../charts/reference-line";
// PieChart — RM-176
import { PieChart } from "../charts/pie-chart";
// RingChart — RM-176
import { RingChart } from "../charts/ring-chart";
// FunnelChart — RM-176
import { FunnelChart } from "../charts/funnel-chart";
// RadarChart — RM-176
import { RadarChart } from "../charts/radar-chart";
// UnitChart — RM-176
import { UnitChart } from "../charts/unit-chart";
// BulletChart — RM-176
import { BulletChart } from "../charts/bullet-chart";
// TreemapChart — RM-176
import { TreemapChart } from "../charts/treemap/treemap-chart";
// TreeChart — RM-176
import { TreeChart } from "../charts/tree-chart";
// SankeyChart — RM-176
import { SankeyChart } from "../charts/sankey/sankey-chart";
// NetworkChart — RM-176
import { NetworkChart } from "../charts/network/network-chart";
// ParallelCoordinatesChart — RM-176
import { ParallelCoordinatesChart } from "../charts/parallel-coordinates/parallel-coordinates-chart";
// ChoroplethChart — RM-176
import { ChoroplethChart } from "../charts/choropleth/choropleth-chart";
// HeatmapChart — RM-176
import { HeatmapChart } from "../charts/heatmap/heatmap-chart";
// Gantt — RM-176
import { Gantt } from "../gantt/gantt";
import type { GanttProps } from "../gantt/gantt";
// DistributionChart — RM-176
import { DistributionChart } from "../charts/distribution/distribution-chart";
// DensityScatterChart — RM-176
import { DensityScatterChart } from "../charts/density-scatter/density-scatter-chart";
// DumbbellChart — RM-176
import { DumbbellChart } from "../charts/dumbbell-chart";
// BumpChart — RM-176
import { BumpChart } from "../charts/bump-chart";
// Gauge — RM-176
import { Gauge } from "../charts/gauge";
// Sparkline — RM-176
import { Sparkline } from "../sparkline/sparkline";
// ChartCard — RM-176
import { ChartCard } from "../chart-card/chart-card";
// MetricGrid — RM-176
import { MetricGrid } from "../metric-grid/metric-grid";
import type {
  CHART_DEFINITIONS,
  ChartDefinitionId,
  PART_DEFINITIONS,
  PartDefinitionId,
  SURFACE_DEFINITIONS,
  SurfaceDefinitionId,
} from "./registry";

/** Each id's component, accepting the props its definition describes. */
type ComponentsFor<Defs, Id extends keyof Defs> = {
  readonly [K in Id]: JSXElementConstructor<PropsOf<Defs[K]>>;
};

/** The component each chart definition describes, keyed by the definition's id. */
export const CHART_COMPONENTS = {
  // LineChart — RM-175
  LineChart,
  // AreaChart — RM-175
  AreaChart,
  // ComposedChart — RM-175
  ComposedChart,
  // BarChart — RM-175
  BarChart,
  // ScatterChart — RM-175
  ScatterChart,
  // CandlestickChart — RM-175
  CandlestickChart,
  // LiveLineChart — RM-175
  LiveLineChart,
  // WaterfallChart — RM-175
  WaterfallChart,
  // PieChart — RM-176
  PieChart,
  // RingChart — RM-176
  RingChart,
  // FunnelChart — RM-176
  FunnelChart,
  // RadarChart — RM-176
  RadarChart,
  // UnitChart — RM-176
  UnitChart,
  // BulletChart — RM-176
  BulletChart,
  // TreemapChart — RM-176
  TreemapChart,
  // TreeChart — RM-176
  TreeChart,
  // SankeyChart — RM-176
  SankeyChart,
  // NetworkChart — RM-176
  NetworkChart,
  // ParallelCoordinatesChart — RM-176
  ParallelCoordinatesChart,
  // ChoroplethChart — RM-176
  ChoroplethChart,
  // HeatmapChart — RM-176
  HeatmapChart,
  // Gantt — RM-176. Cast: `Gantt` carries compound statics (`Gantt.Bars`, …) typed
  // against a prop interface the module does not export; declaration emit for this
  // object cannot name it, so the entry is widened to the one signature this map needs.
  Gantt: Gantt as JSXElementConstructor<GanttProps>,
  // DistributionChart — RM-176
  DistributionChart,
  // DensityScatterChart — RM-176
  DensityScatterChart,
  // DumbbellChart — RM-176
  DumbbellChart,
  // BumpChart — RM-176
  BumpChart,
} as const satisfies ComponentsFor<typeof CHART_DEFINITIONS, ChartDefinitionId>;

/** The component each part definition describes, keyed by the definition's id. */
export const PART_COMPONENTS = {
  // XAxis — RM-175
  XAxis,
  // YAxis — RM-175
  YAxis,
  // BarValueAxis — RM-175
  BarValueAxis,
  // LiveXAxis — RM-175
  LiveXAxis,
  // Grid — RM-175
  Grid,
  // Bar — RM-175
  Bar,
  // Line — RM-175
  Line,
  // Area — RM-175
  Area,
  // Scatter — RM-175
  Scatter,
  // ReferenceLine — RM-175
  ReferenceLine,
} as const satisfies ComponentsFor<typeof PART_DEFINITIONS, PartDefinitionId>;

/** The component each surface definition describes, keyed by the definition's id. */
export const SURFACE_COMPONENTS = {
  // Gauge — RM-176
  Gauge,
  // Sparkline — RM-176
  Sparkline,
  // ChartCard — RM-176
  ChartCard,
  // MetricGrid — RM-176
  MetricGrid,
} as const satisfies ComponentsFor<typeof SURFACE_DEFINITIONS, SurfaceDefinitionId>;
