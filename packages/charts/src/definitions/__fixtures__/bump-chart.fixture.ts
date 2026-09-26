/**
 * BumpChart: two entities across three periods.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { BumpChartProps } from "../../charts/bump-chart";
import { bumpRows } from "./data";
import type { ChartFixture } from "./types";

export const BUMP_CHART_FIXTURE = {
  id: "BumpChart",
  props: {
    data: bumpRows,
    period: "period",
    entity: "entity",
    valueKey: "value",
  } satisfies BumpChartProps,
  children: [],
} satisfies ChartFixture;
