/**
 * AreaChart: thirty daily rows and one Area.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { AreaChartProps } from "../../charts/area-chart";
import { daily } from "./data";
import type { ChartFixture } from "./types";

export const AREA_CHART_FIXTURE = {
  id: "AreaChart",
  props: { data: daily } satisfies Omit<AreaChartProps, "children">,
  children: [{ component: "Area", props: { dataKey: "revenue" } }],
} satisfies ChartFixture;
