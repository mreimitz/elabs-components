/**
 * chart-spec.ts — Serializable ChartSpec types for AutoChart.
 *
 * These are pure data types with no functions or React dependencies.
 * Shape is designed to match what an LLM tool-call emits: flat tabular rows
 * with explicit field names for x, series, and optional display hints.
 */

import type { Responsive } from "../charts/chart-breakpoint";
import type { ChartValueLabels, SeriesLabelMode } from "../charts/labels/use-chart-labels";
import type { ChartValueFormat } from "../charts/value-format";
import type { DateFormatPreset } from "../charts/date-format";
import type { TreemapNode } from "../charts/treemap/treemap-layout";
import type { BarComparison, BarComparisonLabel, BarOverlay } from "../charts/bar-overlays";
import type { BarSort } from "../charts/bar-stacking";
import type { ChartColorBy } from "../charts/chart-context";

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
 * How a treemap spec colours its leaves (#306) — a DATA encoding, which is why
 * it lives on the spec surface when other presentation props do not.
 *
 * - `"mono"` (default) — colour encodes NOTHING: one neutral shade per leaf;
 *   groups read apart by their title band + gap alone.
 * - `"sequential"` — colour encodes each leaf's VALUE (a ramp that restates
 *   area).
 * - `"categorical"` — colour encodes the top-level GROUP (one hue per group,
 *   ≤ 4 groups, else mono). Hue is then a channel, so keep the group bands
 *   or labels as the non-colour one.
 */
export type ChartSpecPalette = "mono" | "sequential" | "categorical";

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

  /**
   * Leaf colouring for a `"treemap"` spec. See {@link ChartSpecPalette}.
   * Honoured by the treemap only; omitted (or not one of the three values)
   * renders `"mono"`.
   */
  palette?: ChartSpecPalette;

  /** What the rows MEAN, where structure alone is ambiguous. See {@link ChartSpecKind}. */
  kind?: ChartSpecKind;

  /** How loud the picture should be. See {@link ChartSpecEmphasis}. */
  emphasis?: ChartSpecEmphasis;

  /** Chart title — rendered as a heading above the chart and as the accessible label. */
  title?: string;

  /** Supplemental description for screen readers (e.g. "Revenue 2024, 3 series"). */
  description?: string;

  /**
   * Stack bars/areas instead of grouping them. Bars also take `"percent"`
   * (each category normalised to 100 %) and `"diverging"` (Likert rows
   * centred on `divergingCenter`) — RM-113. Default: false
   */
  stacked?: boolean | "percent" | "diverging";

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

  // Axes — RM-108
  /** Per-axis range, ticks, scale, title, grid and position (RM-108) — see {@link AxisSpec}. */
  axes?: { x?: AxisSpec; y?: AxisSpec; y2?: AxisSpec };

  /**
   * How to format an x-axis Date tick (RM-109) — one rung of the
   * `date-format.ts` ladder (`"year"|"yearShort"|"month"|"day"|"weekday"|
   * "hour"|"minute"`). Default: the ladder picks a rung from the series'
   * own span and tick count (`dateFormatForSpan`) — a 36-hour series reads
   * hours, a decade-long one reads years. Ignored on a non-time x-scale
   * (category/linear), same as every other Date-shaped axis input.
   */
  dateFormat?: DateFormatPreset;

  /**
   * Which spec fields a host's selection resolves against (RM-073). Defaults:
   * `category` → `x`, `series` → the series keys. Lets a dashboard map its
   * selection field to any chart without knowing the chart type.
   */
  fields?: { category?: string; series?: string };

  // Labels — RM-110
  /** Series end labels / key fallback, automatic value labels and scatter point labels (RM-110) — see {@link ChartLabelsSpec}. */
  labels?: ChartLabelsSpec;

  // BarChart — RM-113
  /** `stacked: "diverging"`: the series centred on the zero line (a Likert "Neutral"). */
  divergingCenter?: string;
  /** Bar row order: `"asc"`/`"desc"` by value (stack total when stacked) or `{ by, dir }`. */
  sort?: BarSort;
  /** Gather bar rows by this column, with a header per group. */
  groupBy?: string;
  /** Colour bars by another column (categorical ≤ 6 hues, or a sequential / diverging ramp). */
  colorBy?: ChartColorBy;
  /** Per-bar value markers and range spans (confidence intervals, targets). */
  overlays?: BarOverlay[];
  /** A muted prior-period column behind each bar; `labels.comparison` picks its grey label. */
  comparison?: BarComparison;
}

// Labels — RM-110
/**
 * The serialisable label-engine subset (RM-110). Every field is optional and
 * off by default, so a spec without `labels` renders exactly as before.
 */
export interface ChartLabelsSpec {
  /** line / area: where each series names itself — `"end"` | `"key"` | `"none"`, or `{ base, medium?, narrow? }`. */
  series?: Responsive<SeriesLabelMode>;
  /** line / area: automatic value labels on every series — `{ placement: "first" | "last" | "all" | "peaks", count?, minGap?, outline?, matchColor?, format? }`. */
  values?: ChartValueLabels;
  /** scatter: point labels — `key` is the row field holding the text; `mode` `"auto"` (default) | `"all"`; `priorityKey` a numeric row field (higher survives). */
  points?: { key: string; mode?: "auto" | "all"; priorityKey?: string };

  // BarChart — RM-113
  /** bar: the grey label on each `comparison` column — `"value"` | `"difference"` | `"none"` (default). */
  comparison?: BarComparisonLabel;
}

// Axes — RM-108

/**
 * One axis of a cartesian `ChartSpec` (RM-108) — the serialisable subset of
 * the `XAxis`/`YAxis`/`Grid` props. Honoured by the line, area, bar,
 * scatter, candlestick and composed families; ignored elsewhere.
 *
 * `y2` is the right-hand value axis of a dual-axis chart. No spec series can
 * target it yet, so `AutoChart` ignores it today.
 */
export interface AxisSpec {
  /**
   * `[lower, upper]` in data units; `"auto"` keeps the data-derived end. A
   * bar axis always includes 0 (a lower bound above 0 is ignored). On `x`,
   * only a numeric x (`xType: "number"`) honours it.
   */
  domain?: [number | "auto", number | "auto"];
  /** Exact tick values: numbers, or ISO date strings on a time `x`. */
  ticks?: Array<number | string>;
  /**
   * `"linear"` (default), `"log"` or `"sqrt"`. Value axes and a numeric x
   * only; bars are always linear, and `"log"` falls back to linear when the
   * data touches 0.
   */
  scale?: "linear" | "log" | "sqrt";
  /** Axis title — names the unit of every tick. */
  title?: string;
  /** `"outside"` (default, in the margin) or `"inside"` (in the plot). */
  titlePlacement?: "inside" | "outside";
  /**
   * The grid drawn from this axis' ticks: `"lines"` (default), `"ticks"`
   * (short marks at the axis only) or `"off"`. On `y` for vertical charts, on
   * `x` for horizontal bars.
   */
  gridMode?: "lines" | "ticks" | "off";
  /** `x`: `"bottom"` (default) or `"top"`. `y`: `"left"` (default) or `"right"`. */
  position?: "top" | "bottom" | "left" | "right";
}
