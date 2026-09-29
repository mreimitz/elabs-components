import type { Edge, Node } from "@elabs-ai/components-flow";
import type { DataFlowEdgeRoute } from "../edges/data-flow-edge-data";
import type { DiagramLayoutResult } from "./layout-from-spec";
import type { DiagramDirection } from "./run-elk";
import { ZONE_PADDING } from "../nodes/zone-data";
import { disclosureRouteIsClear, routeDisclosureEdge } from "./disclosure-routing";

type Layout = Pick<DiagramLayoutResult, "nodes" | "edges">;
const GAP = 160;
const size = (node: Node) => ({
  width: node.width ?? node.measured?.width ?? 0,
  height: node.height ?? node.measured?.height ?? 0,
});
const box = (node: Node) => ({ ...node.position, ...size(node) });
const overlaps = (a: Node, b: Node) => {
  const aa = box(a),
    bb = box(b);
  return (
    aa.x < bb.x + bb.width &&
    aa.x + aa.width > bb.x &&
    aa.y < bb.y + bb.height &&
    aa.y + aa.height > bb.y
  );
};
function absolute(node: Node, byId: ReadonlyMap<string, Node>) {
  const point = { ...node.position };
  for (
    let parent = byId.get(node.parentId ?? "");
    parent;
    parent = byId.get(parent.parentId ?? "")
  ) {
    point.x += parent.position.x;
    point.y += parent.position.y;
  }
  return point;
}

/**
 * Inline disclosure preserves the reader's spatial map. ELK supplies only the changed
 * component's interior; surrounding branches stay put unless its growing box needs room.
 * Ancestors grow toward the bottom/right, so the clicked component never jumps upward.
 */
export function anchorComponentLayout<T extends Layout>(
  before: Layout,
  after: T,
  componentId: string,
  direction: DiagramDirection,
): T {
  const old = new Map(before.nodes.map((node) => [node.id, node]));
  const fresh = new Map(after.nodes.map((node) => [node.id, node]));
  if (!old.has(componentId) || !fresh.has(componentId)) return after;
  const inside = (node: Node) => {
    for (let parent = node.parentId; parent; parent = fresh.get(parent)?.parentId) {
      if (parent === componentId) return true;
    }
    return false;
  };
  const nodes = after.nodes.map((node) => {
    const previous = old.get(node.id);
    if (!previous || inside(node)) return { ...node, position: { ...node.position } };
    const dimensions = node.id === componentId ? size(node) : size(previous);
    return {
      ...node,
      position: { ...previous.position },
      ...dimensions,
      measured: { ...node.measured, ...dimensions },
      style: {
        ...node.style,
        ...(node.style?.width !== undefined ? { width: dimensions.width } : {}),
        ...(node.style?.height !== undefined ? { height: dimensions.height } : {}),
      },
    };
  });
  const current = new Map(nodes.map((node) => [node.id, node]));
  let branch = current.get(componentId)!;
  // Resolve one sibling level at a time, then enlarge its parent to contain it.
  while (true) {
    const siblings = nodes
      .filter((node) => node.parentId === branch.parentId && !node.hidden)
      .sort((a, b) => {
        const aa = old.get(a.id)?.position ?? a.position;
        const bb = old.get(b.id)?.position ?? b.position;
        return direction === "LR"
          ? aa.x - bb.x || aa.y - bb.y || a.id.localeCompare(b.id)
          : aa.y - bb.y || aa.x - bb.x || a.id.localeCompare(b.id);
      });
    const queue = [branch];
    const protectedId = branch.id;
    const queued = new Set([branch.id]);
    // Every push is monotonic. The cap protects malformed/overlapping input layouts.
    let budget = siblings.length * siblings.length + 1;
    while (queue.length && budget-- > 0) {
      const changed = queue.shift()!;
      queued.delete(changed.id);
      for (const neighbor of siblings) {
        if (
          neighbor.id === changed.id ||
          neighbor.id === protectedId ||
          !overlaps(
            { ...changed, width: size(changed).width + GAP, height: size(changed).height },
            neighbor,
          )
        )
          continue;
        const originalA = old.get(changed.id),
          originalB = old.get(neighbor.id);
        // Existing intentional overlap (for example, a note) is outside disclosure's remit.
        if (originalA && originalB && overlaps(originalA, originalB)) continue;
        const a = box(changed);
        const original = originalA && originalB ? { a: box(originalA), b: box(originalB) } : null;
        const wasBelow = original && original.b.y >= original.a.y + original.a.height;
        const wasRight = original && original.b.x >= original.a.x + original.a.width;
        const moveDown = (wasBelow && !wasRight) || (!wasRight && direction === "TB");
        if (moveDown) neighbor.position.y = a.y + a.height + GAP;
        else neighbor.position.x = a.x + a.width + GAP;
        if (!queued.has(neighbor.id)) {
          queue.push(neighbor);
          queued.add(neighbor.id);
        }
      }
    }
    const parent = current.get(branch.parentId ?? "");
    if (!parent) break;
    const dimensions = size(parent);
    for (const child of siblings) {
      const bounds = box(child);
      dimensions.width = Math.max(dimensions.width, bounds.x + bounds.width + ZONE_PADDING);
      dimensions.height = Math.max(dimensions.height, bounds.y + bounds.height + ZONE_PADDING);
    }
    parent.width = dimensions.width;
    parent.height = dimensions.height;
    parent.measured = { ...parent.measured, ...dimensions };
    parent.style = {
      ...parent.style,
      ...(parent.style?.width !== undefined ? { width: dimensions.width } : {}),
      ...(parent.style?.height !== undefined ? { height: dimensions.height } : {}),
    };
    branch = parent;
  }
  const oldEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  const translatedRoute = (
    edge: Edge,
    previous: Edge | undefined,
    from: ReadonlyMap<string, Node>,
  ) => {
    if (
      !previous ||
      previous.source !== edge.source ||
      previous.target !== edge.target ||
      previous.sourceHandle !== edge.sourceHandle ||
      previous.targetHandle !== edge.targetHandle
    )
      return undefined;
    const route = previous.data?.route as DataFlowEdgeRoute | undefined;
    if (!route) return undefined;
    const deltas = [edge.source, edge.target].map((id) => {
      const a = from.get(id),
        b = current.get(id);
      if (!a || !b || size(a).width !== size(b).width || size(a).height !== size(b).height)
        return null;
      const start = absolute(a, from),
        end = absolute(b, current);
      return { x: end.x - start.x, y: end.y - start.y };
    });
    const [source, target] = deltas;
    if (!source || !target || source.x !== target.x || source.y !== target.y) return undefined;
    return {
      ...route,
      points: route.points.map((point) => ({ x: point.x + source.x, y: point.y + source.y })),
      ...(route.label
        ? { label: { ...route.label, x: route.label.x + source.x, y: route.label.y + source.y } }
        : {}),
    };
  };
  const labels: { x: number; y: number; width: number; height: number }[] = [];
  const preserved = new Map<string, DataFlowEdgeRoute>();
  // Reserve all accepted existing captions before placing any newly routed captions,
  // independent of the source document's edge order.
  for (const edge of after.edges) {
    const candidates = [
      translatedRoute(edge, oldEdges.get(edge.id), old),
      translatedRoute(edge, edge, fresh),
    ];
    const route = candidates.find(
      (candidate) => candidate && disclosureRouteIsClear(edge, candidate, current, labels),
    );
    if (!route) continue;
    preserved.set(edge.id, route);
    if (route.label)
      labels.push({
        ...route.label,
        x: route.label.x - 8,
        y: route.label.y - 8,
        width: route.label.width + 16,
        height: route.label.height + 16,
      });
  }
  const edges = after.edges.map((edge) => {
    // A growing component can obstruct even an edge whose endpoints did not move.
    const route = preserved.get(edge.id) ?? routeDisclosureEdge(edge, fresh, current, labels);
    const { route: _route, ...data } = edge.data ?? {};
    return { ...edge, data: route ? { ...data, route } : data };
  });
  return { ...after, nodes, edges };
}
