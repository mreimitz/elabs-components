import { layoutFlowElk, type Edge, type Node } from "@elabs-ai/components-flow";

/**
 * DG-03: run `layoutFlowElk` over a hard-coded graph, deriving its `groups` option from
 * `parentId` — the same field `FlowGroupNode` already requires on every child
 * (verified-apis.md). A node whose `type` is `"group"` becomes a compound node; any
 * node — including ANOTHER group — whose `parentId` names it becomes one of its
 * children. Nested groups (DG-03's experiment: `aws` ⊃ `vpc` ⊃ `private`) fall out of
 * this for free: `vpc` is both a group (it has its own entry in `groups`) and a child
 * (it appears in `aws`'s `children`), with no special-casing needed here.
 */
export async function runElk(nodes: Node[], edges: Edge[], direction: "LR" | "TB") {
  const groups = nodes
    .filter((n) => n.type === "group")
    .map((g) => ({
      id: g.id,
      children: nodes.filter((n) => n.parentId === g.id).map((n) => n.id),
    }));
  const t0 = performance.now();
  // P4: library gap — `edgeRouting: "orthogonal"` only steers ELK's own internal graph
  // computation; the returned `edges` are the input array unchanged (no bend points),
  // and `FlowEdge` draws a plain bezier regardless. Every edge below still renders as a
  // smooth diagonal. See DG-03-elk-nested.md gap 2.
  const result = await layoutFlowElk(nodes, edges, {
    direction,
    groups,
    edgeRouting: "orthogonal",
  });
  return { ...result, ms: Math.round(performance.now() - t0) };
}
