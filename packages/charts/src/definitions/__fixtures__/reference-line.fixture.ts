/**
 * ReferenceLine: a rule at 120 on a LineChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { ReferenceLineProps } from "../../charts/reference-line";
import { daily } from "./data";
import type { PartFixture } from "./types";

const props = { value: 120 } satisfies ReferenceLineProps;

export const REFERENCE_LINE_FIXTURE = {
  id: "ReferenceLine",
  props,
  host: {
    id: "LineChart",
    props: { data: daily },
    children: [
      { component: "Line", props: { dataKey: "revenue" } },
      { component: "ReferenceLine", props },
    ],
  },
} satisfies PartFixture;
