/**
 * Grid: no props of its own, behind a LineChart's line.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { GridProps } from "../../charts/grid";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = {} satisfies GridProps;

export const GRID_FIXTURE = {
  id: "Grid",
  props,
  host: {
    id: "LineChart",
    props: { data: daily },
    children: [
      { component: "Grid", props },
      { component: "Line", props: { dataKey: "revenue" } },
    ],
  },
} satisfies PartFixture;
