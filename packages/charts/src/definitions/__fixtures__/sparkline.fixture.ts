/**
 * Sparkline: seven values, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { SparklineProps } from "../../sparkline/sparkline";
import type { ChartFixture } from "./types";

export const SPARKLINE_FIXTURE = {
  id: "Sparkline",
  props: { values: [3, 5, 4, 8, 6, 9, 7] } satisfies SparklineProps,
  children: [],
} satisfies ChartFixture;
