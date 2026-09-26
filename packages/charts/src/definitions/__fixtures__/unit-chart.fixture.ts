/**
 * UnitChart: two units, waffle layout. `layout` has no kind default, so it is
 * supplied explicitly. Minimal props, so every other default is exercised (RM-176).
 */

import type { UnitChartProps } from "../../charts/unit-chart";
import { shares } from "./data";
import type { ChartFixture } from "./types";

export const UNIT_CHART_FIXTURE = {
  id: "UnitChart",
  props: { data: shares.slice(0, 2), layout: "waffle" } satisfies UnitChartProps,
  children: [],
} satisfies ChartFixture;
