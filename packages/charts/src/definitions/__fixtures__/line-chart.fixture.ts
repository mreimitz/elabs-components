/**
 * LineChart: thirty daily rows and one Line.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { LineChartProps } from "../../charts/line-chart";
import { daily } from "./data";
import type { ChartFixture } from "./types";

export const LINE_CHART_FIXTURE = {
  id: "LineChart",
  props: { data: daily } satisfies Omit<LineChartProps, "children">,
  children: [{ component: "Line", props: { dataKey: "revenue" } }],
} satisfies ChartFixture;
