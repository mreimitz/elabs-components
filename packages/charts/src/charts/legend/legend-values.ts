/**
 * legend-values.ts — the numbers a container legend's value column prints
 * (`legend={{ values: true }}`, F09).
 *
 * Pure reductions over a family's own rows. Each family picks the one its
 * entries mean (`ContainerLegendConfig.values` lists them): a series total, the
 * last visible point, or a point count. Every reduction skips a missing or
 * non-finite cell and returns `undefined` when nothing is left, so an entry
 * with no data shows an empty column, never a made-up 0.
 */

import { Children, isValidElement, type ReactNode } from "react";
import type { ChartValueFormat, ChartValueFormatSpec } from "../value-format";
import { DEFAULT_Y_AXIS_ID, normalizeYAxisId } from "../y-axis-scales";
import type { ContainerLegendProp } from "./use-container-legend";

type LegendRow = Readonly<Record<string, unknown>>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Whether a container's `legend` prop asks for the value column. */
export function legendWantsValues(legend: ContainerLegendProp | undefined): boolean {
  return typeof legend === "object" && legend !== null && legend.values === true;
}

/** The sum of every finite `row[key]`; `undefined` when no row has one. */
export function sumLegendValue(rows: readonly LegendRow[], key: string): number | undefined {
  let sum = 0;
  let found = false;
  for (const row of rows) {
    const value = row[key];
    if (isFiniteNumber(value)) {
      sum += value;
      found = true;
    }
  }
  return found ? sum : undefined;
}

/** The last finite `row[key]` in row order; `undefined` when no row has one. */
export function lastLegendValue(rows: readonly LegendRow[], key: string): number | undefined {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = rows[i]?.[key];
    if (isFiniteNumber(value)) return value;
  }
  return undefined;
}

/** How many rows carry a finite `row[key]` (a scatter series' point count). */
export function countLegendValue(rows: readonly LegendRow[], key: string): number {
  let count = 0;
  for (const row of rows) {
    if (isFiniteNumber(row[key])) count += 1;
  }
  return count;
}

/** The value format a legend borrows from a chart's value axis. */
export interface LegendAxisValueFormat {
  valueFormat?: ChartValueFormat;
  currency?: string;
}

const NO_AXIS_FORMAT: LegendAxisValueFormat = {};

const PRIMARY_AXIS_ONLY: readonly (string | number | undefined)[] = [DEFAULT_Y_AXIS_ID];

function sameValueFormat(a: ChartValueFormat | undefined, b: ChartValueFormat | undefined) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ChartValueFormatSpec>;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function sameAxisFormat(a: LegendAxisValueFormat, b: LegendAxisValueFormat) {
  return a.currency === b.currency && sameValueFormat(a.valueFormat, b.valueFormat);
}

/**
 * The value format a legend borrows from a chart's value axes, so it prints
 * its values the way the axes print their ticks.
 *
 * `axisIds` lists the `yAxisId` of every entry that prints a value (default:
 * the primary axis only). Each id reads the first direct child named in
 * `names` (`"YAxis"`, `"BarValueAxis"`) on that axis that sets a
 * `valueFormat`. When every listed axis resolves to the same
 * `valueFormat`/`currency`, the legend uses it. When they differ (a currency
 * axis on the left, a percent axis on the right), the result is empty and the
 * legend prints plain grouped numbers: one legend formats every entry with one
 * formatter, and either axis' unit would mislabel the other axis' series.
 * Empty, too, when no listed axis sets a `valueFormat`.
 */
export function findAxisValueFormat(
  children: ReactNode,
  names: readonly string[],
  axisIds: readonly (string | number | undefined)[] = PRIMARY_AXIS_ONLY,
): LegendAxisValueFormat {
  const byAxis = new Map<string, LegendAxisValueFormat>();
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "function") return;
    const type = child.type as { displayName?: string; name?: string };
    if (!names.includes(type.displayName || type.name || "")) return;
    const { valueFormat, currency, yAxisId } = child.props as LegendAxisValueFormat & {
      yAxisId?: string | number;
    };
    const axisId = normalizeYAxisId(yAxisId);
    if (valueFormat === undefined || byAxis.has(axisId)) return;
    byAxis.set(axisId, { valueFormat, currency });
  });
  const ids = new Set(axisIds.map((id) => normalizeYAxisId(id)));
  let shared: LegendAxisValueFormat | undefined;
  for (const id of ids) {
    const format = byAxis.get(id) ?? NO_AXIS_FORMAT;
    if (shared === undefined) shared = format;
    else if (!sameAxisFormat(shared, format)) return NO_AXIS_FORMAT;
  }
  return shared ?? NO_AXIS_FORMAT;
}
