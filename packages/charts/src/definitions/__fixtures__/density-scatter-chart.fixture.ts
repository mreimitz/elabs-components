/**
 * DensityScatterChart: twenty rows. `renderer` is forced to `"canvas2d"` for this
 * fixture only, since jsdom has no WebGL context — the definition's own kind
 * default stays `"webgl"` verbatim (no behaviour change). Minimal props, so every
 * other default is exercised (RM-176).
 */

import type { DensityScatterChartProps } from "../../charts/density-scatter/density-scatter-chart";
import { densityRows } from "./data";
import type { ChartFixture } from "./types";

export const DENSITY_SCATTER_CHART_FIXTURE = {
  id: "DensityScatterChart",
  props: { data: densityRows, renderer: "canvas2d" } satisfies DensityScatterChartProps,
  children: [],
} satisfies ChartFixture;
