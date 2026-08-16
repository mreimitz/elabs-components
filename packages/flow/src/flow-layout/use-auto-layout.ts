import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import { layoutGraph, type LayoutOptions } from "./layout-graph";

/**
 * Memoized `layoutGraph` — pure graph-geometry layout (no live canvas access,
 * no side effects). Recomputes only when `nodes`, `edges`, or `options`
 * change; pass stable references (e.g. from `useNodesState`/`useEdgesState`
 * and a memoized `options` object) to avoid recomputing every render.
 *
 * Use this when you want laid-out nodes to render with (e.g. feeding
 * `useNodesState`'s initial value, or a derived/read-only view). To apply a
 * layout to a *live* React Flow instance (read current nodes, set them back,
 * fit the view), call `layoutGraph` directly from an event handler instead —
 * see the `LayoutGraph` story.
 */
export function useAutoLayout<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: LayoutOptions,
): NodeType[] {
  return useMemo(
    () => layoutGraph<NodeType, EdgeType>(nodes, edges, options),
    [nodes, edges, options],
  );
}
