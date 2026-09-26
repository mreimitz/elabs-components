/**
 * The chart definition registry (ADR 0042 §6, RM-175): every chart and part definition,
 * keyed by its id. Definitions only — the React components they describe are bound in
 * `components.ts`, so importing the registry never pulls in a renderer. A family module
 * never imports this file; the registry imports the families.
 *
 * Append-only: each entry sits under a `// <Name> — RM-NNN` comment naming the item that
 * added it.
 *
 * Pure: definitions and the ui definition base only.
 */

import type { AnyChartDefinition, AnyPartDefinition, AnySurfaceDefinition } from "./define-chart";
// LineChart — RM-175
import { LINE_CHART } from "./line-chart.definition";
// AreaChart — RM-175
import { AREA_CHART } from "./area-chart.definition";
// ComposedChart — RM-175
import { COMPOSED_CHART } from "./composed-chart.definition";
// BarChart — RM-175
import { BAR_CHART } from "./bar-chart.definition";
// ScatterChart — RM-175
import { SCATTER_CHART } from "./scatter-chart.definition";
// CandlestickChart — RM-175
import { CANDLESTICK_CHART } from "./candlestick-chart.definition";
// LiveLineChart — RM-175
import { LIVE_LINE_CHART } from "./live-line-chart.definition";
// WaterfallChart — RM-175
import { WATERFALL_CHART } from "./waterfall-chart.definition";
// XAxis — RM-175
import { X_AXIS_PART } from "./parts/x-axis.definition";
// YAxis — RM-175
import { Y_AXIS_PART } from "./parts/y-axis.definition";
// BarValueAxis — RM-175
import { BAR_VALUE_AXIS_PART } from "./parts/bar-value-axis.definition";
// LiveXAxis — RM-175
import { LIVE_X_AXIS_PART } from "./parts/live-x-axis.definition";
// Grid — RM-175
import { GRID_PART } from "./parts/grid.definition";
// Bar — RM-175
import { BAR_PART } from "./parts/bar.definition";
// Line — RM-175
import { LINE_PART } from "./parts/line.definition";
// Area — RM-175
import { AREA_PART } from "./parts/area.definition";
// Scatter — RM-175
import { SCATTER_PART } from "./parts/scatter.definition";
// ReferenceLine — RM-175
import { REFERENCE_LINE_PART } from "./parts/reference-line.definition";
// PieChart — RM-176
import { PIE_CHART } from "./pie-chart.definition";
// RingChart — RM-176
import { RING_CHART } from "./ring-chart.definition";
// FunnelChart — RM-176
import { FUNNEL_CHART } from "./funnel-chart.definition";
// RadarChart — RM-176
import { RADAR_CHART } from "./radar-chart.definition";
// UnitChart — RM-176
import { UNIT_CHART } from "./unit-chart.definition";
// BulletChart — RM-176
import { BULLET_CHART } from "./bullet-chart.definition";
// TreemapChart — RM-176
import { TREEMAP_CHART } from "./treemap-chart.definition";
// TreeChart — RM-176
import { TREE_CHART } from "./tree-chart.definition";
// SankeyChart — RM-176
import { SANKEY_CHART } from "./sankey-chart.definition";
// NetworkChart — RM-176
import { NETWORK_CHART } from "./network-chart.definition";
// ParallelCoordinatesChart — RM-176
import { PARALLEL_COORDINATES_CHART } from "./parallel-coordinates-chart.definition";
// ChoroplethChart — RM-176
import { CHOROPLETH_CHART } from "./choropleth-chart.definition";
// HeatmapChart — RM-176
import { HEATMAP_CHART } from "./heatmap-chart.definition";
// Gantt — RM-176
import { GANTT } from "./gantt.definition";
// DistributionChart — RM-176
import { DISTRIBUTION_CHART } from "./distribution-chart.definition";
// DensityScatterChart — RM-176
import { DENSITY_SCATTER_CHART } from "./density-scatter-chart.definition";
// DumbbellChart — RM-176
import { DUMBBELL_CHART } from "./dumbbell-chart.definition";
// BumpChart — RM-176
import { BUMP_CHART } from "./bump-chart.definition";
// Gauge — RM-176
import { GAUGE } from "./gauge.definition";
// Sparkline — RM-176
import { SPARKLINE } from "./sparkline.definition";
// ChartCard — RM-176
import { CHART_CARD } from "./chart-card.definition";
// MetricGrid — RM-176
import { METRIC_GRID } from "./metric-grid.definition";

/** Every chart definition, keyed by its id (the component's name). */
export const CHART_DEFINITIONS = {
  // LineChart — RM-175
  LineChart: LINE_CHART,
  // AreaChart — RM-175
  AreaChart: AREA_CHART,
  // ComposedChart — RM-175
  ComposedChart: COMPOSED_CHART,
  // BarChart — RM-175
  BarChart: BAR_CHART,
  // ScatterChart — RM-175
  ScatterChart: SCATTER_CHART,
  // CandlestickChart — RM-175
  CandlestickChart: CANDLESTICK_CHART,
  // LiveLineChart — RM-175
  LiveLineChart: LIVE_LINE_CHART,
  // WaterfallChart — RM-175
  WaterfallChart: WATERFALL_CHART,
  // PieChart — RM-176
  PieChart: PIE_CHART,
  // RingChart — RM-176
  RingChart: RING_CHART,
  // FunnelChart — RM-176
  FunnelChart: FUNNEL_CHART,
  // RadarChart — RM-176
  RadarChart: RADAR_CHART,
  // UnitChart — RM-176
  UnitChart: UNIT_CHART,
  // BulletChart — RM-176
  BulletChart: BULLET_CHART,
  // TreemapChart — RM-176
  TreemapChart: TREEMAP_CHART,
  // TreeChart — RM-176
  TreeChart: TREE_CHART,
  // SankeyChart — RM-176
  SankeyChart: SANKEY_CHART,
  // NetworkChart — RM-176
  NetworkChart: NETWORK_CHART,
  // ParallelCoordinatesChart — RM-176
  ParallelCoordinatesChart: PARALLEL_COORDINATES_CHART,
  // ChoroplethChart — RM-176
  ChoroplethChart: CHOROPLETH_CHART,
  // HeatmapChart — RM-176
  HeatmapChart: HEATMAP_CHART,
  // Gantt — RM-176
  Gantt: GANTT,
  // DistributionChart — RM-176
  DistributionChart: DISTRIBUTION_CHART,
  // DensityScatterChart — RM-176
  DensityScatterChart: DENSITY_SCATTER_CHART,
  // DumbbellChart — RM-176
  DumbbellChart: DUMBBELL_CHART,
  // BumpChart — RM-176
  BumpChart: BUMP_CHART,
} as const satisfies Readonly<Record<string, AnyChartDefinition>>;

/** Every part definition, keyed by its id (the component's name). */
export const PART_DEFINITIONS = {
  // XAxis — RM-175
  XAxis: X_AXIS_PART,
  // YAxis — RM-175
  YAxis: Y_AXIS_PART,
  // BarValueAxis — RM-175
  BarValueAxis: BAR_VALUE_AXIS_PART,
  // LiveXAxis — RM-175
  LiveXAxis: LIVE_X_AXIS_PART,
  // Grid — RM-175
  Grid: GRID_PART,
  // Bar — RM-175
  Bar: BAR_PART,
  // Line — RM-175
  Line: LINE_PART,
  // Area — RM-175
  Area: AREA_PART,
  // Scatter — RM-175
  Scatter: SCATTER_PART,
  // ReferenceLine — RM-175
  ReferenceLine: REFERENCE_LINE_PART,
} as const satisfies Readonly<Record<string, AnyPartDefinition>>;

/** Every surface definition, keyed by its id (the component's name). */
export const SURFACE_DEFINITIONS = {
  // Gauge — RM-176
  Gauge: GAUGE,
  // Sparkline — RM-176
  Sparkline: SPARKLINE,
  // ChartCard — RM-176
  ChartCard: CHART_CARD,
  // MetricGrid — RM-176
  MetricGrid: METRIC_GRID,
} as const satisfies Readonly<Record<string, AnySurfaceDefinition>>;

/** The id of a registered chart definition. */
export type ChartDefinitionId = keyof typeof CHART_DEFINITIONS;

/** The id of a registered part definition. */
export type PartDefinitionId = keyof typeof PART_DEFINITIONS;

/** The id of a registered surface definition. */
export type SurfaceDefinitionId = keyof typeof SURFACE_DEFINITIONS;
