/**
 * auto-chart barrel — own surface only.
 * Do NOT re-export anything from the parent charts barrel here.
 */

// Component + props
export { AutoChart, type AutoChartProps, ChartFallback } from "./auto-chart";

// Serializable spec types (safe to use in server-rendered contexts / LLM outputs)
export type { ChartSpec, ChartSeriesSpec, ChartType, ValueFormat } from "./chart-spec";

// Inference utility (useful for pre-validation or testing)
export { inferChartType, isTemporalField, isNumericField } from "./infer-chart-type";
