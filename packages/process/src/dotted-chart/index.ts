/**
 * DottedChart (RM-059) — public surface: the chart, its labels, and the pure model a host
 * can reuse (row order, brush enumeration, category colouring).
 */
export { DOTTED_CHART_DOT_RADIUS, DottedChart } from "./dotted-chart";
export type {
  DottedChartColor,
  DottedChartDatum,
  DottedChartFilterIntent,
  DottedChartProps,
} from "./dotted-chart";
export { DOTTED_CHART_DEFAULT_LABELS } from "./dotted-chart-labels";
export type { DottedChartLabels } from "./dotted-chart-labels";
export { casesInBrush, computeDots, rankCategoryColors } from "./compute-dots";
export type {
  ComputeDotsOptions,
  DottedChartCategory,
  DottedChartDot,
  DottedChartModel,
  DottedChartRow,
  DottedChartSort,
  DottedChartX,
} from "./compute-dots";
