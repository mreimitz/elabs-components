/**
 * BarValueAxis: no props of its own, under a horizontal BarChart, the only place it draws.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { BarValueAxisProps } from "../../charts/bar-value-axis";
import { categories } from "./data";
import type { PartFixture } from "./types";

const props = {} satisfies BarValueAxisProps;

export const BAR_VALUE_AXIS_FIXTURE = {
  id: "BarValueAxis",
  props,
  host: {
    id: "BarChart",
    props: { data: categories, orientation: "horizontal" },
    children: [
      { component: "Bar", props: { dataKey: "value" } },
      { component: "BarValueAxis", props },
    ],
  },
} satisfies PartFixture;
