import type { Edge, Node } from "@xyflow/react";

/** Separate dynamic reference ports from ordinary ports such as `left` or `top`. */
export function compositeHandle(
  node: Pick<Node, "type" | "data"> | undefined,
  inner: unknown,
  direction: "in" | "out",
): string | undefined {
  return node?.type === "arch/composite" &&
    typeof inner === "string" &&
    Array.isArray(node.data.ports) &&
    node.data.ports.includes(inner)
    ? `${direction}:inner:${inner}`
    : undefined;
}

/** The generic FlowSpec adapter stays unaware of architecture-specific reference metadata. */
export function connectCompositePorts(nodes: readonly Node[], edges: readonly Edge[]): Edge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => ({
    ...edge,
    sourceHandle:
      compositeHandle(byId.get(edge.source), edge.data?.innerSource, "out") ?? edge.sourceHandle,
    targetHandle:
      compositeHandle(byId.get(edge.target), edge.data?.innerTarget, "in") ?? edge.targetHandle,
  }));
}
