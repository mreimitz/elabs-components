/**
 * ChoroplethChart: one square feature, and the standard feature part.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { ChoroplethChartProps } from "../../charts/choropleth/choropleth-chart";
import { choroplethData } from "./data";
import type { ChartFixture } from "./types";

export const CHOROPLETH_CHART_FIXTURE = {
  id: "ChoroplethChart",
  props: { data: choroplethData } satisfies Omit<ChoroplethChartProps, "children">,
  children: [{ component: "ChoroplethFeature", props: {} }],
} satisfies ChartFixture;
