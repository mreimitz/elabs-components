import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import { CapabilityBoxNode } from "./capability-box-node";
import { LanePanelNode } from "./lane-panel-node";
import { VisualFlowEdge } from "./visual-flow-edge";
import { VISUAL_BOX_TYPE, VISUAL_FLOW_EDGE_TYPE, VISUAL_LANE_TYPE } from "./visual-node-data";

/** Module-level: React Flow warns when `nodeTypes`/`edgeTypes` is a fresh object every render. */
export const visualNodeTypes = {
  [VISUAL_LANE_TYPE]: LanePanelNode,
  [VISUAL_BOX_TYPE]: CapabilityBoxNode,
} satisfies NodeTypes;

export const visualEdgeTypes = { [VISUAL_FLOW_EDGE_TYPE]: VisualFlowEdge } satisfies EdgeTypes;
