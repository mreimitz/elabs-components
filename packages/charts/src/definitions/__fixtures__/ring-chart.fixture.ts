/**
 * RingChart: two gauges and one Ring per row.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { RingChartProps } from "../../charts/ring-chart";
import { ringRows } from "./data";
import type { ChartFixture } from "./types";

export const RING_CHART_FIXTURE = {
  id: "RingChart",
  props: { data: ringRows } satisfies Omit<RingChartProps, "children">,
  children: [
    { component: "Ring", props: { index: 0 } },
    { component: "Ring", props: { index: 1 } },
  ],
} satisfies ChartFixture;
