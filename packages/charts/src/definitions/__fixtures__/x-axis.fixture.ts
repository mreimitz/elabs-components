/**
 * XAxis: no props of its own, under a LineChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { XAxisProps } from "../../charts/x-axis";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = {} satisfies XAxisProps;

export const X_AXIS_FIXTURE = {
  id: "XAxis",
  props,
  host: {
    id: "LineChart",
    props: { data: daily },
    children: [
      { component: "Line", props: { dataKey: "revenue" } },
      { component: "XAxis", props },
    ],
  },
} satisfies PartFixture;
