/**
 * @elabs-ai/components-flow — branded React Flow (@xyflow/react) building blocks.
 *
 * Import the React Flow stylesheet once at the app root:
 *   import "@xyflow/react/dist/style.css";
 */
export * from "./canvas-shell";
export * from "./flow-handle";
// The shared contract every node kind builds on: type keys, the base data fields, the
// one tone system, and the card + port primitives a custom node is made from.
export * from "./flow-types";
export * from "./flow-tone";
export * from "./flow-node-card";
export * from "./flow-port";
export * from "./flow-node";
export * from "./flow-edge";
// The shared edge path + keyboard focus indicator every edge type draws through (#286).
export * from "./flow-edge-path";
export * from "./flow-smart-edge";
export * from "./flow-floating-edge";
export * from "./flow-placeholder-node";
export * from "./flow-button-edge";
export * from "./flow-layout";
export * from "./helper-lines";
export * from "./flow-mini-map";
export * from "./inspector-panel";
export * from "./legend";
export * from "./zoom-controls";
export * from "./flow-group-node";
export * from "./use-flow-groups";

// Convenience re-exports so consumers can build flows without a direct dep.
export {
  Background,
  Controls,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
export type { Node, Edge, Connection, NodeProps, EdgeProps } from "@xyflow/react";

// What a CUSTOM node or edge is built from — so a consumer (and a copy-own registry block)
// can write its own node types against this package alone, without a second, direct
// dependency on the engine that could drift from the version this package is built on.
// See the `Flow/Custom Nodes` stories.
export {
  ConnectionMode,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  NodeResizer,
  NodeToolbar,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useUpdateNodeInternals,
} from "@xyflow/react";
export type { EdgeChange, HandleProps, NodeChange, OnSelectionChangeParams } from "@xyflow/react";

// FlowWeightedEdge — RM-043
export * from "./flow-weighted-edge";

// FlowSelfLoopEdge — RM-044
export * from "./flow-self-loop-edge";

// FlowEdgeTokens — RM-065 prerequisite
export * from "./flow-edge-tokens";

// elkjs adapter — RM-067
export {
  layoutFlowElk,
  type FlowElkEngine,
  type FlowElkGraph,
  type FlowLayoutElkOptions,
  type FlowLayoutElkResult,
} from "./flow-layout/layout-flow-elk";
export { pinBackbone, type FlowElkBackbone } from "./flow-layout/backbone";
