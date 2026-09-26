/**
 * PieChart: three shares and one PieSlice per row.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { PieChartProps } from "../../charts/pie-chart";
import { shares } from "./data";
import type { ChartFixture } from "./types";

export const PIE_CHART_FIXTURE = {
  id: "PieChart",
  props: { data: shares } satisfies Omit<PieChartProps, "children">,
  children: [
    { component: "PieSlice", props: { index: 0 } },
    { component: "PieSlice", props: { index: 1 } },
    { component: "PieSlice", props: { index: 2 } },
  ],
} satisfies ChartFixture;
