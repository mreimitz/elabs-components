/**
 * `fromReactFlow(nodes, edges, base)` — review §4.4, the inverse of `toReactFlow` for ids,
 * types, parents, data, ports and (manual layout only) positions. DG-14/15 write the canvas
 * back to YAML through it. React-free: `@xyflow/react` is imported for its TYPES only.
 */
import type { Edge, Node } from "@xyflow/react";
import { FLOW_SPEC_VERSION, type FlowSpec, type FlowSpecEdge, type FlowSpecNode } from "./types";

/**
 * Runtime keys that never go back into the spec: collapse is view state (review §4.4, "Group
 * collapse stays runtime view state"). `collapsed`/`childCount`/`__flowGroupCollapsedState`
 * are written by flow's `collapseGroup`, `sizing` by a manual zone resize (DG-06).
 */
const RUNTIME_DATA_KEYS = new Set([
  "collapsed",
  "childCount",
  "__flowGroupCollapsedState",
  "sizing",
]);

/** flow's `collapseGroup` marks its re-routed stand-in edges with this data key. */
const PROXY_KEY = "__flowGroupProxy";

const portName = (handle: string | null | undefined) =>
  handle ? handle.replace(/^(in|out):/, "") : undefined;

function specData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !RUNTIME_DATA_KEYS.has(key)));
}

export function fromReactFlow(
  nodes: readonly Node[],
  edges: readonly Edge[],
  base: Pick<FlowSpec, "title" | "layout">,
): FlowSpec {
  const manual = base.layout.engine === "none";
  const specNodes: FlowSpecNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? "default",
    data: specData(n.data),
    ...(n.parentId !== undefined ? { parent: n.parentId } : {}),
    ...(manual ? { position: { x: n.position.x, y: n.position.y } } : {}),
  }));
  const specEdges: FlowSpecEdge[] = edges
    .filter((e) => (e.data as Record<string, unknown> | undefined)?.[PROXY_KEY] !== true)
    .map((e) => {
      const sourcePort = portName(e.sourceHandle);
      const targetPort = portName(e.targetHandle);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type ?? "default",
        data: specData((e.data ?? {}) as Record<string, unknown>),
        ...(sourcePort !== undefined ? { sourcePort } : {}),
        ...(targetPort !== undefined ? { targetPort } : {}),
      };
    });
  return {
    flow: FLOW_SPEC_VERSION,
    ...(base.title !== undefined ? { title: base.title } : {}),
    layout: { ...base.layout },
    nodes: specNodes,
    edges: specEdges,
  };
}
