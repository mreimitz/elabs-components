/**
 * Zone folds on the canvas. Every fold and unfold goes through `foldZone`, `unfoldZone` or
 * `toggleZone`: the header chevron (ZoneNode), a double-click on a zone header, Collapse all
 * and Expand all (DG-18), and the expand before DG-15's Re-layout. Each runs flow's own group
 * operation, then draws the flows again from which nodes are visible. React-free.
 */
import {
  collapseGroup,
  expandGroup,
  isFlowGroupProxyEdge,
  type Edge,
  type FlowGroupProxyEdgeData,
  type Node,
} from "@elabs-ai/components-flow";
import type { ReactFlowGraph } from "../spec/flow-spec";

/** flow's proxy edge id (group-operations.ts L73 `proxyEdgeId`, not exported). */
const proxyId = (zoneId: string, edgeId: string) => `flow-group-proxy__${zoneId}__${edgeId}`;

function isFolded(node: Node | undefined): boolean {
  return (node?.data as { collapsed?: unknown } | undefined)?.collapsed === true;
}

/** Not drawn: inside a folded zone, or staged until the layout places it (DG-12 `stage`). */
function isHidden(node: Node): boolean {
  return Boolean(node.hidden) || node.style?.visibility === "hidden";
}

/** The folded zones around `id`, outermost first. */
function foldedAround(byId: ReadonlyMap<string, Node>, id: string): string[] {
  const out: string[] = [];
  for (let parent = byId.get(id)?.parentId; parent; parent = byId.get(parent)?.parentId) {
    if (isFolded(byId.get(parent))) out.unshift(parent);
  }
  return out;
}

/** `edge` with `hidden` set, or without the key when shown; the same object when it agrees. */
function withHidden(edge: Edge, hidden: boolean): Edge {
  if (Boolean(edge.hidden) === hidden) return edge;
  if (hidden) return { ...edge, hidden: true };
  const { hidden: _shown, ...rest } = edge;
  return rest;
}

/** flow's proxy for `edge`, one end moved onto the folded zone `zoneId` (L256–264). */
function proxyOf(edge: Edge, zoneId: string, end: "source" | "target"): Edge {
  const data: FlowGroupProxyEdgeData = {
    ...(edge.data ?? {}),
    __flowGroupProxy: true,
    groupId: zoneId,
  };
  return {
    ...edge,
    id: proxyId(zoneId, edge.id),
    source: end === "source" ? zoneId : edge.source,
    target: end === "target" ? zoneId : edge.target,
    sourceHandle: undefined,
    targetHandle: undefined,
    data,
  };
}

/**
 * The edges as the nodes say they should be. A flow is hidden exactly when one of its ends
 * is hidden. A flow with an end inside a folded zone is drawn once, as a proxy from the
 * outermost folded zone around each such end (flow's proxy shape; a flow folded into two
 * zones gets the nested id flow gives it when the source side folds first). No proxy when
 * both ends land on the same zone. An unchanged proxy keeps its object, and with it the
 * route of the last layout.
 */
// P4: library gap — expandGroup is an exact inverse only in last-folded-first order
// (docs/findings/DG-18-interactive-layer.md §8). A flow crossing two folded zones is stashed
// hidden by the second fold (group-operations.ts L250) and its proxy copies `hidden`
// (L256–264); `expandGroup` puts the stash back whole (L334–337), so opening the zones in the
// order they were folded left the flow hidden (ClickHouse "Consume", 9 flows → 8).
function drawFolds(graph: ReactFlowGraph): ReactFlowGraph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const drawnAt = (id: string) => foldedAround(byId, id)[0] ?? id;
  const before = new Map(graph.edges.filter(isFlowGroupProxyEdge).map((edge) => [edge.id, edge]));
  const edges: Edge[] = [];
  const proxies: Edge[] = [];
  for (const edge of graph.edges) {
    if (isFlowGroupProxyEdge(edge)) continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) {
      edges.push(edge);
      continue;
    }
    edges.push(withHidden(edge, isHidden(source) || isHidden(target)));
    const from = drawnAt(edge.source);
    const to = drawnAt(edge.target);
    if (from === to || (from === edge.source && to === edge.target)) continue;
    let proxy = edge;
    if (from !== edge.source) proxy = proxyOf(proxy, from, "source");
    if (to !== edge.target) proxy = proxyOf(proxy, to, "target");
    proxy = withHidden(proxy, isHidden(byId.get(from)!) || isHidden(byId.get(to)!));
    const old = before.get(proxy.id);
    const same =
      old !== undefined &&
      old.source === proxy.source &&
      old.target === proxy.target &&
      Boolean(old.hidden) === Boolean(proxy.hidden);
    proxies.push(same ? old : proxy);
  }
  return { nodes: graph.nodes, edges: [...edges, ...proxies] };
}

/**
 * Runs `op` on `zoneId` with the zones folded around it opened first (outermost first) and
 * folded again after (innermost first), so each of them stores the new state for its own
 * unfold; their chips keep the box they had. The canvas only offers visible zones, where
 * there is nothing around to open.
 */
function withZoneOpen(
  graph: ReactFlowGraph,
  zoneId: string,
  op: (graph: ReactFlowGraph) => ReactFlowGraph,
): ReactFlowGraph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const around = foldedAround(byId, zoneId);
  let next = graph;
  for (const id of around) next = expandGroup(next.nodes, next.edges, id);
  next = op(next);
  for (const id of [...around].reverse()) next = collapseGroup(next.nodes, next.edges, id);
  if (around.length > 0) {
    const chips = new Set(around);
    next = {
      ...next,
      nodes: next.nodes.map((node) => {
        const was = byId.get(node.id);
        return was && chips.has(node.id)
          ? { ...node, position: was.position, width: was.width, height: was.height }
          : node;
      }),
    };
  }
  return drawFolds(next);
}

/** Fold `zoneId` to its chip. */
export function foldZone(graph: ReactFlowGraph, zoneId: string): ReactFlowGraph {
  return withZoneOpen(graph, zoneId, (next) => collapseGroup(next.nodes, next.edges, zoneId));
}

/** Open the folded zone `zoneId`. */
export function unfoldZone(graph: ReactFlowGraph, zoneId: string): ReactFlowGraph {
  return withZoneOpen(graph, zoneId, (next) => expandGroup(next.nodes, next.edges, zoneId));
}

/** Fold `zoneId` when it is open, open it when it is folded. */
export function toggleZone(graph: ReactFlowGraph, zoneId: string): ReactFlowGraph {
  const zone = graph.nodes.find((node) => node.id === zoneId);
  if (!zone) return graph;
  return isFolded(zone) ? unfoldZone(graph, zoneId) : foldZone(graph, zoneId);
}
