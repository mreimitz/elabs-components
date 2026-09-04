import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

/** The graphlib graph `dagre.graphlib.Graph` produces — dagre exports no standalone type for it. */
type DagreGraph = InstanceType<typeof dagre.graphlib.Graph>;

/**
 * The fields dagre writes back onto a node label during `layout()`. `rank` is
 * absent from dagre's own `.d.ts` (it is documented output, not declared
 * output), so it is narrowed here rather than asserted at the call site.
 */
interface DagreNodeLabel {
  x: number;
  y: number;
  rank?: number;
}

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
  /**
   * Ids of edges that run **against** the layout direction — a rework / retry
   * loop in a process graph. dagre breaks cycles by reversing such edges
   * internally and never surfaces which ones it reversed, so this is derived
   * from the ranks dagre stamps on the laid-out graph: an edge whose source
   * ranks at or after its target went backwards. Render these with
   * `FlowWeightedEdge`'s `variant="back"`.
   */
  backEdges: string[];
  /**
   * Ids of edges whose `source === target`. dagre does not lay out self-loops,
   * so they are withheld from the graph entirely (never `setEdge`-ed) and are
   * returned unchanged in `edges` — they take part in no rank computation and
   * cannot distort the layout. Render these with `FlowSelfLoopEdge`.
   */
  selfLoops: string[];
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
 * Also reports the graph's two structural signals — `backEdges` (edges that run
 * against the layout direction) and `selfLoops` (`source === target`). Both are
 * additive fields on the result; a caller that only destructures
 * `{ nodes, edges }` is unaffected.
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

  // Self-loops are withheld from dagre entirely: dagre does not lay them out,
  // and feeding them in only perturbs the ranks of a graph they say nothing
  // about. They are re-attached untouched in the returned `edges`.
  const selfLoops: string[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) {
      selfLoops.push(edge.id);
      continue;
    }
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const backEdges = collectBackEdges(graph, edges);

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

  return { nodes: layoutedNodes, edges, backEdges, selfLoops };
}

/**
 * Which edges dagre had to run backwards, derived from the ranks it stamps on
 * the laid-out graph (`graph.node(id).rank`).
 *
 * The obvious alternative — reading `graph.edge(e).reversed` after dagre's
 * `acyclic.run` — is **not usable on the pinned `@dagrejs/dagre` 3.0.0**:
 * cycle breaking happens on an internal copy of the graph, and the caller's
 * graph carries no `reversed` flag once `dagre.layout()` returns (verified
 * against the installed version — every edge label is bare `{ points }`).
 * `rank` *is* on the public graph, and is direction-independent: it counts up
 * along the flow for every `rankdir`, so `rank(source) >= rank(target)` means
 * "this edge does not advance the process" in TB, BT, LR and RL alike.
 *
 * `>=` rather than `>` on purpose: a same-rank edge between two siblings is
 * not forward progress either, and dagre would have had to reverse or flatten
 * it. Self-loops never reach here — they are filtered out before layout.
 * An edge naming a node that isn't in the graph has no ranks to compare and is
 * left out rather than guessed at.
 */
function collectBackEdges(graph: DagreGraph, edges: Edge[]): string[] {
  const backEdges: string[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const sourceRank = (graph.node(edge.source) as DagreNodeLabel | undefined)?.rank;
    const targetRank = (graph.node(edge.target) as DagreNodeLabel | undefined)?.rank;
    if (typeof sourceRank !== "number" || typeof targetRank !== "number") continue;
    if (sourceRank >= targetRank) backEdges.push(edge.id);
  }
  return backEdges;
}
