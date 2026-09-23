/**
 * analytics/analytics-label.ts — how a computed line/band names itself
 * (RM-138) and how a derived series names itself in the legend, the tooltip
 * and the accessible description (RM-139).
 *
 * Framework-free: the caller hands in its locale's `t()` and the chart's own
 * value formatter, so the text a reader sees on the line ("Average 73.8") is
 * the same text the figure description restates, in the same notation as the
 * value axis.
 *
 * Label modes (ADR 0040 §1, the analytics-pane BI suite's four):
 *
 * - `"computation"` (default) — the localised statistic + the value: "Average 73.8";
 * - `"value"` — the formatted value alone: "73.8";
 * - `"none"` — unlabelled (the description still names it);
 * - any other string — the caller's own text, as given.
 */

import { modelKey } from "./regression";
import type {
  AnalyticLabelMode,
  AnalyticSpread,
  AnalyticTrendModel,
  AnalyticValue,
  AnalyticWindow,
} from "./types";

/** The locale's translate function (`useLocale().t`). */
export type AnalyticsTranslate = (key: string, vars?: Record<string, string | number>) => string;

/** A number → text formatter (the chart's value formatter). */
export type AnalyticsFormat = (value: number) => string;

function signed(k: number): string {
  if (k > 0) return `+${k}`;
  if (k < 0) return `−${Math.abs(k)}`;
  return "0";
}

/** The localised name of the statistic an `AnalyticValue` computes ("Average", "Percentile 90"). */
export function computationName(value: AnalyticValue, t: AnalyticsTranslate): string {
  if (typeof value === "number") return t("charts.analytics.constant");
  if (typeof value === "function") return t("charts.analytics.custom");
  if (typeof value === "string") {
    switch (value) {
      case "mean":
        return t("charts.analytics.mean");
      case "median":
        return t("charts.analytics.median");
      case "min":
        return t("charts.analytics.min");
      case "max":
        return t("charts.analytics.max");
      case "sum":
        return t("charts.analytics.sum");
      default:
        return t("charts.analytics.custom");
    }
  }
  if ("percentile" in value) return t("charts.analytics.percentile", { p: value.percentile });
  const center =
    value.around === "median" ? t("charts.analytics.median") : t("charts.analytics.mean");
  return t("charts.analytics.stddev", { center, k: signed(value.stddev) });
}

/** The localised name of a band preset ("Interquartile range", "95 % confidence interval"). */
export function spreadName(spread: AnalyticSpread, t: AnalyticsTranslate): string {
  if ("percentiles" in spread) {
    const [lo, hi] = spread.percentiles;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    if (a === 25 && b === 75) return t("charts.analytics.iqr");
    return t("charts.analytics.percentileRange", { from: a, to: b });
  }
  if ("stddev" in spread) {
    const center =
      spread.around === "median" ? t("charts.analytics.median") : t("charts.analytics.mean");
    return t("charts.analytics.stddevBand", { center, k: Math.abs(spread.stddev) });
  }
  return t("charts.analytics.ci", { level: Math.round(spread.ci * 1000) / 10 });
}

/**
 * The text a computed line or band carries for `mode`. `name` is the
 * computation's localised name, `formatted` the value (or `"lo–hi"` range)
 * through the chart's formatter. `undefined` for `"none"`.
 */
export function analyticLabelText(
  mode: AnalyticLabelMode | undefined,
  name: string,
  formatted: string,
): string | undefined {
  if (mode === "none") return undefined;
  if (mode === "value") return formatted;
  if (mode === undefined || mode === "computation") return `${name} ${formatted}`;
  return mode;
}

/** A band's formatted range, "61.2–84.0" (en dash, no spaces). */
export function formatRange(from: number, to: number, format: AnalyticsFormat): string {
  return `${format(from)}–${format(to)}`;
}

/** The localised name of a trend model ("Trend", "Polynomial trend", "Smoothed trend"). */
export function trendModelName(model: AnalyticTrendModel, t: AnalyticsTranslate): string {
  const key = modelKey(model);
  if (key === "linear") return t("charts.analytics.trend");
  if (key === "log") return t("charts.analytics.trendLog");
  if (key === "exp") return t("charts.analytics.trendExp");
  if (key === "pow") return t("charts.analytics.trendPow");
  if (key.startsWith("poly")) {
    return t("charts.analytics.trendPoly", { degree: (model as { poly: number }).poly });
  }
  return t("charts.analytics.trendLoess");
}

/** "r² 0.82" — the fit quality a legend entry and a description quote. */
export function formatRSquared(r2: number, t: AnalyticsTranslate): string {
  return t("charts.analytics.rSquared", { value: r2.toFixed(2) });
}

/** The localised name of a rolling window ("7-point moving average"). */
export function windowName(
  analytic: Pick<AnalyticWindow, "k" | "reduce" | "label">,
  t: AnalyticsTranslate,
): string {
  if (analytic.label) return analytic.label;
  const k = Math.round(analytic.k);
  switch (analytic.reduce ?? "mean") {
    case "median":
      return t("charts.analytics.windowMedian", { k });
    case "sum":
      return t("charts.analytics.windowSum", { k });
    case "min":
      return t("charts.analytics.windowMin", { k });
    case "max":
      return t("charts.analytics.windowMax", { k });
    case "ewm":
      return t("charts.analytics.windowEwm", { k });
    default:
      return t("charts.analytics.windowMean", { k });
  }
}

/** Joins sentences with one space, ensuring each ends with terminal punctuation. */
export function joinSentences(parts: readonly (string | undefined)[]): string | undefined {
  const out = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map((part) => (/[.!?…]$/.test(part) ? part : `${part}.`));
  return out.length ? out.join(" ") : undefined;
}
