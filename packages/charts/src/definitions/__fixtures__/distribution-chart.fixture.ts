/**
 * DistributionChart: twenty observations, a histogram. `kind` has no kind
 * default, so it is supplied explicitly. Minimal props, so every other default is
 * exercised (RM-176).
 */

import type { DistributionChartProps } from "../../charts/distribution/distribution-chart";
import { distributionRows } from "./data";
import type { ChartFixture } from "./types";

export const DISTRIBUTION_CHART_FIXTURE = {
  id: "DistributionChart",
  props: {
    data: distributionRows,
    valueKey: "value",
    kind: "histogram",
  } satisfies DistributionChartProps,
  children: [],
} satisfies ChartFixture;
