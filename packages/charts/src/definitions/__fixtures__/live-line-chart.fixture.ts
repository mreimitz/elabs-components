/**
 * LiveLineChart: one streamed point and the LiveLine mark.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { LiveLineChartProps } from "../../charts/live-line-chart";
import { LIVE_LINE_ROWS } from "./data";
import type { ChartFixture } from "./types";

export const LIVE_LINE_CHART_FIXTURE = {
  id: "LiveLineChart",
  props: { data: LIVE_LINE_ROWS, value: 3 } satisfies Omit<LiveLineChartProps, "children">,
  children: [{ component: "LiveLine", props: { dataKey: "value" } }],
} satisfies ChartFixture;
