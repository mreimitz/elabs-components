/**
 * TreemapChart: a two-leaf hierarchy, no children prop.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { TreemapChartProps } from "../../charts/treemap/treemap-chart";
import { treeHierarchy } from "./data";
import type { ChartFixture } from "./types";

export const TREEMAP_CHART_FIXTURE = {
  id: "TreemapChart",
  props: { data: treeHierarchy } satisfies TreemapChartProps,
  children: [],
} satisfies ChartFixture;
