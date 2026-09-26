/**
 * DumbbellChart: three categories, a before/after pair each.
 * Minimal props, so every default is exercised (RM-176).
 */

import type { DumbbellChartProps } from "../../charts/dumbbell-chart";
import { dumbbellRows } from "./data";
import type { ChartFixture } from "./types";

export const DUMBBELL_CHART_FIXTURE = {
  id: "DumbbellChart",
  props: {
    data: dumbbellRows,
    category: "category",
    startKey: "before",
    endKey: "after",
  } satisfies DumbbellChartProps,
  children: [],
} satisfies ChartFixture;
