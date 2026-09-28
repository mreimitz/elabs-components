"use client";

/**
 * composed-chart-context.tsx — the `SeriesBar` layout a `ComposedChart`
 * publishes, beside the cartesian commons rather than inside them.
 *
 * The time-series shell still hands `ChartProvider` one value; the provider
 * routes these fields here ({@link useComposedChartSlice}). Outside a
 * `ComposedChart` every field is unset.
 *
 * Internal: not exported from the package entry point.
 */

import { createContext, useContext, useMemo } from "react";

export interface ComposedChartContextValue {
  /** `SeriesBar` dataKeys in tree order, for grouped columns at each x */
  composedBarDataKeys?: string[];
  /** Target bar width in px (the React chart library `barSize` style). */
  composedBarSize?: number;
  /** Max bar width in px (the React chart library `maxBarSize`). */
  composedMaxBarSize?: number;
  /** Gap between grouped `SeriesBar` columns in px. */
  composedBarGap?: number;
  /** When true, `SeriesBar` segments stack in child order at each x. */
  composedStacked?: boolean;
  /** Per-row cumulative offsets for stacked `SeriesBar` (data index → dataKey → offset). */
  composedStackOffsets?: Map<number, Map<string, number>>;
  /** Vertical gap in px between stacked `SeriesBar` segments. Default: 0 */
  composedStackGap?: number;
}

const NO_COMPOSED_CHART: ComposedChartContextValue = {
  composedBarDataKeys: undefined,
  composedBarSize: undefined,
  composedMaxBarSize: undefined,
  composedBarGap: undefined,
  composedStacked: undefined,
  composedStackOffsets: undefined,
  composedStackGap: undefined,
};

export const ComposedChartContext = createContext<ComposedChartContextValue>(NO_COMPOSED_CHART);

/** The composed slice of a chart value, memoised on its own field identities. */
export function useComposedChartSlice(value: ComposedChartContextValue): ComposedChartContextValue {
  const {
    composedBarDataKeys,
    composedBarSize,
    composedMaxBarSize,
    composedBarGap,
    composedStacked,
    composedStackOffsets,
    composedStackGap,
  } = value;
  return useMemo(
    () => ({
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    }),
    [
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    ],
  );
}

/** The nearest `ComposedChart`'s `SeriesBar` layout; every field unset outside one. */
export function useComposedChartContext(): ComposedChartContextValue {
  return useContext(ComposedChartContext);
}
