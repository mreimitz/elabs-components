/**
 * FunnelChart: a three-stage drop-off, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { FunnelChartProps } from "../../charts/funnel-chart";
import { funnelRows } from "./data";
import type { ChartFixture } from "./types";

export const FUNNEL_CHART_FIXTURE = {
  id: "FunnelChart",
  props: { data: funnelRows } satisfies FunnelChartProps,
  children: [],
} satisfies ChartFixture;
