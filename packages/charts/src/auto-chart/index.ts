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
  ChartType,
  ValueFormat,
} from "./chart-spec";

// Inference utilities (useful for pre-validation, debug panels or testing)
export {
  CALENDAR_MIN_ROWS,
  CHART_TYPES,
  type ChartTypeExplanation,
  explainChartType,
  inferChartType,
  isCategoricalField,
  isChartType,
  isNumericField,
  isTemporalField,
  readsAsBeforeAfterPair,
  STRIP_MAX_ROWS_PER_GROUP,
} from "./infer-chart-type";
