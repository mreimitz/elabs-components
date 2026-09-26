/**
 * NetworkChart: three nodes, two links, force layout. `layout` has no kind
 * default, so it is supplied explicitly. Minimal props, so every other default is
 * exercised (RM-176).
 */

import type { NetworkChartProps } from "../../charts/network/network-chart";
import { networkLinks, networkNodes } from "./data";
import type { ChartFixture } from "./types";

export const NETWORK_CHART_FIXTURE = {
  id: "NetworkChart",
  props: {
    nodes: networkNodes,
    links: networkLinks,
    layout: "force",
  } satisfies NetworkChartProps,
  children: [],
} satisfies ChartFixture;
