import type { Edge, Node } from "@xyflow/react";
import type { ZoneOwner } from "../spec/dialect";
import type { LaneRole, VisualBoxMember } from "./visual-model";

/** The visual lens's two node kinds and one edge kind — its own `arch/*`-style registry. */
export const VISUAL_LANE_TYPE = "visual/lane" as const;
export const VISUAL_BOX_TYPE = "visual/box" as const;
export const VISUAL_FLOW_EDGE_TYPE = "visual/flow" as const;

export interface LanePanelData extends Record<string, unknown> {
  title: string;
  role: LaneRole;
}
export type LanePanelNodeType = Node<LanePanelData, typeof VISUAL_LANE_TYPE>;

export interface CapabilityBoxData extends Record<string, unknown> {
  title: string;
  members: VisualBoxMember[];
  aside: boolean;
  owner: ZoneOwner | "unowned";
  /** The box's own lane title, folded into its accessible name — a screen reader has no other
   * way to know which lane a box sits in (lane panels are not tab stops,
   * `visual-canvas-pane.tsx`'s `nodesFocusable={false}`). */
  laneTitle: string;
  processes?: readonly string[];
  sub?: readonly string[];
  provider?: string;
  summary?: boolean;
  boundaryOf?: string;
}
export type CapabilityBoxNodeType = Node<CapabilityBoxData, typeof VISUAL_BOX_TYPE>;

export interface VisualFlowEdgeData extends Record<string, unknown> {
  /** Precomputed at build time (`build-visual-graph.ts`) from the deterministic box rects —
   * the edge never asks React Flow to measure a handle. */
  path: string;
  labelX: number;
  labelY: number;
  labelMaxWidth: number;
  label?: string;
  relationshipDetails?: string;
  process?: string;
  solid: boolean;
  bidirectional: boolean;
}
export type VisualFlowEdgeType = Edge<VisualFlowEdgeData, typeof VISUAL_FLOW_EDGE_TYPE>;
