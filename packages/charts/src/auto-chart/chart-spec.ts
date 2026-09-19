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
import type { ChartSpecAnnotation } from "../charts/annotations/annotation-types";
import type { CurveAlias } from "../charts/curve-types";
import type { DateFormatPreset } from "../charts/date-format";
import type { SeriesSymbolsSpec } from "../charts/series-markers";
import type { NullsMode } from "../charts/time-series-chart-shell";
import type { TreemapNode } from "../charts/treemap/treemap-layout";
import type { SeriesMarkerShape } from "../charts/series-pattern";
import type { ScatterShapeSpec } from "../charts/custom-shapes";
import type { BarComparison, BarComparisonLabel, BarOverlay } from "../charts/bar-overlays";
import type { BarSort } from "../charts/bar-stacking";
import type { ChartColorBy } from "../charts/chart-context";
import type { DumbbellSortBy } from "../charts/dumbbell-layout";
import type { ChartTooltipVariant } from "../charts/tooltip/chart-tooltip";
import type { ChartPlotHeight } from "../charts/chart-breakpoint"; // Facet — RM-120
import type { DualAxisOptions } from "../charts/y-axis-scales"; // Dual-axis — RM-121
import type { FacetSort } from "../multiples/facet-sort"; // Facet — RM-120
import type { WaterfallDataFormat, WaterfallSort } from "../charts/waterfall-steps"; // RM-122
import type { ContainerLegendConfig } from "../charts/legend/use-container-legend";
// Choropleth — RM-124
import type { FeatureCollection, Geometry } from "geojson";
import type { ChoroplethScaleSpec } from "../charts/choropleth/choropleth-chart";
import type { ChoroplethFeatureProperties } from "../charts/choropleth/choropleth-context";
import type { ChoroplethPlaceLabelsConfig } from "../charts/choropleth/place-labels";
import type { ChoroplethSymbolsConfig } from "../charts/choropleth/symbol-layer";

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
  | "diverging-bar"
  // Dual-axis — RM-121: explicit only, never inferred.
  | "dual-axis"
  // Choropleth — RM-124: explicit only, never inferred.
  | "choropleth";

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
 * - `"change"` — a two-measure category spec reads as a before/after MOVE
 *   (an arrow), not an independent pair of values — DumbbellChart — RM-116.
 */
export type ChartSpecKind = "steps" | "records" | "ranking" | "change";

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
  // Dual-axis — RM-121
  /** `type: "dual-axis"` only: the value axis this series reads against. Default `"left"`. */
  axis?: "left" | "right";
  /**
   * `type: "dual-axis"` only: how this series is drawn. Default `"line"`. At
   * least one series must be a line, and columns sit on the left axis.
   */
  mark?: "line" | "area" | "column";
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

  /**
   * How a `"line"`/`"area"`/`"stream"` chart draws a non-numeric sample
   * (RM-112). Applies to every series — the same container-level default
   * `LineChart`/`AreaChart nulls` read. Default: `"gap"` (a visible break,
   * never a silent zero).
   */
  nulls?: NullsMode;

  /**
   * Curve interpolation for every series of a `"line"`/`"area"`/`"stream"`
   * chart (RM-112) — a named `@visx/curve` alias. Default: `"monotone"` —
   * unlike `"natural"`, it never overshoots past a flat run of equal values.
   */
  curve?: CurveAlias;

  /**
   * Point markers for every series of a `"line"`/`"area"`/`"stream"` chart
   * (RM-112) — same shape and resolution rule as `Line`/`Area`'s own
   * `symbols` prop. Unset (default): no markers. `"choropleth"` (RM-124):
   * proportional symbols at region centroids — see {@link ChoroplethSymbolsConfig}.
   */
  symbols?: SeriesSymbolsSpec | ChoroplethSymbolsConfig;

  /** Bar/funnel orientation. Default: "vertical" for bars. */
  orientation?: "vertical" | "horizontal";

  /** Render a donut hole in pie charts. Default: false */
  donut?: boolean;

  /**
   * `true`/`false` force-show/-hide the legend, unchanged. The config form
   * (`{ position, layout, interactive, values, title }`, RM-118 —
   * `ContainerLegendConfig` in `useContainerLegend`) picks placement, row/
   * stack layout and hover-dim vs. click-to-toggle on every container this
   * spec type maps to that wires `useContainerLegend` directly.
   *
   * `AutoChart` itself does not consume the config form yet (its own legend
   * still renders through the type-`"pie"`-vs-series branch ABOVE where
   * `useContainerLegend` — a hook — could safely be called without moving
   * `AutoChart`'s type resolution earlier than its loading/empty-data early
   * returns): an object here is currently read as "truthy → show", same as
   * `true`. Default: shown when `series.length > 1`, hidden for one series.
   */
  legend?: boolean | ContainerLegendConfig;

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
  axes?: { x?: AxisSpec; y?: AxisSpec; y2?: AxisSpec & DualAxisOptions };

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

  // Scatter depth — RM-115. Honoured by `"scatter"` only; ignored elsewhere.

  /** Bubble size by a numeric column — `Scatter sizeKey`/`sizeRange`. */
  size?: { key: string; range?: [number, number] };

  /** Shape points by a categorical column — `Scatter shapeBy`. */
  shapeBy?: { key: string; shapes?: SeriesMarkerShape[] };

  /** A least-squares trend line across every series — `Scatter trend`. */
  trend?: "linear" | "log";

  /** Custom lines/areas drawn in data space behind the marks — `CustomShapes shapes`. */
  shapes?: ScatterShapeSpec[];

  // DumbbellChart — RM-116
  /** `type: "dumbbell"` only: `"dumbbell"` (default) | `"slope"` | `"arrow"` | `"dots"`, mirroring `DumbbellVariant`. */
  variant?: "dumbbell" | "slope" | "arrow" | "dots";
  /** `type: "dumbbell"` only: the delta label — absolute value or `%` change. Unset draws no delta label. */
  delta?: { show: boolean; mode: "absolute" | "percent" };

  // Pie/donut grouping, half preset — RM-114. Slice labels moved to
  // `labels.slices` (see `ChartLabelsSpec` below) so `ChartSpec` keeps one
  // `labels` object with a sub-key per mark family. Slice order shares the
  // one `sort` field below (see its docblock) rather than a `pieSort`.
  /** Fold small `type: "pie"` slices into an "Other" slice. See {@link ChartSpecPieGroupSmall}. Ignored elsewhere. */
  groupSmall?: ChartSpecPieGroupSmall;
  /**
   * Render `type: "pie"` as a half-donut: a 180° arc (top half) with the
   * centre value slot under the arc instead of in the middle. Default:
   * false. Ignored elsewhere.
   */
  half?: boolean;

  // Labels — RM-110
  /** Series end labels / key fallback, automatic value labels and scatter point labels (RM-110) — see {@link ChartLabelsSpec}. */
  labels?: ChartLabelsSpec;
  // Annotations — RM-111
  /** Text notes, ranges, reference lines and row notes in data units (RM-111) — see {@link ChartSpecAnnotation}. */
  annotations?: ChartSpecAnnotation[];

  // BarChart — RM-113
  /** `stacked: "diverging"`: the series centred on the zero line (a Likert "Neutral"). */
  divergingCenter?: string;
  /**
   * One row/slice order field, narrowed per chart family in `auto-chart.tsx`
   * (orchestrator ruling — one `sort` on `ChartSpec`, never a `pieSort`/
   * `barSort` per family). Bar (RM-113): `"asc"`/`"desc"` by value (stack
   * total when stacked) or `{ by, dir }` — see {@link BarSort}. Dumbbell
   * (`type: "dumbbell"`, RM-116): its own `DumbbellSortBy` (`"start"|"end"|
   * "delta"|"deltaPercent"|"data"|"label"|"none"`, default `"none"` —
   * spreadsheet order). Pie/donut (RM-114): only the string literals
   * `"desc"` (largest first) or `"none"` (data order, the default — matches
   * `PieChart`'s own default, kept so an existing spec renders
   * byte-identical wedges) are honoured; any other value (an object form,
   * `"asc"`, a dumbbell literal) is ignored for pie. Waterfall (`type:
   * "waterfall"`, RM-122): its own `WaterfallSort` (`"data"|"increasesFirst"|
   * "decreasesFirst"`, default `"data"` — spreadsheet order, within each
   * subtotal group). The union covers every family; `auto-chart.tsx` narrows
   * before handing it to a component's own `sort`/`sortBy` prop.
   */
  sort?: BarSort | DumbbellSortBy | WaterfallSort;
  /** Gather rows by this column, with a header per group — `BarChart`
   * (RM-113) and `DumbbellChart` (RM-116) both read this; waterfall
   * (`type: "waterfall"`, RM-122): a subtotal after each group, mapped to
   * `WaterfallChart subtotalBy`. */
  groupBy?: string;
  /**
   * Colour marks by another column (categorical ≤ 6 hues, or a sequential /
   * diverging ramp) — `"bar"`'s per-bar colour (RM-113) AND `"scatter"`'s
   * per-point colour (RM-115) both read this one field; the two families'
   * `ChartColorBy` shape is identical, so there is no need for a second.
   */
  colorBy?: ChartColorBy;
  /** Per-bar value markers and range spans (confidence intervals, targets). */
  overlays?: BarOverlay[];
  /** A muted prior-period column behind each bar; `labels.comparison` picks its grey label. */
  comparison?: BarComparison;
  // Frame chrome — RM-117
  /** Italic notes under the chart when the AutoChart sits in a `ChartFrame` (RM-117). */
  notes?: string;
  /** "Chart: Author" at the start of an enclosing `ChartFrame`'s footer (RM-117). */
  byline?: { kind?: "chart" | "map" | "table"; author: string };
  /** Attribution for an enclosing `ChartFrame`'s footer — text, or a named link (RM-117). */
  source?: string | { name: string; href?: string };
  /** Text alternative for the picture; the chart's description when `description` is unset (RM-117). */
  altText?: string;

  // Tooltip presets — RM-119
  /**
   * `ChartTooltip`'s own preset, forwarded 1:1 to the `<ChartTooltip>`
   * `AutoChart` already renders for every line/area/scatter/bar family — see
   * {@link ChartSpecTooltip}. Unset keeps today's default box.
   */
  tooltip?: ChartSpecTooltip;

  // Facet — RM-120
  /** Small multiples for `line`/`area`/`bar`/`pie`: one panel per `by` column value, or per series with `{ series: true }` — see {@link FacetSpec}. */
  facet?: FacetSpec;

  // WaterfallChart — RM-122
  /** `type: "waterfall"` only: `"differences"` (default, signed deltas) or
   * `"runningTotals"` (every row's value is the running total at that row,
   * converted once). See `WaterfallChart dataFormat`. */
  dataFormat?: WaterfallDataFormat;
  /** `type: "waterfall"` only: drops the zero baseline when a checkpoint
   * sits far above the steps' own swing, drawing totals as points instead of
   * bars. See `WaterfallChart zoomToDifferences`. Default `false`. */
  zoomToDifferences?: boolean;

  // Choropleth — RM-124
  /** Colour scale (`type: "choropleth"` only): `{ key?, type: "continuous" | "stepped", method?, steps?, domain?, palette? }` — see `colorScaleFor`. `key` defaults to the first series key. */
  scale?: ChoroplethScaleSpec;
  /** `type: "choropleth"` only: the map — a GeoJSON FeatureCollection, or a bundled `"world"` (Natural Earth 1:110m) / `"us-states"` fixture. */
  geo?: ChartSpecGeo;
  /** `type: "choropleth"` only: joins a data row to a region — `row` names the row field, `feature` the feature property (`"id"`, `"name"`, …). */
  match?: ChartSpecGeoMatch;
}

// Choropleth — RM-124
/** A choropleth's regions: inline GeoJSON or a bundled fixture name. */
export type ChartSpecGeo =
  | FeatureCollection<Geometry, ChoroplethFeatureProperties>
  | "world"
  | "us-states";

/** How a choropleth row finds its region: `row[row] === feature.properties[feature]`. */
export interface ChartSpecGeoMatch {
  row: string;
  feature: string;
}

/**
 * `ChartSpec.tooltip` (RM-119) — the serialisable subset of `ChartTooltip`'s
 * `variant` / `focus` / `pin` props.
 */
export interface ChartSpecTooltip {
  /** `ChartTooltip variant`. Default: `"rows"`. */
  variant?: ChartTooltipVariant;
  /**
   * `ChartTooltip focus` — registers "focus requested" on the shared
   * series-mode context standalone, so RM-112's per-series dim
   * (`SeriesHoverDim`) fires with no `focusOnHover` needed on the rendered
   * `LineChart`/`AreaChart` container.
   */
  focus?: boolean;
  /** `ChartTooltip pin`. Unset keeps the coarse-pointer-only default. */
  pin?: boolean;
}

// Pie/donut grouping, sort, half preset — RM-114

/** Which facts a pie/donut slice label states, in `label → value → percent` reading order. */
export type ChartSpecPieLabelField = "label" | "value" | "percent";

/**
 * Slice labels for `type: "pie"` (RM-114) — the serialisable subset of
 * `PieChartLabelsConfig` (`../charts/pie-chart.tsx`). Reached via
 * `ChartLabelsSpec.slices` below.
 */
export interface ChartSpecPieLabels {
  /** `"inside"`, `"outside"`, or `"none"`. Default: `"outside"` (`"none"` under 480px). */
  placement?: "inside" | "outside" | "none";
  /** Which facts to show. Required — no default reading. */
  show: ChartSpecPieLabelField[];
  /** Paint the label in the slice's own color instead of the neutral ink. Default: false. */
  matchColor?: boolean;
  /** Hide an inside label whose wedge sweeps under this angle (radians). Default: 0.2. */
  minAngle?: number;
}

/**
 * Fold small `type: "pie"` slices into one "Other" slice (RM-114) — the
 * serialisable subset of `PieGroupSmallOptions` (`../charts/pie-grouping.ts`).
 */
export interface ChartSpecPieGroupSmall {
  /** Fold a slice under this fraction (0–1) of the total. */
  threshold?: number;
  /** Cap the slice count, folding the smallest first. */
  max?: number;
  /** The folded slice's label. Default: "Other". */
  label?: string;
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

  // Pie slices — RM-114
  /** pie/donut: slice labels — see {@link ChartSpecPieLabels}. Ignored elsewhere. */
  slices?: ChartSpecPieLabels;

  // BarChart — RM-113
  /** bar: the grey label on each `comparison` column — `"value"` | `"difference"` | `"none"` (default). */
  comparison?: BarComparisonLabel;

  // Choropleth — RM-124
  /** choropleth: region names — `{ key?, max? (≤ 30), priority?, collision? }`, laid out through the label solver and dropped at `narrow`. */
  places?: ChoroplethPlaceLabelsConfig;
}

// Axes — RM-108

/**
 * One axis of a cartesian `ChartSpec` (RM-108) — the serialisable subset of
 * the `XAxis`/`YAxis`/`Grid` props. Honoured by the line, area, bar,
 * scatter, candlestick and composed families; ignored elsewhere.
 *
 * `y2` is the right-hand value axis of a `type: "dual-axis"` spec (RM-121);
 * every other type ignores it. On `y2` only, `align` / `proportional` / `zero`
 * (`DualAxisOptions`, `ComposedChart yAxes`) say how the right axis relates
 * to the left one: shared tick rows, one growth factor, the zero rule.
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

// Facet — RM-120
/**
 * Small multiples (RM-120) — the serialisable subset of `ChartMultiples`,
 * honoured by `line`, `area`, `bar` and `pie` specs (ignored elsewhere). The
 * value-domain pin is the existing `axes.y.domain`.
 *
 * Presets:
 * - **Split bars** — one panel per measure: `{ type: "bar", orientation:
 *   "horizontal", facet: { by: { series: true }, scales: { y: "independent" } } }`.
 * - **Multiple pies** — one pie per group: `{ type: "pie", facet: { by: "region" } }`.
 */
export interface FacetSpec {
  /** A column key (one panel per value), or `{ series: true }` (one panel per series). */
  by: string | { series: true };
  /** Panels per row, per breakpoint. Default `{ base: "auto", narrow: 1 }`. */
  columns?: Responsive<number | "auto">;
  /** `y: "shared"` (default) or `"independent"`; `rangeRounding` aligns independent gridlines. */
  scales?: { y?: "shared" | "independent"; rangeRounding?: boolean };
  /** Panel order: `"start" | "end" | "delta" | "deltaPercent" | "range" | "title" | "data"`. */
  sort?: FacetSort;
  /** A muted series behind every panel: a panel `key` (removed from the grid) or a row `series` key. */
  baseline?: { key: string } | { series: string };
  /** Each panel's plot height (px or `{ aspect }`), per breakpoint. Default 200. */
  panelHeight?: Responsive<ChartPlotHeight>;
}
