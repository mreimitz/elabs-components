/**
 * TreeChart: a two-leaf hierarchy, no children prop.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { TreeChartProps } from "../../charts/tree-chart";
import { treeHierarchy } from "./data";
import type { ChartFixture } from "./types";

export const TREE_CHART_FIXTURE = {
  id: "TreeChart",
  props: { data: treeHierarchy } satisfies TreeChartProps,
  children: [],
} satisfies ChartFixture;
