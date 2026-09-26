/**
 * MetricGrid: two plain tiles standing in for MetricCards.
 * Minimal props, so every default is exercised (RM-176).
 */

import { createElement } from "react";
import type { MetricGridProps } from "../../metric-grid/metric-grid";
import type { ChartFixture } from "./types";

export const METRIC_GRID_FIXTURE = {
  id: "MetricGrid",
  props: {
    children: [
      createElement("div", { key: "a" }, "Tile A"),
      createElement("div", { key: "b" }, "Tile B"),
    ],
  } satisfies MetricGridProps,
  children: [],
} satisfies ChartFixture;
