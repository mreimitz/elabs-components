/**
 * YAxis: no props of its own, under a LineChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { YAxisProps } from "../../charts/y-axis";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = {} satisfies YAxisProps;

export const Y_AXIS_FIXTURE = {
  id: "YAxis",
  props,
  host: {
    id: "LineChart",
    props: { data: daily },
    children: [
      { component: "Line", props: { dataKey: "revenue" } },
      { component: "YAxis", props },
    ],
  },
} satisfies PartFixture;
