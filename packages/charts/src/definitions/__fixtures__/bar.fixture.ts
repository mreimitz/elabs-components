/**
 * Bar: one series of a BarChart.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { BarProps } from "../../charts/bar";
import { categories } from "./data";
import type { PartFixture } from "./types";

const props = { dataKey: "value" } satisfies BarProps;

export const BAR_FIXTURE = {
  id: "Bar",
  props,
  host: {
    id: "BarChart",
    props: { data: categories },
    children: [{ component: "Bar", props }],
  },
} satisfies PartFixture;
