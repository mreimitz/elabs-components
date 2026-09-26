/**
 * ChartCard: a title and a plain text body standing in for a chart.
 * Minimal props, so every default is exercised (RM-176).
 */

import { createElement } from "react";
import type { ChartCardProps } from "../../chart-card/chart-card";
import type { ChartFixture } from "./types";

export const CHART_CARD_FIXTURE = {
  id: "ChartCard",
  props: {
    title: "Revenue is up 8% QoQ",
    children: createElement("div", null, "chart"),
  } satisfies ChartCardProps,
  children: [],
} satisfies ChartFixture;
