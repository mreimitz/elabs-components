/**
 * chart-spec.ts — Serializable ChartSpec types for AutoChart.
 *
 * These are pure data types with no functions or React dependencies.
 * Shape is designed to match what an LLM tool-call emits: flat tabular rows
 * with explicit field names for x, series, and optional display hints.
 */

import type { ChartValueFormat } from "../charts/value-format";
import type { TreemapNode } from "../charts/treemap/treemap-layout";

/**
 * Every chart shape `AutoChart` can render from a spec (RM-038).
 *
 * The first seven are the original Core-7; the thirteen after them are the
 * wave-1/2 containers (`CandlestickChart`, `HeatmapChart`, `WaterfallChart`,
 * `DumbbellChart`, `UnitChart`, `TreemapChart`, `DistributionChart`,
 * `BumpChart`, plus the streamgraph and diverging-bar readings of `AreaChart`
 * and `BarChart`).
 *
 * DELIBERATELY ABSENT — `network`, `parallel`, `tree`, `sankey`. Those four
 * read a data shape that a flat `{ x, series[] }` spec cannot express without
 * ambiguity (a node/link pair, a per-row dimension list, a nested hierarchy
 * whose edges carry the meaning), so a wrong guess would render a confidently
 * wrong picture rather than fall back. They stay explicit-only: reach for
 * `NetworkChart` / `ParallelCoordinatesChart` / `TreeChart` / `SankeyChart`
 * directly. `AutoChart` renders `ChartFallback` for them.
 *
 * The runtime companion list is `CHART_TYPES` in `./infer-chart-type`; the two
 * are locked together by `chartTypeUnionMembers` in `auto-chart.test.tsx`, so
 * adding a member here without adding it there fails the suite.
 */
export type ChartType =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "scatter"
  | "radar"
  | "funnel"
  | "candlestick"
  | "heatmap"
  | "calendar"
  | "waterfall"
  | "dumbbell"
  | "unit"
  | "treemap"
  | "histogram"
  | "box"
  | "strip"
  | "bump"
  | "stream"
  | "diverging-bar";

/**
 * A declared hint about what the rows MEAN, for the shapes structure alone
 * cannot separate (RM-038).
 *
 * - `"steps"` — the rows are a running sequence of deltas that add up to a
 *   total (a bridge/waterfall), not independent categories.
 * - `"records"` — one row is one OBSERVATION, not a pre-aggregated category;
 *   this is what turns a numeric column into a distribution rather than a
 *   series.
 * - `"ranking"` — long rows of `(period, entity, value)` whose interest is the
 *   ORDER of the entities per period, not the magnitudes.
 */
export type ChartSpecKind = "steps" | "records" | "ranking";

/**
 * How loud the picture should be. `"analytical"` (the default) keeps the
 * conventional chart; `"editorial"` asks for the countable, one-mark-per-unit
 * reading where one exists (a waffle instead of a pie).
 */
export type ChartSpecEmphasis = "analytical" | "editorial";

/**
 * How to format numeric values in labels and tooltips.
 *
 * The union now lives in `charts/value-format.ts` alongside the rule that reads
 * it, so the spec and the axis cannot drift apart; `ValueFormat` stays the
 * public name a spec author writes. This is a type-only re-export — the module
 * stays free of runtime code, as its header promises.
 */
export type ValueFormat = ChartValueFormat;

/** One data series (column) in the chart. */
export interface ChartSeriesSpec {
  /** Field name in each data row holding this series' value. */
  key: string;
  /** Legend / tooltip label. Defaults to `key` when omitted. */
  label?: string;
  /**
   * Series color. Honored ONLY when it is a `var(--chart-N)` CSS token reference
   * (e.g. `"var(--chart-2)"`). Raw hex, `rgb()`, `url(`, etc. are ignored and the
   * palette is used instead — keeps all charts token-driven and theme-safe.
   */
  color?: string;
}

/**
 * The serializable chart specification emitted by an LLM tool-call.
 * AutoChart reads this and picks + renders the correct chart container.
 */
export interface ChartSpec {
  /**
   * Chart type. Optional — AutoChart infers the best type when omitted.
   * Explicit type ALWAYS wins over inference.
   */
  type?: ChartType;

  /** Flat tabular rows. Each row is one x-axis point (or one pie/funnel slice). */
  data: Record<string, unknown>[];

  /**
   * Field name in each row that carries the x-axis / category / slice-label value.
   * For pie/funnel: this is the slice label.
   * For scatter with a time x: this field should hold ISO date strings or Date objects.
   */
  x: string;

  /**
   * Hint about the x-axis value type. Drives date coercion and inference.
   * Omit to let AutoChart infer from data values.
   */
  xType?: "time" | "category" | "number";

  /**
   * Data series to render. Can be a string shorthand (treated as `{ key: string }`)
   * or a full `ChartSeriesSpec`.
   */
  series: Array<ChartSeriesSpec | string>;

  /**
   * A SECOND field, read differently by the two families that need one (RM-038):
   *
   * - dumbbell / slope — the "after" measure, when `series` carries only the
   *   "before" one. `{ x: "region", series: ["2024"], y2: "2025" }`.
   * - heatmap / calendar — the ROW key, when `x` is the column key. The value
   *   is still `series[0]`.
   *
   * One field rather than two because a spec never needs both readings at once:
   * a dumbbell has two measures and one category, a heatmap two categories and
   * one measure, and which it is falls out of whether `y2` names a numeric or a
   * categorical column.
   */
  y2?: string;

  /**
   * The grouping column for a distribution — `{ valueKey: series[0], group }`.
   * Present turns a single numeric column into one distribution per group
   * (`box`, or `strip` while the groups are still small enough to draw every
   * record).
   */
  group?: string;

  /** The hierarchy to render as a treemap. Present, it wins over `data`. */
  hierarchy?: TreemapNode;

  /** What the rows MEAN, where structure alone is ambiguous. See {@link ChartSpecKind}. */
  kind?: ChartSpecKind;

  /** How loud the picture should be. See {@link ChartSpecEmphasis}. */
  emphasis?: ChartSpecEmphasis;

  /** Chart title — rendered as a heading above the chart and as the accessible label. */
  title?: string;

  /** Supplemental description for screen readers (e.g. "Revenue 2024, 3 series"). */
  description?: string;

  /** Stack bars/areas instead of grouping them. Default: false */
  stacked?: boolean;

  /** Bar/funnel orientation. Default: "vertical" for bars. */
  orientation?: "vertical" | "horizontal";

  /** Render a donut hole in pie charts. Default: false */
  donut?: boolean;

  /**
   * Show the legend. Default: true when series.length > 1, false for single series.
   * Pass `true` to force-show or `false` to force-hide.
   */
  legend?: boolean;

  /**
   * How to format numeric values in labels/tooltips. Default: `"compact"` —
   * a chart in a chat bubble or a dashboard tile has no room for
   * `50012102.632741`, and the exact value stays one click away. Pass
   * `"number"` to keep every digit in place.
   */
  valueFormat?: ValueFormat;

  /**
   * ISO 4217 code for `valueFormat: "currency"` (e.g. `"EUR"`). Falls back to
   * `ChartConfigProvider`'s `currency`, then `"USD"`. Never inferred from the
   * locale — the reader's language does not tell you what the money is.
   */
  currency?: string;
}
