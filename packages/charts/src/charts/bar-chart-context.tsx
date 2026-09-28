"use client";

/**
 * bar-chart-context.tsx — the state only `BarChart` and its own parts read,
 * published beside the cartesian commons rather than inside them.
 *
 * `BarChart` still hands `ChartProvider` one value; the provider routes these
 * three fields here ({@link useBarChartSlice}). The band-scale fields
 * (`barScale`, `bandWidth`, `stacked`, …) are NOT here: shared layers
 * (tooltip, gestures, grid, annotations, analytics, Waterfall) branch on
 * them, so they stay in the commons as the categorical x-scale variant.
 *
 * Internal: not exported from the package entry point.
 */

import { createContext, useContext, useMemo } from "react";
import type { CategoryAxisPlan } from "./category-axis-plan";

export interface BarChartContextValue {
  /**
   * How the categorical axis resolved its labels (measure → tilt → trim → drop
   * → hide). Published by `BarChart`, which computes it to reserve axis space —
   * `BarXAxis`/`BarYAxis` consume it so the reserved space and the rendered
   * labels can never disagree. Absent when the axis is not a direct child.
   */
  categoryAxisPlan?: CategoryAxisPlan;
  /** `colorBy` resolution: a row's bar colour, overriding the series fill. */
  barColorOf?: (row: Record<string, unknown>) => string | undefined;
  /** Fraction of the band each side a main bar gives up to its `comparison` column. */
  barCrossInset?: number;
}

const NO_BAR_CHART: BarChartContextValue = {
  categoryAxisPlan: undefined,
  barColorOf: undefined,
  barCrossInset: undefined,
};

export const BarChartContext = createContext<BarChartContextValue>(NO_BAR_CHART);

/** The bar-private slice of a chart value, memoised on its own field identities. */
export function useBarChartSlice(value: BarChartContextValue): BarChartContextValue {
  const { categoryAxisPlan, barColorOf, barCrossInset } = value;
  return useMemo(
    () => ({ categoryAxisPlan, barColorOf, barCrossInset }),
    [categoryAxisPlan, barColorOf, barCrossInset],
  );
}

/** The nearest `BarChart`'s private state; every field unset outside one. */
export function useBarChartContext(): BarChartContextValue {
  return useContext(BarChartContext);
}
