/**
 * ScatterChart: thirty daily rows and one Scatter.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { ScatterChartProps } from "../../charts/scatter-chart";
import { daily } from "./data";
import type { ChartFixture } from "./types";

export const SCATTER_CHART_FIXTURE = {
  id: "ScatterChart",
  props: { data: daily } satisfies Omit<ScatterChartProps, "children">,
  children: [{ component: "Scatter", props: { dataKey: "revenue" } }],
} satisfies ChartFixture;
