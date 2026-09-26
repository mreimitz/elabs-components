/**
 * ParallelCoordinatesChart: three rows over four numeric dimensions, no children.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { ParallelCoordinatesChartProps } from "../../charts/parallel-coordinates/parallel-coordinates-chart";
import { parallelDimensions, parallelRows } from "./data";
import type { ChartFixture } from "./types";

export const PARALLEL_COORDINATES_CHART_FIXTURE = {
  id: "ParallelCoordinatesChart",
  props: {
    data: parallelRows,
    entity: "model",
    dimensions: parallelDimensions,
  } satisfies ParallelCoordinatesChartProps,
  children: [],
} satisfies ChartFixture;
