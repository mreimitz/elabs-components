/**
 * auto-chart barrel — own surface only.
 * Do NOT re-export anything from the parent charts barrel here.
 */

// Component + props
export { AutoChart, type AutoChartProps, ChartFallback } from "./auto-chart";

// Serializable spec types (safe to use in server-rendered contexts / LLM outputs)
export type {
  ChartSpec,
  ChartSeriesSpec,
  ChartSpecEmphasis,
  ChartSpecKind,
  ChartSpecPalette,
  ChartType,
  ValueFormat,
} from "./chart-spec";
// Axes — RM-108
export type { AxisSpec } from "./chart-spec";

// Inference utilities (useful for pre-validation, debug panels or testing)
export {
  CALENDAR_MIN_ROWS,
  CHART_SPEC_PALETTES,
  CHART_TYPES,
  type ChartTypeExplanation,
  explainChartType,
  inferChartType,
  isCategoricalField,
  isChartSpecPalette,
  isChartType,
  isNumericField,
  isTemporalField,
  readsAsBeforeAfterPair,
  STRIP_MAX_ROWS_PER_GROUP,
} from "./infer-chart-type";
