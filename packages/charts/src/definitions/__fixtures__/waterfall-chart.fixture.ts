/**
 * WaterfallChart: a gross-to-net bridge; it takes no children.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { WaterfallChartProps } from "../../charts/waterfall-chart";
import { WATERFALL_ROWS } from "./data";
import type { ChartFixture } from "./types";

export const WATERFALL_CHART_FIXTURE = {
  id: "WaterfallChart",
  props: { data: WATERFALL_ROWS } satisfies Omit<WaterfallChartProps, "children">,
  children: [],
} satisfies ChartFixture;
