/**
 * analytics/types.ts — the declared shapes of ADR 0040 §1 (RM-136).
 *
 * `analytics[]` is the statistical sibling of `annotations[]`: every entry is a
 * TRANSFORM over the chart's rows whose result is drawn by marks that already
 * exist — a computed `line`/`band` becomes a line/range annotation, a `trend`/
 * `window`/`forecast` becomes a derived series, `errorBars` a per-datum whisker.
 * Nothing here draws; `resolve-analytics.ts` (RM-138) and `derived-series.ts`
 * (RM-139) do. The maths lives in `stats.ts` / `regression.ts` / `window.ts` /
 * `forecast.ts` (RM-137) and is framework-free.
 *
 * Ink rule (ADR 0040): computed furniture is `--chart-foreground` (line) or
 * `--chart-foreground-muted` (band, trend); a `window` with `replace: true`
 * inherits its measure's series token because it stands in for the measure.
 */

/** A chart row as the analytics see it. */
export type AnalyticRow = Record<string, unknown>;

/**
 * A value on the value axis: a literal, a named statistic of `of`'s values, a
 * percentile, a distance in standard deviations, or a custom reducer.
 */
export type AnalyticValue =
  | number
  | "mean"
  | "median"
  | "min"
  | "max"
  | "sum"
  | { percentile: number }
  | { stddev: number; around?: "mean" | "median"; sample?: boolean }
  | ((rows: readonly AnalyticRow[], key: string) => number | null);

/**
 * How a computed line/band is labelled. `"value"` → the formatted number;
 * `"computation"` → the localised statistic name + value ("Average 73.8");
 * any other string → as given; `"none"` → unlabelled.
 */
export type AnalyticLabelMode = "none" | "value" | "computation" | (string & {});

/** Which series the statistic is computed from. `"all"` pools every series. */
export type AnalyticOf = string | "all";

/** Shared by every analytic kind. */
interface AnalyticBase {
  /** Series `dataKey` (default: the first series) or `"all"`. */
  of?: AnalyticOf;
  /** Qlik's show-condition: render only when it returns `true`. */
  when?: (rows: readonly AnalyticRow[]) => boolean;
  /** Stable id for tests, tooltips and the accessible description. */
  id?: string;
}

/** A computed reference line at one value of one axis. */
export interface AnalyticLine extends AnalyticBase {
  kind: "line";
  /** The axis the value belongs to. Default `"y"` (the value axis of vertical families). */
  axis?: "x" | "y";
  value: AnalyticValue;
  /** Default `"computation"`. */
  label?: AnalyticLabelMode;
  /** Stroke rhythm. Default `"dashed"` — a statistic, not a gridline. */
  style?: "solid" | "dashed" | "dotted";
  width?: 1 | 2 | 3;
  /** `"clip"` (default): the line is not drawn outside the domain; `"extend"`: the domain grows to include it. */
  ifOverflow?: "clip" | "extend";
}

/** A spread preset for `band`: percentiles, standard deviations or a confidence interval. */
export type AnalyticSpread =
  | { percentiles: [number, number] }
  | { stddev: number; around?: "mean" | "median"; sample?: boolean }
  | { ci: number };

/** A computed band between two values of one axis. */
export type AnalyticBand = AnalyticBase & {
  kind: "band";
  axis?: "x" | "y";
  label?: AnalyticLabelMode;
  pattern?: "solid" | "stripes";
  /** Band opacity, `0`–`1`. Default: the annotation layer's range default. */
  opacity?: number;
  ifOverflow?: "clip" | "extend";
} & (
    | { from: AnalyticValue; to: AnalyticValue; spread?: never }
    | { spread: AnalyticSpread; from?: never; to?: never }
  );

/** Regression model of a `trend`. Polynomial degree is capped at 6 (ADR 0040). */
export type AnalyticTrendModel =
  | "linear"
  | "log"
  | "exp"
  | "pow"
  | { poly: 2 | 3 | 4 | 5 | 6 }
  | { loess: number };

/** A least-squares / loess fit drawn as a derived series. */
export interface AnalyticTrend extends AnalyticBase {
  kind: "trend";
  /** Default `"linear"`. */
  model?: AnalyticTrendModel;
  /** Confidence level for a band around the fit (linear family only), e.g. `0.95`. */
  ci?: number;
  /** `"data"` (default): between the first and last x; `"domain"`: across the whole x domain. */
  extent?: "data" | "domain";
  label?: string;
}

/** Rolling-window reduce of one series (moving average, median, sum…). */
export interface AnalyticWindow extends AnalyticBase {
  kind: "window";
  /** Window size in rows. */
  k: number;
  /** Default `"mean"`. `"ewm"` is an exponentially weighted mean with span `k`. */
  reduce?: "mean" | "median" | "sum" | "min" | "max" | "ewm";
  /** Where the window sits relative to the output row. Default `"end"`. */
  anchor?: "start" | "middle" | "end";
  /** `true`: rows without a full window yield `null` (Observable Plot `strict`). Default `false`. */
  strict?: boolean;
  /** `true`: hides the source series; the derived series takes its token and name. */
  replace?: boolean;
  label?: string;
}

/** Additive Holt-Winters forecast appended after the last row. */
export interface AnalyticForecast extends AnalyticBase {
  kind: "forecast";
  /** Number of future steps. */
  horizon: number;
  /** Season length in rows (omit for no seasonality). */
  season?: number;
  /** Prediction interval level. Default `0.95`. */
  interval?: number;
  label?: string;
}

/** Per-datum error bars (Power BI "error bars"). */
export interface AnalyticErrorBars extends AnalyticBase {
  kind: "errorBars";
  /** A field holding the lower bound, or a symmetric percentage of the value. */
  low: string | { percent: number };
  /** A field holding the upper bound; defaults to the mirror of `low`. */
  high?: string;
  /** On line/area families: draw the range as a band instead of whiskers. */
  band?: boolean;
}

/** Any analytic. */
export type ChartAnalytic =
  | AnalyticLine
  | AnalyticBand
  | AnalyticTrend
  | AnalyticWindow
  | AnalyticForecast
  | AnalyticErrorBars;

/** Every analytic's `kind`. */
export type ChartAnalyticKind = ChartAnalytic["kind"];

/** The prop every analytics-aware container accepts. */
export interface ChartAnalyticsProps {
  /** Statistical overlays computed from `data`. Unset → the chart renders exactly as before. */
  analytics?: readonly ChartAnalytic[];
}
