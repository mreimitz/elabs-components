/**
 * defaults-golden.ts — frozen kind-level `defaults` values for the five hierarchy/relational
 * families RM-184 adopted (RM-184 review, major finding).
 *
 * Treemap, Tree, Sankey, Network and ParallelCoordinates call `useResolvedChartProps` INSIDE
 * their own exported component (unlike the cartesian-core families, which stay unresolved
 * until a caller opts in via the definition). That means the "defaults parity" suite's "bare"
 * and "explicit" renders both resolve through the SAME definition, so a default value can move
 * with nothing turning red: proven by mutation (`curve: "linear"` → `"monotone"`,
 * `nodePadding: 24` → `30`, `nodeWidth: 160` → `170` all left the suite green at
 * 0e6bc36c5c6fa39a7b9a32221f74743b67ff17d5).
 *
 * This is the same fix `CONTRACT_GOLDEN` (`contract-golden.ts`) is for `contract`: a frozen,
 * hand-kept fixture with no relationship to the registry, so `definitions.test.ts` pins these
 * five families' `defaults` by VALUE. A deliberate default change to one of these five updates
 * this file in the same PR; anything else failing here is a real silent drift.
 *
 * Test-only: never imported by shipped code.
 */

import type { ChartDefinitionId } from "../registry";

export type AdoptedHierarchyRelationalId = Extract<
  ChartDefinitionId,
  "TreemapChart" | "TreeChart" | "SankeyChart" | "NetworkChart" | "ParallelCoordinatesChart"
>;

export const DEFAULTS_GOLDEN: Record<
  AdoptedHierarchyRelationalId,
  Readonly<Record<string, unknown>>
> = {
  TreemapChart: {
    depth: 2,
    palette: "mono",
    gap: 2,
    labelMinArea: 1200,
    labelOverflow: "ellipsis",
    otherThreshold: 0,
    drilldown: false,
    showValues: false,
    valueFormat: "compact",
  },
  TreeChart: {
    orientation: "lr",
    nodeSize: 7,
    palette: "mono",
    collapsible: true,
    zoomable: false,
    defaultZoom: 1,
    minimap: false,
    nodeWidth: 160,
    nodeHeight: 72,
    align: "start",
  },
  SankeyChart: {
    animationDuration: 1100,
    nodeWidth: 16,
    nodePadding: 24,
    className: "",
    mode: "aggregate",
  },
  NetworkChart: {
    nodeSize: "value",
    emphasis: "adjacency",
    draggable: false,
    maxNodes: 200,
    valueFormat: "compact",
  },
  ParallelCoordinatesChart: {
    curve: "linear",
    showExtremes: false,
    copyValueOnActivate: false,
  },
};
