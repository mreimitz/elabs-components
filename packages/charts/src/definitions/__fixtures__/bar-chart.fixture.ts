/**
 * BarChart: twelve categories and one Bar; `xDataKey` is left to its default, "name".
 * Minimal props, so every default is exercised (RM-175).
 */

import type { BarChartProps } from "../../charts/bar-chart";
import { categories } from "./data";
import type { ChartFixture } from "./types";

export const BAR_CHART_FIXTURE = {
  id: "BarChart",
  props: { data: categories } satisfies Omit<BarChartProps, "children">,
  children: [{ component: "Bar", props: { dataKey: "value" } }],
} satisfies ChartFixture;
