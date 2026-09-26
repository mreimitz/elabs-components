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

import type { AnyChartDefinition, AnyPartDefinition } from "./define-chart";
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

/** The id of a registered chart definition. */
export type ChartDefinitionId = keyof typeof CHART_DEFINITIONS;

/** The id of a registered part definition. */
export type PartDefinitionId = keyof typeof PART_DEFINITIONS;
