import { useCallback, useRef, useState } from "react";
import { useNodesInitialized, useReactFlow, type Edge, type Node } from "@xyflow/react";
import { layoutFlow, type FlowLayoutDirection, type FlowLayoutOptions } from "./flow-layout";

export interface UseFlowLayoutResult {
  /**
   * Auto-lay-out the current nodes/edges with dagre and fit the view. Safe to
   * call repeatedly (e.g. from a toolbar button on every click). No-ops until
   * React Flow has measured every node.
   */
  layout: (direction?: FlowLayoutDirection, options?: Omit<FlowLayoutOptions, "direction">) => void;
  /** Whether nodes are measured and ready to be laid out. */
  ready: boolean;
  /** Whether a layout pass is currently running (true only for the duration of `layout()`). */
  layouting: boolean;
}

/**
 * Hook form of `layoutFlow`. Reads the live nodes/edges from `useReactFlow()`,
 * waits for `useNodesInitialized()` so real (measured) node sizes are used —
 * never lays out against 0×0 unmeasured nodes — applies the computed
 * positions via `setNodes`, then calls `fitView()`.
 *
 * Must be called from a component rendered inside a `<CanvasShell>` /
 * `<ReactFlow>` (React Flow context).
 */
export function useFlowLayout<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): UseFlowLayoutResult {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow<NodeType, EdgeType>();
  const nodesInitialized = useNodesInitialized();
  const [layouting, setLayouting] = useState(false);
  // Avoid overlapping layout passes if `layout()` is invoked in quick succession.
  const runningRef = useRef(false);

  const layout = useCallback(
    (direction?: FlowLayoutDirection, options?: Omit<FlowLayoutOptions, "direction">) => {
      if (!nodesInitialized || runningRef.current) return;

      runningRef.current = true;
      setLayouting(true);
      try {
        const { nodes: layoutedNodes } = layoutFlow<NodeType, EdgeType>(getNodes(), getEdges(), {
          ...options,
          direction,
        });
        setNodes(layoutedNodes);
        // Defer fitView one frame so React Flow has committed the new positions first.
        requestAnimationFrame(() => fitView());
      } finally {
        runningRef.current = false;
        setLayouting(false);
      }
    },
    [nodesInitialized, getNodes, getEdges, setNodes, fitView],
  );

  return { layout, ready: nodesInitialized, layouting };
}
