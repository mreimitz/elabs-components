/**
 * pie-grouping — automatic "Other" folding for `PieChart` (RM-114).
 *
 * Datawrapper's rule (`dw-charts.md` §2.17–2.21): beyond a handful of slices a
 * pie stops reading as a comparison, so the smallest members fold into one
 * named "Other" wedge. This module is the pure, engine-free fold: given the
 * data and a threshold/max, it decides WHICH slices fold and returns the
 * resulting slice list — `PieChart`'s `groupSmall` prop and `pieLegendItems`
 * both call it, so the chart and its legend can never disagree about the
 * fold.
 */

import type { PieData } from "./pie-context";

/**
 * `threshold`/`max` are independent gates that both apply when both are set
 * (a slice folds if EITHER gate says so) — `threshold` catches a long tail no
 * fixed count would, `max` caps the reading effort regardless of shape.
 */
export interface PieGroupSmallOptions {
  /** Fold a slice whose share of the total is below this fraction (0–1). */
  threshold?: number;
  /** Keep at most this many individual slices; fold the smallest beyond it. */
  max?: number;
  /**
   * Label for the folded slice. Default `"Other"` — plain English, not yet
   * routed through the locale seam: `messages.ts` (`@elabs-ai/components-ui`)
   * is outside this item's `touches`, so a properly localised default needs a
   * follow-up that adds a `charts.pie.other` key there.
   */
  label?: string;
}

/** Un-styled default for the folded "Other" slice's default label. */
const DEFAULT_OTHER_LABEL = "Other";

export interface PieGroupResult {
  /** The resulting slice list: kept slices in their original order, plus one trailing folded slice when a fold happened. */
  data: PieData[];
  /** How many original slices were folded into "Other" (`0` = no-op). */
  foldedCount: number;
}

/**
 * Fold the smallest slices of `data` into one trailing "Other" slice per
 * `options`. A no-op (`{ data: [...data], foldedCount: 0 }`) when `options`
 * is unset, sets neither gate, the total is non-positive, or nothing
 * qualifies — every existing `PieChart` caller (which never sets
 * `groupSmall`) sees byte-identical output.
 *
 * Never folds every slice away: if every slice would fold, the single
 * largest one is kept out so the chart always has at least one real wedge
 * beside "Other".
 */
export function groupSmallSlices(
  data: readonly PieData[],
  options: PieGroupSmallOptions | undefined,
): PieGroupResult {
  if (!options || (options.threshold === undefined && options.max === undefined)) {
    return { data: [...data], foldedCount: 0 };
  }
  if (data.length === 0) {
    return { data: [...data], foldedCount: 0 };
  }
  const total = data.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0);
  if (total <= 0) {
    return { data: [...data], foldedCount: 0 };
  }

  const byIndex = data.map((d, i) => ({ d, i }));
  const ascByValue = [...byIndex].sort((a, b) => a.d.value - b.d.value);

  const fold = new Set<number>();
  if (options.threshold !== undefined) {
    for (const { d, i } of ascByValue) {
      if (d.value / total < options.threshold) fold.add(i);
    }
  }
  if (options.max !== undefined) {
    for (const { i } of ascByValue) {
      if (data.length - fold.size <= options.max) break;
      fold.add(i);
    }
  }
  if (fold.size === 0) {
    return { data: [...data], foldedCount: 0 };
  }
  if (fold.size === data.length) {
    // Keep the single largest slice out of the fold — a chart is never ALL "Other".
    fold.delete(ascByValue[ascByValue.length - 1]!.i);
  }

  const kept: PieData[] = [];
  const foldedCategories: string[] = [];
  let foldedValue = 0;
  data.forEach((d, i) => {
    if (fold.has(i)) {
      foldedValue += Number.isFinite(d.value) ? d.value : 0;
      foldedCategories.push(d.label);
    } else {
      kept.push(d);
    }
  });

  const other: PieData = {
    label: options.label ?? DEFAULT_OTHER_LABEL,
    value: foldedValue,
    categories: foldedCategories,
  };
  return { data: [...kept, other], foldedCount: foldedCategories.length };
}

/** A `ChartLegend` item (`LegendItem` shape) with the fields a pie legend needs. */
export interface PieLegendItem {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  seriesIndex: number;
}

export interface PieLegendItemsOptions {
  /** Same fold `PieChart`'s own `groupSmall` prop would apply — keep them identical. */
  groupSmall?: PieGroupSmallOptions;
  /** Reading order. Default `"desc"` (mirrors `PieChart`'s own default). */
  sort?: "desc" | "none";
  /** Color for a slice at its index INTO THE GROUPED result (matches `PieChart`'s own `getColor`). */
  getColor: (index: number) => string;
}

/**
 * The legend rows for a `PieChart` — grouped the same way `groupSmall` would,
 * ordered the same way `sort` would, each carrying `maxValue` = the grouped
 * total so `<ChartLegend showPercentage />` reads a real percentage (#489,
 * "this item exposes `legendItems` with percent values"). Pure: call it with
 * the SAME `groupSmall`/`getColor` given to the sibling `<PieChart>` and the
 * two can never disagree about which slices exist.
 */
export function pieLegendItems(
  data: readonly PieData[],
  options: PieLegendItemsOptions,
): PieLegendItem[] {
  const { data: grouped } = groupSmallSlices(data, options.groupSmall);
  const total = grouped.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0);
  const items = grouped.map((d, i) => ({
    label: d.label,
    value: d.value,
    maxValue: total,
    color: options.getColor(i),
    seriesIndex: i,
  }));
  if (options.sort === "none") {
    return items;
  }
  return [...items].sort((a, b) => b.value - a.value);
}
