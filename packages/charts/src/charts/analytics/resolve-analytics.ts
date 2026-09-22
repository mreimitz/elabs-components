/**
 * analytics/resolve-analytics.ts — `analytics[{ kind: "line" | "band" }]` →
 * annotation entries (RM-138, ADR 0040 §1).
 *
 * A computed reference line or band is NOT a new mark: it is a `line` /
 * `range` annotation whose position this module computes from the rows
 * (RM-137's `resolveAnalyticValue` / `spreadBand`). The container appends the
 * result to its own `annotations` before the annotation layer runs, so the
 * collision pass, the narrow-tier behaviour and the painter come for free.
 *
 * - `of` names one series (default: the chart's first) or `"all"` — every
 *   series' values pooled into one set.
 * - `axis` is the DRAWN axis (the annotation vocabulary): default the chart's
 *   value axis (`y`, or `x` on a horizontal bar / dumbbell / waterfall). An
 *   `x` analytic on a continuous-x family (scatter) computes over the x column.
 * - `when(rows)` is the associative BI suite's show-condition: `false` → nothing.
 * - `ifOverflow: "extend"` publishes an extent the container widens its value
 *   domain by; `"clip"` (default) leaves the domain alone and the painter
 *   skips a value outside it (the associative BI suite's rule).
 *
 * Framework-free: no React, no DOM, no chart context.
 */

import type { ChartAnnotation } from "../annotations/annotation-types";
import {
  type AnalyticsFormat,
  type AnalyticsTranslate,
  analyticLabelText,
  computationName,
  formatRange,
  spreadName,
} from "./analytics-label";
import { isFiniteNumber, resolveAnalyticValue, spreadBand } from "./stats";
import type { AnalyticBand, AnalyticLine, AnalyticRow, ChartAnalytic } from "./types";

/** The synthetic key of the pooled (`of: "all"`) value set. */
export const POOLED_KEY = "__analytics_all__";

/** What a container knows that the resolver needs. */
export interface ResolveAnalyticsContext {
  /** The chart's series keys in drawing order — `of` defaults to the first. */
  seriesKeys: readonly string[];
  /** The x field (for an `x` analytic on a continuous-x family). */
  xDataKey?: string;
  /** The DRAWN axis that carries the values. Default `"y"`. */
  valueAxis?: "x" | "y";
  /** `true` when the other axis is continuous too (scatter): an `x` analytic computes over `xDataKey`. */
  xContinuous?: boolean;
  /** The chart's value formatter (the value axis' notation). */
  format: AnalyticsFormat;
  /** Formats an x-axis statistic (dates on a time axis). Default: `format`. */
  formatX?: (value: number | Date) => string;
  /** The locale's translate function. */
  t: AnalyticsTranslate;
}

/** A value-domain extent an `ifOverflow: "extend"` analytic (or a derived series) asks for. */
export interface AnalyticExtent {
  /** The drawn axis. */
  axis: "x" | "y";
  /** The series whose axis grows (`"all"`: every value axis). */
  keys: readonly string[] | "all";
  lo: number;
  hi: number;
}

/** One resolved `line` / `band`, for tests, the description and the tooltip. */
export interface ResolvedAnalyticMark {
  id: string;
  /** Index in the caller's `analytics` array. */
  index: number;
  kind: "line" | "band";
  axis: "x" | "y";
  /** The value field the statistic was computed from (or `POOLED_KEY`). */
  of: string;
  /** Line value (x statistic on a time axis: epoch ms). */
  value?: number;
  from?: number;
  to?: number;
  /** The painted label (`undefined` for `label: "none"`). */
  label?: string;
  /** What the figure description says about it — always set. */
  description: string;
  ifOverflow: "clip" | "extend";
}

export interface ResolvedAnalytics {
  /** Annotation entries, in `analytics` order, to append to the container's own. */
  annotations: ChartAnnotation[];
  marks: ResolvedAnalyticMark[];
  extents: AnalyticExtent[];
}

const EMPTY: ResolvedAnalytics = { annotations: [], marks: [], extents: [] };

/** A stable id for the analytic at `index`. */
export function analyticId(analytic: ChartAnalytic, index: number): string {
  return analytic.id ?? `${analytic.kind}-${index}`;
}

/** Every series' values of `keys`, pooled into one-field rows. */
export function pooledRows(
  rows: readonly AnalyticRow[],
  keys: readonly string[],
): { rows: AnalyticRow[]; key: string } {
  const out: AnalyticRow[] = [];
  for (const key of keys) {
    for (const row of rows) out.push({ [POOLED_KEY]: row[key] });
  }
  return { rows: out, key: POOLED_KEY };
}

function toNumber(value: unknown): number | undefined {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : undefined;
  }
  return isFiniteNumber(value) ? value : undefined;
}

/** The rows and key a statistic reads for this analytic (`null` when there is nothing to read). */
function statSource(
  rows: readonly AnalyticRow[],
  analytic: AnalyticLine | AnalyticBand,
  ctx: ResolveAnalyticsContext,
  axis: "x" | "y",
): {
  rows: readonly AnalyticRow[];
  key: string;
  keys: readonly string[] | "all";
  isX: boolean;
} | null {
  const valueAxis = ctx.valueAxis ?? "y";
  if (axis !== valueAxis) {
    // The other drawn axis: only a continuous one (scatter) has values to reduce.
    if (!ctx.xContinuous || !ctx.xDataKey) return null;
    const xKey = ctx.xDataKey;
    const numeric = rows.map((row) => ({ [xKey]: toNumber(row[xKey]) }));
    return { rows: numeric, key: xKey, keys: [xKey], isX: true };
  }
  if (analytic.of === "all") {
    const pooled = pooledRows(rows, ctx.seriesKeys);
    return { ...pooled, keys: "all", isX: false };
  }
  const key = analytic.of ?? ctx.seriesKeys[0];
  if (!key) return null;
  return { rows, key, keys: [key], isX: false };
}

/** Whether the x column holds dates (an x statistic then reads back as a `Date`). */
function xIsTime(rows: readonly AnalyticRow[], xKey: string | undefined): boolean {
  if (!xKey) return false;
  for (const row of rows) {
    const v = row[xKey];
    if (v === null || v === undefined) continue;
    return v instanceof Date;
  }
  return false;
}

/**
 * Resolves the `line` / `band` entries of `analytics` against `rows`. Other
 * kinds (`trend`, `window`, `forecast`, `errorBars`) are derived series and
 * are skipped here (see `derived-series.ts`).
 */
export function resolveAnalytics(
  rows: readonly AnalyticRow[],
  analytics: readonly ChartAnalytic[] | undefined,
  ctx: ResolveAnalyticsContext,
): ResolvedAnalytics {
  if (!analytics?.length) return EMPTY;
  const annotations: ChartAnnotation[] = [];
  const marks: ResolvedAnalyticMark[] = [];
  const extents: AnalyticExtent[] = [];
  const timeX = xIsTime(rows, ctx.xDataKey);

  analytics.forEach((analytic, index) => {
    if (analytic.kind !== "line" && analytic.kind !== "band") return;
    if (analytic.when && !analytic.when(rows)) return;
    const axis = analytic.axis ?? ctx.valueAxis ?? "y";
    const source = statSource(rows, analytic, ctx, axis);
    if (!source) return;
    const id = analyticId(analytic, index);
    const ifOverflow = analytic.ifOverflow ?? "clip";
    const format = (v: number): string => {
      if (!source.isX) return ctx.format(v);
      if (ctx.formatX) return ctx.formatX(timeX ? new Date(v) : v);
      return timeX ? new Date(v).toISOString().slice(0, 10) : ctx.format(v);
    };
    const position = (v: number): number | Date => (source.isX && timeX ? new Date(v) : v);

    if (analytic.kind === "line") {
      const value = resolveAnalyticValue(source.rows, source.key, analytic.value);
      if (value === null) return;
      const name = computationName(analytic.value, ctx.t);
      const formatted = format(value);
      const label = analyticLabelText(analytic.label, name, formatted);
      const description = analyticLabelText(
        analytic.label === "none" || analytic.label === "value" ? "computation" : analytic.label,
        name,
        formatted,
      ) as string;
      annotations.push({
        kind: "line",
        ...(axis === "x" ? { x: position(value) } : { y: position(value) }),
        label,
        style: analytic.style ?? "dashed",
        width: analytic.width,
        ink: "foreground",
        analytic: { id, value },
      } as ChartAnnotation);
      marks.push({
        id,
        index,
        kind: "line",
        axis,
        of: source.key,
        value,
        label,
        description,
        ifOverflow,
      });
      if (ifOverflow === "extend" && !source.isX) {
        extents.push({ axis, keys: source.keys, lo: value, hi: value });
      }
      return;
    }

    // band
    let from: number | null;
    let to: number | null;
    let name: string;
    if (analytic.spread) {
      const band = spreadBand(source.rows, source.key, analytic.spread);
      from = band?.from ?? null;
      to = band?.to ?? null;
      name = spreadName(analytic.spread, ctx.t);
    } else {
      from = resolveAnalyticValue(source.rows, source.key, analytic.from as never);
      to = resolveAnalyticValue(source.rows, source.key, analytic.to as never);
      name = `${computationName(analytic.from as never, ctx.t)} – ${computationName(
        analytic.to as never,
        ctx.t,
      )}`;
    }
    if (from === null || to === null) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const formatted = source.isX ? `${format(lo)}–${format(hi)}` : formatRange(lo, hi, ctx.format);
    const label = analyticLabelText(analytic.label, name, formatted);
    const description = analyticLabelText(
      analytic.label === "none" || analytic.label === "value" ? "computation" : analytic.label,
      name,
      formatted,
    ) as string;
    annotations.push({
      kind: "range",
      ...(axis === "x" ? { x1: position(lo), x2: position(hi) } : { y1: lo, y2: hi }),
      label,
      pattern: analytic.pattern,
      opacity: analytic.opacity,
      analytic: { id, value: [lo, hi] },
    } as ChartAnnotation);
    marks.push({
      id,
      index,
      kind: "band",
      axis,
      of: source.key,
      from: lo,
      to: hi,
      label,
      description,
      ifOverflow,
    });
    if (ifOverflow === "extend" && !source.isX) {
      extents.push({ axis, keys: source.keys, lo, hi });
    }
  });

  return { annotations, marks, extents };
}

/**
 * Widens `domain` to include every extent that applies to `dataKeys` on
 * `axis`, padding a grown end by 5 % of the span so the line never sits
 * flush on the plot edge. Returns `domain` itself when nothing applies.
 */
export function widenDomainForAnalytics(
  domain: [number, number],
  extents: readonly AnalyticExtent[] | undefined,
  dataKeys: readonly string[] | undefined,
  axis: "x" | "y" = "y",
): [number, number] {
  if (!extents?.length) return domain;
  let [lo, hi] = domain;
  let grewLo = false;
  let grewHi = false;
  for (const extent of extents) {
    if (extent.axis !== axis) continue;
    if (
      extent.keys !== "all" &&
      dataKeys &&
      dataKeys.length > 0 &&
      !extent.keys.some((key) => dataKeys.includes(key))
    ) {
      continue;
    }
    if (extent.lo < lo) {
      lo = extent.lo;
      grewLo = true;
    }
    if (extent.hi > hi) {
      hi = extent.hi;
      grewHi = true;
    }
  }
  if (!grewLo && !grewHi) return domain;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.05;
  return [grewLo ? lo - pad : lo, grewHi ? hi + pad : hi];
}
