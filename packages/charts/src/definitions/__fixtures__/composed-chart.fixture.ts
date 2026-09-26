/**
 * ComposedChart: thirty daily rows, bars and a line.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { ComposedChartProps } from "../../charts/composed-chart";
import { daily } from "./data";
import type { ChartFixture } from "./types";

export const COMPOSED_CHART_FIXTURE = {
  id: "ComposedChart",
  props: { data: daily } satisfies Omit<ComposedChartProps, "children">,
  children: [
    { component: "SeriesBar", props: { dataKey: "revenue" } },
    { component: "Line", props: { dataKey: "profit" } },
  ],
} satisfies ChartFixture;
