/**
 * chart-type-summary.ts — a short, generic label per `ChartType`.
 *
 * `useChartAutoSummary`/`describeSeries` (`../charts/chart-a11y`) generate a
 * real, data-aware sentence ("Line chart, 3 series over 2023–2025; Revenue
 * peaks at…") for the handful of container families that call them —
 * `AutoSummaryKind`'s five, plus `"sankey"` (RM-184). Every OTHER `ChartType`
 * a spec can name — a candlestick, a treemap, a choropleth — has no such
 * sentence today, only whatever `accessibleLabel`/`accessibleDescription` the
 * spec itself supplies. `chartTypeSummaryLabel` is the one place that still
 * names every one of those types in plain words, so a caller building its own
 * fallback description (or an future generic summary covering the full
 * `ChartType` union) has one word to start from instead of guessing.
 *
 * Kept OUT of `chart-a11y.tsx` deliberately: that module is generic, reusable
 * across every container `charts/*` builds, and has no reason to depend on
 * `ChartType` — the spec-level union `auto-chart/` itself owns. This module
 * sits beside `chart-spec.ts`/`validate-chart-spec.ts`, the other two
 * `ChartType`-keyed concerns.
 */
import type { ChartType } from "./chart-spec";

/** Every `ChartType` union member's own plain-word label — a compile-time
 * `Record`, so a new `ChartType` fails `typecheck` the moment it ships with
 * no label here. */
export const CHART_TYPE_SUMMARY_LABEL: Record<ChartType, string> = {
  line: "Line chart",
  area: "Area chart",
  bar: "Bar chart",
  pie: "Pie chart",
  scatter: "Scatter chart",
  radar: "Radar chart",
  funnel: "Funnel chart",
  candlestick: "Candlestick chart",
  heatmap: "Heatmap",
  calendar: "Calendar heatmap",
  waterfall: "Waterfall chart",
  dumbbell: "Dumbbell chart",
  unit: "Unit chart",
  treemap: "Treemap",
  histogram: "Histogram",
  box: "Box plot",
  strip: "Strip plot",
  bump: "Bump chart",
  stream: "Stream graph",
  "diverging-bar": "Diverging bar chart",
  "dual-axis": "Dual-axis chart",
  choropleth: "Choropleth map",
};

/**
 * `type`'s own label, or the generic "Chart" fallback for a value TypeScript
 * never validated (an agent's raw JSON `spec.type`, read before
 * `validateChartSpec` runs) — never a thrown error, matching this whole
 * module's "describe, don't reject" spirit.
 */
export function chartTypeSummaryLabel(type: string): string {
  return (CHART_TYPE_SUMMARY_LABEL as Record<string, string>)[type] ?? "Chart";
}
