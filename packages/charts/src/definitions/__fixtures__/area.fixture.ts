/**
 * Area: one series of an AreaChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { AreaProps } from "../../charts/area";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = { dataKey: "revenue" } satisfies AreaProps;

export const AREA_FIXTURE = {
  id: "Area",
  props,
  host: {
    id: "AreaChart",
    props: { data: daily },
    children: [{ component: "Area", props }],
  },
} satisfies PartFixture;
