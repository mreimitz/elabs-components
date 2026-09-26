/**
 * Gauge: one value against a 100-point dial, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { GaugeProps } from "../../charts/gauge";
import type { ChartFixture } from "./types";

export const GAUGE_FIXTURE = {
  id: "Gauge",
  props: { value: 62, centerValue: 62 } satisfies Omit<GaugeProps, "children">,
  children: [],
} satisfies ChartFixture;
