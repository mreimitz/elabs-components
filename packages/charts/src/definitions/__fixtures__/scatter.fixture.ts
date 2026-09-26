/**
 * Scatter: one series of a ScatterChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { ScatterProps } from "../../charts/scatter";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = { dataKey: "revenue" } satisfies ScatterProps;

export const SCATTER_FIXTURE = {
  id: "Scatter",
  props,
  host: {
    id: "ScatterChart",
    props: { data: daily },
    children: [{ component: "Scatter", props }],
  },
} satisfies PartFixture;
