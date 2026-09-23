/**
 * analytics/derived-series.ts — `trend` / `window` / `forecast` / `errorBars`
 * → a derived series (RM-139, ADR 0040 §1).
 *
 * A derived series is rows + a `LineConfig`, drawn on the family's own scales
 * by `AnalyticSeriesLayer`. It is computed ONCE, outside the plot, so the
 * legend entry ("Trend (r² 0.82)"), the tooltip row ("Trend 74.1"), the
 * accessible sentence ("A linear trend rises, r² 0.82") and the painted path
 * all read the same numbers.
 *
 * - `trend` — sampled at every x of the data (category index, number or time)
 *   plus, with `extent: "domain"`, the ends of the x domain; the model is
 *   RM-137's `fitModel`, fitted in RAW x units (epoch ms for time). `ci` adds a
 *   band (linear family only).
 * - `window` — `windowReduce` aligned to the rows. `replace: true` stands in
 *   for its measure: it takes the series token and a "Sales · 7-point moving
 *   average" name, and the container hides the source series.
 * - `forecast` — `forecastHoltWinters` appended after the last finite row:
 *   `horizon` future x values (time: calendar months when the data is
 *   monthly, else the median interval; numbers: the median step), the
 *   prediction interval as a band, drawn dashed from the last actual point.
 * - `errorBars` — per-datum `[low, high]` from two fields, one mirrored
 *   field, or `{ percent }` of the value; whiskers, or a band (`band: true`).
 *
 * Ink (ADR 0040): `--chart-foreground-muted` for everything except a
 * `replace` window, which inherits its measure's series token. Trend and
 * forecast paths are dashed — a model is never mistaken for a measurement.
 *
 * Framework-free: no React, no DOM, no chart context.
 */

import type { LineConfig } from "../chart-context";
import {
  type AnalyticsFormat,
  type AnalyticsTranslate,
  formatRSquared,
  trendModelName,
  windowName,
} from "./analytics-label";
import { type HoltWintersForecast, forecastHoltWinters } from "./forecast";
import { type ModelFit, fitModel, trendDirection } from "./regression";
import { analyticId, POOLED_KEY } from "./resolve-analytics";
import type { AnalyticExtent } from "./resolve-analytics";
import { isFiniteNumber } from "./stats";
import type {
  AnalyticErrorBars,
  AnalyticForecast,
  AnalyticRow,
  AnalyticTrend,
  AnalyticWindow,
  ChartAnalytic,
} from "./types";
import { windowReduce } from "./window";

/** The muted analytic ink (ADR 0040). */
export const ANALYTIC_MUTED_INK = "var(--chart-foreground-muted)";
/** The strong analytic ink — whiskers. */
export const ANALYTIC_INK = "var(--chart-foreground)";
/** The dash of a model path (trend, forecast). */
export const ANALYTIC_DASH = "6 4";

/**
 * Dash rhythms for several model paths on one chart, in order: every model is
 * the same muted ink, so the RHYTHM (never a hue) tells two trends apart —
 * the legend marker and the tooltip swatch repeat it.
 */
export const ANALYTIC_DASHES = ["6 4", "2 3", "10 3 2 3", "1 4"] as const;

/** Rhythms for several solid overlays beside a measure (moving averages): solid, dotted, dash-dot. */
export const ANALYTIC_SOLID_RHYTHMS = [undefined, "1 3", "6 2 1 2"] as const;

/** What a container knows that the derivation needs. */
export interface DerivedSeriesContext {
  /** The x field. */
  xDataKey: string;
  /** The chart's series keys in drawing order — `of` defaults to the first. */
  seriesKeys: readonly string[];
  /** Display names by series key (a `Line`'s `name`); falls back to the key. */
  seriesNames?: Readonly<Record<string, string>>;
  /** Series ink by key — a `replace` window takes its measure's. */
  seriesColors?: Readonly<Record<string, string>>;
  /** `yAxisId` by series key, so a derived series lands on its measure's axis. */
  seriesAxes?: Readonly<Record<string, string | number | undefined>>;
  /** The chart's value formatter. */
  format: AnalyticsFormat;
  t: AnalyticsTranslate;
}

/** One sample of a derived series. */
export interface DerivedPoint {
  /** The x value in the DATA's own terms (Date, number or category). */
  x: unknown;
  /** `x` as a number: epoch ms, the number itself, or the category index. */
  xNum: number;
  y: number | null;
  lower?: number | null;
  upper?: number | null;
  /** `true` for a forecast step after the last row. */
  horizon?: boolean;
}

/** A computed derived series. */
export interface DerivedSeries {
  id: string;
  /** Index in the caller's `analytics` array. */
  index: number;
  kind: "trend" | "window" | "forecast" | "errorBars";
  /** Legend / toggle key: `analytic:<id>`. */
  key: string;
  /** Source series (`POOLED_KEY` for a pooled trend). */
  of: string;
  /** Tooltip / path name ("Trend", "7-point moving average"). */
  name: string;
  /** Legend text — the name plus the model's quality ("Trend (r² 0.82)"). */
  label: string;
  /** The samples, sorted by `xNum`. */
  points: DerivedPoint[];
  /** The same samples as chart rows: `{ [xDataKey], [valueKey], [lowKey]?, [highKey]? }`. */
  rows: AnalyticRow[];
  config: LineConfig;
  /** Present when the series carries an interval (`ci`, forecast, error band). */
  band?: { lowKey: string; highKey: string };
  /** Error bars drawn as whiskers rather than a path/band. */
  whiskers?: boolean;
  color: string;
  dashed: boolean;
  /**
   * The path's `strokeDasharray` (a model's dash, or the rhythm that tells a
   * second overlay from the first); `undefined` = solid. Set by `deriveAllSeries`.
   */
  dash?: string;
  /** Decimal places of the source values — a tooltip shows one more, never float noise. */
  precision: number;
  /** A `window` with `replace: true` — the container hides `of`. */
  replace: boolean;
  fit?: ModelFit;
  forecast?: HoltWintersForecast;
  /** The accessible sentence. */
  description: string;
  /** Values by `xLookupKey(x)` for the tooltip row. */
  byX: ReadonlyMap<string, DerivedPoint>;
  /** Forecast horizon x values the x domain must include. */
  horizonX?: unknown[];
}

type XKind = "time" | "number" | "category";

/** A stable lookup key for an x value (the tooltip's hovered row → a derived sample). */
export function xLookupKey(x: unknown): string {
  if (x instanceof Date) return `t:${x.getTime()}`;
  return `v:${String(x)}`;
}

/** An ISO-looking date string (`2024-01`, `2024-01-15`, `2024-01-15T09:00`). */
const ISO_LIKE = /^\d{4}-\d{2}/;

function detectXKind(rows: readonly AnalyticRow[], xKey: string): XKind {
  let kind: XKind | null = null;
  for (const row of rows) {
    const v = row[xKey];
    if (v === null || v === undefined) continue;
    const k: XKind =
      v instanceof Date || (typeof v === "string" && ISO_LIKE.test(v))
        ? "time"
        : typeof v === "number"
          ? "number"
          : "category";
    if (kind === null) kind = k;
    else if (kind !== k) return "category";
  }
  return kind ?? "category";
}

function xNumOf(x: unknown, kind: XKind, index: number): number | null {
  if (kind === "time") {
    const t = x instanceof Date ? x.getTime() : typeof x === "string" ? Date.parse(x) : NaN;
    return Number.isFinite(t) ? t : null;
  }
  if (kind === "number") return isFiniteNumber(x) ? x : null;
  return index;
}

/** Decimal places the source values carry (capped at 4). */
function precisionOf(rows: readonly AnalyticRow[], keys: readonly string[]): number {
  let digits = 0;
  let seen = 0;
  for (const row of rows) {
    for (const key of keys) {
      const v = row[key];
      if (!isFiniteNumber(v)) continue;
      const text = String(v);
      const dot = text.indexOf(".");
      if (dot >= 0 && !text.includes("e")) digits = Math.max(digits, text.length - dot - 1);
      seen += 1;
    }
    if (seen > 400 || digits >= 4) break;
  }
  return Math.min(digits, 4);
}

function seriesName(ctx: DerivedSeriesContext, key: string): string {
  return ctx.seriesNames?.[key] ?? key;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function toRows(
  points: readonly DerivedPoint[],
  xKey: string,
  valueKey: string,
  band?: { lowKey: string; highKey: string },
): AnalyticRow[] {
  return points.map((p) => {
    const row: AnalyticRow = { [xKey]: p.x, [valueKey]: p.y };
    if (band) {
      row[band.lowKey] = p.lower ?? null;
      row[band.highKey] = p.upper ?? null;
    }
    return row;
  });
}

function lookup(points: readonly DerivedPoint[]): Map<string, DerivedPoint> {
  const map = new Map<string, DerivedPoint>();
  for (const p of points) map.set(xLookupKey(p.x), p);
  return map;
}

function directionText(dir: "increasing" | "decreasing" | "flat", t: AnalyticsTranslate): string {
  return dir === "increasing"
    ? t("charts.analytics.rises")
    : dir === "decreasing"
      ? t("charts.analytics.falls")
      : t("charts.analytics.flat");
}

interface Base {
  id: string;
  index: number;
  key: string;
  valueKey: string;
}

function base(analytic: ChartAnalytic, index: number): Base {
  const id = analyticId(analytic, index);
  return { id, index, key: `analytic:${id}`, valueKey: `__analytic_${id}` };
}

// ── trend ────────────────────────────────────────────────────────────────────

function deriveTrend(
  rows: readonly AnalyticRow[],
  analytic: AnalyticTrend,
  index: number,
  ctx: DerivedSeriesContext,
  kind: XKind,
  xDomain?: [number, number],
): DerivedSeries | null {
  const b = base(analytic, index);
  const pooled = analytic.of === "all";
  const single = analytic.of ?? ctx.seriesKeys[0];
  const keys: readonly string[] = pooled ? ctx.seriesKeys : single ? [single] : [];
  const of = pooled ? POOLED_KEY : single;
  if (!of) return null;

  const fitPoints: { x: number; y: number }[] = [];
  const xs = new Map<number, unknown>();
  rows.forEach((row, i) => {
    const xNum = xNumOf(row[ctx.xDataKey], kind, i);
    if (xNum === null) return;
    for (const key of keys) {
      const y = row[key];
      if (!isFiniteNumber(y)) continue;
      fitPoints.push({ x: xNum, y });
      xs.set(xNum, row[ctx.xDataKey]);
    }
  });
  const model = analytic.model ?? "linear";
  const fit = fitModel(fitPoints, model, analytic.ci ? { ci: analytic.ci } : {});
  if (!fit) return null;

  if (analytic.extent === "domain" && xDomain && kind !== "category") {
    for (const edge of xDomain) {
      if (!xs.has(edge)) xs.set(edge, kind === "time" ? new Date(edge) : edge);
    }
  }
  const band = fit.band ? { lowKey: `${b.valueKey}_lo`, highKey: `${b.valueKey}_hi` } : undefined;
  const points: DerivedPoint[] = [...xs.entries()]
    .sort((a, c) => a[0] - c[0])
    .map(([xNum, x]) => {
      const y = fit.predict(xNum);
      const interval = fit.band?.(xNum);
      return {
        x,
        xNum,
        y: Number.isFinite(y) ? y : null,
        ...(interval ? { lower: interval.lower, upper: interval.upper } : {}),
      };
    });

  const modelName = analytic.label ?? trendModelName(model, ctx.t);
  const name =
    !pooled && ctx.seriesKeys.length > 1 ? `${modelName} · ${seriesName(ctx, of)}` : modelName;
  const quality = fit.rSquared !== undefined ? formatRSquared(fit.rSquared, ctx.t) : undefined;
  const label = quality ? `${name} (${quality})` : name;
  const direction = directionText(trendDirection(fit), ctx.t);
  const description = quality
    ? ctx.t("charts.analytics.describeTrend", { name, direction, fit: quality })
    : ctx.t("charts.analytics.describeTrendNoFit", { name, direction });

  return {
    ...b,
    kind: "trend",
    of,
    name,
    label,
    points,
    rows: toRows(points, ctx.xDataKey, b.valueKey, band),
    config: {
      dataKey: b.valueKey,
      stroke: ANALYTIC_MUTED_INK,
      strokeWidth: 1.5,
      yAxisId: pooled ? undefined : ctx.seriesAxes?.[of],
    },
    band,
    color: ANALYTIC_MUTED_INK,
    dashed: true,
    precision: precisionOf(rows, keys),
    replace: false,
    fit,
    description,
    byX: lookup(points),
  };
}

// ── window ───────────────────────────────────────────────────────────────────

function deriveWindow(
  rows: readonly AnalyticRow[],
  analytic: AnalyticWindow,
  index: number,
  ctx: DerivedSeriesContext,
  kind: XKind,
): DerivedSeries | null {
  const b = base(analytic, index);
  const of = analytic.of && analytic.of !== "all" ? analytic.of : ctx.seriesKeys[0];
  if (!of) return null;
  const values = rows.map((row) => {
    const v = row[of];
    return isFiniteNumber(v) ? v : null;
  });
  const reduced = windowReduce(values, {
    k: analytic.k,
    reduce: analytic.reduce ?? "mean",
    anchor: analytic.anchor,
    strict: analytic.strict,
  });
  const points: DerivedPoint[] = [];
  rows.forEach((row, i) => {
    const x = row[ctx.xDataKey];
    const xNum = xNumOf(x, kind, i);
    if (xNum === null) return;
    points.push({ x, xNum, y: reduced[i] ?? null });
  });
  const windowText = windowName(analytic, ctx.t);
  const replace = analytic.replace === true;
  const source = seriesName(ctx, of);
  const name = replace ? `${source} · ${windowText}` : windowText;
  const color = replace ? (ctx.seriesColors?.[of] ?? ANALYTIC_MUTED_INK) : ANALYTIC_MUTED_INK;
  return {
    ...b,
    kind: "window",
    of,
    name,
    label: replace || ctx.seriesKeys.length <= 1 ? name : `${windowText} · ${source}`,
    points,
    rows: toRows(points, ctx.xDataKey, b.valueKey),
    config: {
      dataKey: b.valueKey,
      stroke: color,
      strokeWidth: replace ? 2.5 : 1.5,
      yAxisId: ctx.seriesAxes?.[of],
    },
    color,
    dashed: false,
    precision: precisionOf(rows, [of]),
    replace,
    description: ctx.t("charts.analytics.describeWindow", { name: windowText, series: source }),
    byX: lookup(points),
  };
}

// ── forecast ─────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

/** `horizon` x values after `xs` (sorted), continuing the data's own rhythm. */
export function horizonXValues(xs: readonly unknown[], kind: XKind, horizon: number): unknown[] {
  const out: unknown[] = [];
  if (kind === "category") {
    for (let h = 1; h <= horizon; h += 1) out.push(`+${h}`);
    return out;
  }
  const nums = xs.map((x) =>
    x instanceof Date ? x.getTime() : typeof x === "string" ? Date.parse(x) : (x as number),
  );
  const last = nums.at(-1);
  if (last === undefined) return out;
  const diffs: number[] = [];
  for (let i = 1; i < nums.length; i += 1)
    diffs.push((nums[i] as number) - (nums[i - 1] as number));
  const step = diffs.length ? median(diffs) : 1;
  if (kind === "time") {
    const dates = nums.map((n) => new Date(n));
    const lastDate = dates.at(-1) as Date;
    // Monthly (or quarterly/yearly) data keeps its day-of-month: step whole months.
    const sameDay = dates.every((d) => d.getDate() === lastDate.getDate());
    if (sameDay && step >= 27 * DAY) {
      const months = Math.max(1, Math.round(step / (30.4375 * DAY)));
      for (let h = 1; h <= horizon; h += 1) {
        const d = new Date(lastDate);
        d.setMonth(d.getMonth() + h * months);
        out.push(d);
      }
      return out;
    }
    for (let h = 1; h <= horizon; h += 1) out.push(new Date(last + h * step));
    return out;
  }
  for (let h = 1; h <= horizon; h += 1) out.push(last + h * step);
  return out;
}

function deriveForecast(
  rows: readonly AnalyticRow[],
  analytic: AnalyticForecast,
  index: number,
  ctx: DerivedSeriesContext,
  kind: XKind,
): DerivedSeries | null {
  const b = base(analytic, index);
  const of = analytic.of && analytic.of !== "all" ? analytic.of : ctx.seriesKeys[0];
  if (!of) return null;
  const xs: unknown[] = [];
  const values: number[] = [];
  rows.forEach((row) => {
    const v = row[of];
    if (!isFiniteNumber(v)) return;
    xs.push(row[ctx.xDataKey]);
    values.push(v);
  });
  const level = analytic.interval ?? 0.95;
  const fc = forecastHoltWinters(values, {
    horizon: analytic.horizon,
    season: analytic.season,
    interval: level,
  });
  if (!fc || xs.length === 0) return null;
  const horizonX = horizonXValues(xs, kind, fc.points.length);
  const lastX = xs.at(-1);
  const lastY = values.at(-1) as number;
  const lastNum = xNumOf(lastX, kind, rows.length - 1) ?? 0;
  const points: DerivedPoint[] = [
    { x: lastX, xNum: lastNum, y: lastY, lower: lastY, upper: lastY },
  ];
  horizonX.forEach((x, h) => {
    const xNum = kind === "category" ? rows.length + h : (xNumOf(x, kind, 0) ?? NaN);
    points.push({
      x,
      xNum,
      y: fc.points[h] ?? null,
      lower: fc.lower[h] ?? null,
      upper: fc.upper[h] ?? null,
      horizon: true,
    });
  });
  const band = { lowKey: `${b.valueKey}_lo`, highKey: `${b.valueKey}_hi` };
  const name = analytic.label ?? ctx.t("charts.analytics.forecast");
  const levelText = `${Math.round(level * 1000) / 10} %`;
  const end = points.at(-1) as DerivedPoint;
  const source = seriesName(ctx, of);
  return {
    ...b,
    kind: "forecast",
    of,
    name,
    label: ctx.t("charts.analytics.forecastLegend", { name, level: levelText }),
    points,
    rows: toRows(points, ctx.xDataKey, b.valueKey, band),
    config: {
      dataKey: b.valueKey,
      stroke: ANALYTIC_MUTED_INK,
      strokeWidth: 1.5,
      yAxisId: ctx.seriesAxes?.[of],
    },
    band,
    color: ANALYTIC_MUTED_INK,
    dashed: true,
    precision: precisionOf(rows, [of]),
    replace: false,
    forecast: fc,
    description: ctx.t("charts.analytics.describeForecast", {
      horizon: fc.points.length,
      series: source,
      level: levelText,
      value: ctx.format(end.y ?? 0),
      low: ctx.format(end.lower ?? 0),
      high: ctx.format(end.upper ?? 0),
    }),
    byX: lookup(points.slice(1)),
    horizonX,
  };
}

// ── error bars ───────────────────────────────────────────────────────────────

/** `[low, high]` of one row's error bar, or `null`. */
export function errorBarRange(
  row: AnalyticRow,
  key: string,
  analytic: Pick<AnalyticErrorBars, "low" | "high">,
): [number, number] | null {
  const v = row[key];
  if (!isFiniteNumber(v)) return null;
  if (typeof analytic.low === "object") {
    const d = Math.abs(v) * (analytic.low.percent / 100);
    if (!Number.isFinite(d)) return null;
    return [v - d, v + d];
  }
  const low = row[analytic.low];
  const highRaw = analytic.high !== undefined ? row[analytic.high] : undefined;
  if (!isFiniteNumber(low)) return null;
  const high = isFiniteNumber(highRaw)
    ? highRaw
    : analytic.high === undefined
      ? v + (v - low)
      : null;
  if (high === null) return null;
  return [Math.min(low, high), Math.max(low, high)];
}

function deriveErrorBars(
  rows: readonly AnalyticRow[],
  analytic: AnalyticErrorBars,
  index: number,
  ctx: DerivedSeriesContext,
  kind: XKind,
): DerivedSeries | null {
  const b = base(analytic, index);
  const of = analytic.of && analytic.of !== "all" ? analytic.of : ctx.seriesKeys[0];
  if (!of) return null;
  const points: DerivedPoint[] = [];
  rows.forEach((row, i) => {
    const x = row[ctx.xDataKey];
    const xNum = xNumOf(x, kind, i);
    if (xNum === null) return;
    const range = errorBarRange(row, of, analytic);
    const y = row[of];
    points.push({
      x,
      xNum,
      y: isFiniteNumber(y) ? y : null,
      lower: range?.[0] ?? null,
      upper: range?.[1] ?? null,
    });
  });
  const band = { lowKey: `${b.valueKey}_lo`, highKey: `${b.valueKey}_hi` };
  const source = seriesName(ctx, of);
  const name = ctx.t("charts.analytics.errorBars");
  return {
    ...b,
    kind: "errorBars",
    of,
    name,
    label: ctx.seriesKeys.length > 1 ? `${name} · ${source}` : name,
    points,
    rows: toRows(points, ctx.xDataKey, b.valueKey, band),
    config: {
      dataKey: b.valueKey,
      stroke: analytic.band ? ANALYTIC_MUTED_INK : ANALYTIC_INK,
      strokeWidth: 1.25,
      yAxisId: ctx.seriesAxes?.[of],
    },
    band,
    whiskers: !analytic.band,
    color: analytic.band ? ANALYTIC_MUTED_INK : ANALYTIC_INK,
    dashed: false,
    precision: precisionOf(rows, [of]),
    replace: false,
    description: ctx.t("charts.analytics.describeErrorBars", { series: source }),
    byX: lookup(points),
  };
}

// ── public ───────────────────────────────────────────────────────────────────

/**
 * The derived series of one analytic, or `null` when it is a line/band, its
 * `when` is `false`, or the data cannot support it (too few points, a
 * non-finite forecast input…). `xDomain` (numeric) feeds `extent: "domain"`.
 */
export function derivedSeries(
  rows: readonly AnalyticRow[],
  analytic: ChartAnalytic,
  ctx: DerivedSeriesContext,
  index = 0,
  xDomain?: [number, number],
): DerivedSeries | null {
  if (analytic.kind === "line" || analytic.kind === "band") return null;
  if (analytic.when && !analytic.when(rows)) return null;
  const kind = detectXKind(rows, ctx.xDataKey);
  switch (analytic.kind) {
    case "trend":
      return deriveTrend(rows, analytic, index, ctx, kind, xDomain);
    case "window":
      return deriveWindow(rows, analytic, index, ctx, kind);
    case "forecast":
      return deriveForecast(rows, analytic, index, ctx, kind);
    case "errorBars":
      return deriveErrorBars(rows, analytic, index, ctx, kind);
    default:
      return null;
  }
}

/** Every derived series of `analytics`, in array order. */
export function deriveAllSeries(
  rows: readonly AnalyticRow[],
  analytics: readonly ChartAnalytic[] | undefined,
  ctx: DerivedSeriesContext,
  xDomain?: [number, number],
): DerivedSeries[] {
  if (!analytics?.length) return [];
  const out: DerivedSeries[] = [];
  let dashed = 0;
  let beside = 0;
  analytics.forEach((analytic, index) => {
    const series = derivedSeries(rows, analytic, ctx, index, xDomain);
    if (!series) return;
    if (series.dashed) {
      series.dash = ANALYTIC_DASHES[dashed % ANALYTIC_DASHES.length];
      dashed += 1;
    } else if (series.kind === "window" && !series.replace) {
      series.dash = ANALYTIC_SOLID_RHYTHMS[beside % ANALYTIC_SOLID_RHYTHMS.length];
      beside += 1;
    }
    out.push(series);
  });
  return out;
}

/** The value extent a derived series occupies — the container's value domain includes it. */
export function derivedExtent(series: DerivedSeries, axis: "x" | "y"): AnalyticExtent | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const p of series.points) {
    for (const v of [p.y, p.lower, p.upper]) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (lo > hi) return null;
  return { axis, keys: series.of === POOLED_KEY ? "all" : [series.of], lo, hi };
}

/**
 * One sentence per analytic for the figure description — the computed
 * lines/bands (their label text) and the derived series, in array order.
 */
export function describeAnalytics(
  marks: readonly { index: number; description: string }[],
  derived: readonly { index: number; description: string }[],
): string | undefined {
  const all = [...marks, ...derived].sort((a, b) => a.index - b.index);
  const parts = all
    .map((entry) => entry.description.trim())
    .filter(Boolean)
    .map((text) => (/[.!?…]$/.test(text) ? text : `${text}.`));
  return parts.length ? parts.join(" ") : undefined;
}
