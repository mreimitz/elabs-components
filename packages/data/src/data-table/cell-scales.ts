/**
 * cell-scales.ts — the shared scales behind `DataTable`'s in-cell visuals
 * (RM-123). Pure: no React, no DOM.
 *
 * Every visual cell reads ONE scale per column, computed once over the full
 * data (never the current page, filter or sort), so a bar, a sparkline or a
 * heatmap colour means the same thing on every page and after every sort.
 * Colour decisions (heatmap ramps, categories) come from `colorScaleFor`
 * (`@elabs-ai/components-ui`) — the one value → colour-token scale `charts`,
 * `data` and `maps` share — so colours are `var(--chart-…)` references.
 */
import { colorScaleFor, type ColorScale, type ColorScaleSpec } from "@elabs-ai/components-ui";
import type { DataTableBarVisual, DataTableColumnMeta, DataTableHeatmapScale } from "./column-meta";

/** `[min, max]` of the finite numbers in a set. */
export interface NumericExtent {
  min: number;
  max: number;
}

/** The finite numbers in `values`, ignoring everything else. */
export function finiteNumbers(values: readonly unknown[]): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/** The extent of the finite numbers in `values`; `null` when there are none. */
export function extentOf(values: readonly unknown[]): NumericExtent | null {
  const nums = finiteNumbers(values);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** The union of two extents (either may be `null`). */
export function unionExtent(
  a: NumericExtent | null,
  b: NumericExtent | null,
): NumericExtent | null {
  if (!a) return b;
  if (!b) return a;
  return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
}

/** A bar domain always contains zero, so a bar is always measured from zero. */
export function barDomain(
  range: DataTableBarVisual["range"],
  column: NumericExtent | null,
  table: NumericExtent | null,
): readonly [number, number] {
  const source =
    Array.isArray(range) && range.length === 2
      ? { min: Math.min(range[0], range[1]), max: Math.max(range[0], range[1]) }
      : range === "table"
        ? table
        : column;
  return [Math.min(0, source?.min ?? 0), Math.max(0, source?.max ?? 0)];
}

/**
 * Where a bar sits inside its track, as percentages of the track width:
 * `start` is the inline-start edge, `size` the length. Negative values grow
 * toward inline-start from zero. Both are clamped to 0…100.
 */
export function barGeometry(
  value: number,
  domain: readonly [number, number],
): { start: number; size: number; zero: number; negative: boolean } {
  const [lo, hi] = domain;
  const span = hi - lo;
  if (!Number.isFinite(value) || span <= 0) return { start: 0, size: 0, zero: 0, negative: false };
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));
  const zero = pct(0);
  const end = pct(value);
  return {
    start: Math.min(zero, end),
    size: Math.max(0, Math.abs(end - zero)),
    zero,
    negative: value < 0,
  };
}

/**
 * How much room a column reserves for a printed label, in `ch`: the longest
 * label's length in code points.
 *
 * A visual cell draws in what its printed value leaves over, so the text box
 * must be a COLUMN-wide constant. Sized per row instead, a row with a shorter
 * number gets a longer track and therefore draws a longer bar for a smaller
 * value, and a diverging column's zero rule lands on a different pixel in every
 * row. `tabular-nums` makes every digit exactly `1ch` and the separators
 * narrower, so a reservation of the longest label's character count holds it.
 */
export function labelBoxCh(labels: readonly string[]): number {
  let widest = 0;
  for (const label of labels) widest = Math.max(widest, [...label].length);
  return widest;
}

/** The first and last finite values of a series; `null` when it has none. */
export function seriesEnds(
  values: readonly (number | null)[],
): readonly [first: number, last: number] | null {
  const present = values.filter((v): v is number => v !== null);
  const first = present[0];
  const last = present[present.length - 1];
  return first === undefined || last === undefined ? null : [first, last];
}

/** A row's numbers for `keys`, `null` where a key holds no finite number. */
export function seriesValues(original: unknown, keys: readonly string[]): (number | null)[] {
  const record = (original ?? {}) as Record<string, unknown>;
  return keys.map((key) => {
    const v = record[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}

/** The `ColorScaleSpec` a heatmap scale asks `colorScaleFor` for. */
export function heatmapColorScaleSpec(scale: DataTableHeatmapScale): ColorScaleSpec {
  const base = {
    ...(scale.domain ? { domain: scale.domain } : null),
    ...(scale.palette ? { palette: scale.palette } : null),
  };
  const method = scale.method ?? "linear";
  if (scale.type === "stepped" || method === "custom") {
    return {
      ...base,
      type: "stepped",
      method: method === "linear" ? "equidistant" : method,
      ...(scale.steps !== undefined ? { steps: scale.steps } : null),
      ...(scale.breaks ? { breaks: scale.breaks } : null),
    };
  }
  if (method === "jenks") {
    return { ...base, type: "continuous", method: "natural", steps: scale.steps ?? 5 };
  }
  if (method === "quantile") {
    const steps = scale.steps ?? 5;
    const quantile =
      steps <= 2 ? "median" : steps <= 4 ? "quartiles" : steps <= 5 ? "quintiles" : "deciles";
    return { ...base, type: "continuous", method: quantile };
  }
  return { ...base, type: "continuous", method: "linear" };
}

/** Everything a column's visual cells share. Only the parts the column uses are set. */
export interface DataTableColumnScale {
  /** Extent of the column's own values. */
  extent: NumericExtent | null;
  /** Bar visual: the resolved `[lo, hi]` (always contains zero). */
  barDomain?: readonly [number, number];
  /** Bar `colorBy`: the category → colour scale. */
  barCategory?: ColorScale;
  /** Sparkline / columns: extent of every row's series values. */
  seriesExtent?: NumericExtent | null;
  /**
   * Heatmap: the value → ramp-colour scale. Heatmap columns with an identical
   * `scale` spec SHARE one scale over all their values (one heatmap across
   * several columns); `heatmapGroup` names it.
   */
  heatmap?: ColorScale;
  heatmapGroup?: string;
  /** `meta.colorBy`: the category → colour scale. */
  category?: ColorScale;
}

/** A minimal row: what `computeColumnScales` needs from a TanStack row. */
export interface ScaleRow {
  original: unknown;
  getValue: (columnId: string) => unknown;
}

/** A minimal column: its id and meta. */
export interface ScaleColumn {
  id: string;
  meta: DataTableColumnMeta | undefined;
}

function categoryValues(rows: readonly ScaleRow[], key: string): (string | number | null)[] {
  return rows.map((row) => {
    const v = ((row.original ?? {}) as Record<string, unknown>)[key];
    return typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ? v : null;
  });
}

function categoryScale(rows: readonly ScaleRow[], key: string): ColorScale {
  return colorScaleFor(categoryValues(rows, key), { type: "stepped", palette: "categorical" });
}

/**
 * One scale per column that needs one (a `visual` or a `colorBy`), over ALL
 * `rows`. Columns with neither are absent from the map.
 */
export function computeColumnScales(
  columns: readonly ScaleColumn[],
  rows: readonly ScaleRow[],
): Map<string, DataTableColumnScale> {
  const scales = new Map<string, DataTableColumnScale>();
  let tableBarExtent: NumericExtent | null = null;
  const heatmapValues = new Map<string, number[]>();
  for (const { id, meta } of columns) {
    if (!meta?.visual && !meta?.colorBy) continue;
    const values = rows.map((row) => row.getValue(id));
    const scale: DataTableColumnScale = { extent: extentOf(values) };
    const visual = meta.visual;
    if (visual?.kind === "bar" && visual.range === "table") {
      tableBarExtent = unionExtent(tableBarExtent, scale.extent);
    }
    if (visual?.kind === "bar" && visual.colorBy) {
      scale.barCategory = categoryScale(rows, visual.colorBy);
    }
    if (visual?.kind === "sparkline" || visual?.kind === "columns") {
      scale.seriesExtent = extentOf(rows.flatMap((row) => seriesValues(row.original, visual.keys)));
    }
    if (visual?.kind === "heatmap") {
      const group = JSON.stringify(visual.scale);
      scale.heatmapGroup = group;
      const pooled = heatmapValues.get(group) ?? [];
      pooled.push(...finiteNumbers(values));
      heatmapValues.set(group, pooled);
    }
    if (meta.colorBy) scale.category = categoryScale(rows, meta.colorBy.key);
    scales.set(id, scale);
  }
  // Bar domains and heatmap scales resolve last: `range: "table"` needs every
  // bar column's extent, a heatmap group every member column's values.
  const heatmapScales = new Map<string, ColorScale>();
  for (const { id, meta } of columns) {
    const scale = scales.get(id);
    if (!scale) continue;
    if (meta?.visual?.kind === "bar") {
      scale.barDomain = barDomain(meta.visual.range, scale.extent, tableBarExtent);
    }
    if (meta?.visual?.kind === "heatmap" && scale.heatmapGroup !== undefined) {
      let shared = heatmapScales.get(scale.heatmapGroup);
      if (!shared) {
        shared = colorScaleFor(
          heatmapValues.get(scale.heatmapGroup) ?? [],
          heatmapColorScaleSpec(meta.visual.scale),
        );
        heatmapScales.set(scale.heatmapGroup, shared);
      }
      scale.heatmap = shared;
    }
  }
  return scales;
}
