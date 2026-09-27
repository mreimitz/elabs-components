/**
 * ComposedChart: thirty daily rows, two bar series and a line.
 * Minimal props, so every default is exercised (RM-175). The second bar series
 * (RM-182) lets the parity test see the bar defaults that only act between
 * bars: `barGap`, `stacked`, `stackGap` and `insetBars`.
 */

import type { ComposedChartProps } from "../../charts/composed-chart";
import { daily } from "./data";
import type { ChartFixture } from "./types";

/** `daily` plus a second measure for the second bar series. */
const rows = daily.map((row) => ({ ...row, cost: row.revenue - row.profit }));

export const COMPOSED_CHART_FIXTURE = {
  id: "ComposedChart",
  props: { data: rows } satisfies Omit<ComposedChartProps, "children">,
  children: [
    { component: "SeriesBar", props: { dataKey: "revenue" } },
    { component: "SeriesBar", props: { dataKey: "cost" } },
    { component: "Line", props: { dataKey: "profit" } },
  ],
} satisfies ChartFixture;
