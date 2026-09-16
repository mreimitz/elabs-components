/**
 * ProcessCompare (RM-064) — public surface: the compare view, its sub-parts, and the pure
 * diff-to-graph helpers a host can reuse to build its own superimposed reading.
 */
export { ProcessCompare } from "./process-compare";
export type {
  ProcessCompareMode,
  ProcessCompareProps,
  ProcessCompareSide,
} from "./process-compare";
export { CompareSide } from "./compare-side";
export type { CompareSideProps } from "./compare-side";
export { CompareKpiStrip } from "./compare-kpi-strip";
export type { CompareKpiStripProps, CompareKpiStripSide } from "./compare-kpi-strip";
export { resolveCompareKpis } from "./compare-model";
export type { CompareSideInput, CompareSideKpis } from "./compare-model";
export {
  DIFF_STATE_TOKEN,
  diffColorScale,
  diffStateByActivity,
  diffToProcessGraph,
  EMPTY_PROCESS_GRAPH,
} from "./diff-to-graph";
