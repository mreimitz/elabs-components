/**
 * Line: one series of a LineChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { LineProps } from "../../charts/line";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = { dataKey: "revenue" } satisfies LineProps;

export const LINE_FIXTURE = {
  id: "Line",
  props,
  host: {
    id: "LineChart",
    props: { data: daily },
    children: [{ component: "Line", props }],
  },
} satisfies PartFixture;
