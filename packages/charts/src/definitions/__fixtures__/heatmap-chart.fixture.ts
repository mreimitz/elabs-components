/**
 * HeatmapChart: a 2×2 grid, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { HeatmapChartProps } from "../../charts/heatmap/heatmap-chart";
import { heatmapRows } from "./data";
import type { ChartFixture } from "./types";

export const HEATMAP_CHART_FIXTURE = {
  id: "HeatmapChart",
  props: {
    data: heatmapRows,
    x: "day",
    y: "hour",
    valueKey: "count",
  } satisfies HeatmapChartProps,
  children: [],
} satisfies ChartFixture;
