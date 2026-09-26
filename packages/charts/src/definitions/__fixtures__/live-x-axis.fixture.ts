/**
 * LiveXAxis: no props of its own, under a LiveLineChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { LiveXAxisProps } from "../../charts/live-x-axis";
import { LIVE_LINE_ROWS } from "./data";
import type { PartFixture } from "./types";

const props = {} satisfies LiveXAxisProps;

export const LIVE_X_AXIS_FIXTURE = {
  id: "LiveXAxis",
  props,
  host: {
    id: "LiveLineChart",
    props: { data: LIVE_LINE_ROWS, value: 3 },
    children: [
      { component: "LiveLine", props: { dataKey: "value" } },
      { component: "LiveXAxis", props },
    ],
  },
} satisfies PartFixture;
