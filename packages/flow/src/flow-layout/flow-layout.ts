import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

/** Direction dagre lays the graph out in — top-to-bottom, left-to-right, etc. */
export type FlowLayoutDirection = "TB" | "LR" | "BT" | "RL";

/**
 * The handle sides an edge should attach to for each layout direction. A
 * directional layout must move the anchors with it: a left-to-right flow exits
 * the source's RIGHT and enters the target's LEFT; top-to-bottom uses
 * bottom/top. `layoutFlow` stamps these onto every node so `FlowNode` renders
 * its default handles on the correct sides (and `FlowEdge` routes accordingly)
 * — otherwise every layout is stuck with top/bottom handles.
 */
export const HANDLE_BY_DIRECTION: Record<
  FlowLayoutDirection,
  { source: Position; target: Position }
> = {
  TB: { source: Position.Bottom, target: Position.Top },
  BT: { source: Position.Top, target: Position.Bottom },
  LR: { source: Position.Right, target: Position.Left },
  RL: { source: Position.Left, target: Position.Right },
};

export interface FlowLayoutOptions {
  /** Layout direction. @default "TB" */
  direction?: FlowLayoutDirection;
  /** Gap between nodes in the same rank (dagre `nodesep`). @default 48 */
  nodeSpacing?: number;
  /** Gap between ranks (dagre `ranksep`). @default 72 */
  rankSpacing?: number;
}

export interface FlowLayoutResult<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  nodes: NodeType[];
  edges: EdgeType[];
}

/** Fallback size used when a node hasn't been measured yet (React Flow's own default node width). */
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 40;

function nodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Pure dagre-powered auto layout. Computes new `position`s for `nodes` given
 * `edges` — no React, no side effects, safe to call anywhere (including
 * outside a component or in a test).
 *
 * Respects each node's **measured** size (`node.measured` — how React Flow
 * v12 reports actual rendered dimensions), falling back to `node.width`/
 * `node.height`, then a sensible default. Node identity and `data` are left
 * untouched — only `position` changes.
 *
 * Pair with `useFlowLayout` to apply the result to a live canvas.
 */
export function layoutFlow<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: FlowLayoutOptions = {},
): FlowLayoutResult<NodeType, EdgeType> {
  const { direction = "TB", nodeSpacing = 48, rankSpacing = 72 } = options;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing });

  for (const node of nodes) {
    const { width, height } = nodeSize(node);
    graph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const handles = HANDLE_BY_DIRECTION[direction];
  const layoutedNodes = nodes.map((node) => {
    const dagreNode = graph.node(node.id);
    const { width, height } = nodeSize(node);
    // dagre positions nodes by their center; React Flow positions by top-left.
    return {
      ...node,
      // Move the anchors with the layout direction so `FlowNode` puts its
      // handles on the sides the edges actually leave/enter.
      sourcePosition: handles.source,
      targetPosition: handles.target,
      position: {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
