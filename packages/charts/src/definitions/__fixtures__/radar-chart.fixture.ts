/**
 * RadarChart: one series over three metrics, and the standard grid/axis/labels/area parts.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { RadarChartProps } from "../../charts/radar-chart";
import { radarMetrics, radarRows } from "./data";
import type { ChartFixture } from "./types";

export const RADAR_CHART_FIXTURE = {
  id: "RadarChart",
  props: { data: radarRows, metrics: radarMetrics } satisfies Omit<RadarChartProps, "children">,
  children: [
    { component: "RadarGrid", props: {} },
    { component: "RadarAxis", props: {} },
    { component: "RadarLabels", props: {} },
    { component: "RadarArea", props: { index: 0 } },
  ],
} satisfies ChartFixture;
