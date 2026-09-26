/**
 * BulletChart: one value against a target, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { BulletChartProps } from "../../charts/bullet-chart";
import type { ChartFixture } from "./types";

export const BULLET_CHART_FIXTURE = {
  id: "BulletChart",
  props: { value: 72, target: 100 } satisfies BulletChartProps,
  children: [],
} satisfies ChartFixture;
