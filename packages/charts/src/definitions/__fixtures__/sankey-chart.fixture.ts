/**
 * SankeyChart: three nodes, two links, and the standard node/link parts.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { SankeyChartProps } from "../../charts/sankey/sankey-chart";
import { sankeyData } from "./data";
import type { ChartFixture } from "./types";

export const SANKEY_CHART_FIXTURE = {
  id: "SankeyChart",
  props: { data: sankeyData } satisfies Omit<SankeyChartProps, "children">,
  children: [
    { component: "SankeyNode", props: {} },
    { component: "SankeyLink", props: {} },
  ],
} satisfies ChartFixture;
