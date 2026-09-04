/**
 * NetworkChart (RM-036) — the folder barrel.
 *
 * The public surface is deliberately narrow: the CONTAINER plus the pure layout
 * maths. The marks (`NetworkNode`, `NetworkLink`) and the provider stay internal
 * — `layout` is the public seam, and three more container-shaped exports would
 * be three more ways to build a network chart that does not share its adjacency.
 * Same call RM-025 (treemap) and RM-026 (distribution) made.
 */

export {
  defaultNetworkDatapointLabel,
  NetworkChart,
  type NetworkChartProps,
  type NetworkDatapointDatum,
} from "./network-chart";
export {
  computeAdjacency,
  computeDegrees,
  computeNetworkLayout,
  danglingLinks,
  isLabelVisible,
  isLinkDimmed,
  isNodeDimmed,
  linkWidth,
  NETWORK_DEFAULT_MAX_NODES,
  NETWORK_DEFAULT_NODE_RADIUS,
  NETWORK_MAX_NODE_RADIUS,
  NETWORK_MIN_NODE_RADIUS,
  NETWORK_PADDING,
  networkSummary,
  nodeRadius,
  resolveLabelAnchor,
  resolveLitIds,
  resolveNodeWeight,
  type NetworkLayoutOptions,
  type NetworkLayoutResult,
} from "./network-layout";
export type { NetworkEmphasis } from "./network-context";
export {
  arcLinkPath,
  arcPositions,
  partitionBipartite,
  type ArcLayoutOptions,
} from "./layouts/arc";
export {
  circularLinkPath,
  circularPositions,
  circularRing,
  DEFAULT_CIRCULAR_CURVENESS,
  type CircularLayoutOptions,
} from "./layouts/circular";
export {
  computeForcePositions,
  DEFAULT_FORCE_SEED,
  fitToBox,
  FORCE_ALPHA_MIN,
  FORCE_GRAVITY,
  FORCE_TICK_BUDGET,
  seededRandomSource,
  solveAlphaDecay,
  type ForceLayoutNode,
  type ForceLayoutOptions,
} from "./layouts/force";
export type {
  NetworkLayout,
  NetworkLinkDatum,
  NetworkLinkLayout,
  NetworkNodeDatum,
  NetworkNodeLayout,
  NetworkPoint,
  NetworkSide,
} from "./network-types";
