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
import type { ChartValueFormat } from "../value-format";
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

/**
 * The `valueFormat`/`currency` of the first direct child named in `names`
 * (`"YAxis"`, `"BarValueAxis"`) that sets a `valueFormat`, so the legend
 * prints its values the way the value axis prints its ticks. Empty when no
 * such child exists; the legend then prints plain grouped numbers.
 */
export function findAxisValueFormat(
  children: ReactNode,
  names: readonly string[],
): LegendAxisValueFormat {
  let found: LegendAxisValueFormat | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child) || typeof child.type !== "function") return;
    const type = child.type as { displayName?: string; name?: string };
    if (!names.includes(type.displayName || type.name || "")) return;
    const { valueFormat, currency } = child.props as LegendAxisValueFormat;
    if (valueFormat === undefined) return;
    found = { valueFormat, currency };
  });
  return found ?? NO_AXIS_FORMAT;
}
