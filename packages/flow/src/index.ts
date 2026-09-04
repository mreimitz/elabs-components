/**
 * @elabs-ai/components-flow — branded React Flow (@xyflow/react) building blocks.
 *
 * Import the React Flow stylesheet once at the app root:
 *   import "@xyflow/react/dist/style.css";
 */
export * from "./canvas-shell";
export * from "./flow-node";
export * from "./flow-edge";
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

// FlowWeightedEdge — RM-043
export * from "./flow-weighted-edge";
