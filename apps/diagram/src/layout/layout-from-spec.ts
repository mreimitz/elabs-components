import { collapseGroup, type Edge, type Node } from "@elabs-ai/components-flow";
import {
  FLOW_EDGE_TYPE_KEY,
  type DataFlowEdgeData,
  type DataFlowEdgeRoute,
} from "../edges/data-flow-edge-data";
import { measureLabelCluster } from "../edges/edge-label-size";
import { isZoneNode } from "../nodes/zone-data";
import { fitZones } from "../nodes/use-zone-autofit";
import { ARCH_DEFINITIONS } from "../spec/compile/arch-definitions";
import { pickPort } from "../spec/flow-spec";
import { noteLayoutEdges, placeNotesBeside } from "./place-notes";
import { runElk, type DiagramDirection, type ElkRouting, type HandleSide } from "./run-elk";
import { showsOwner, zoneHeaderMinWidth } from "./zone-header-width";

export interface DiagramLayoutOptions {
  direction: DiagramDirection;
  /** Note id → the node or zone it annotates (DG-10 `view.noteAnchors`). */
  noteAnchors: Readonly<Record<string, string>>;
}

export interface DiagramLayoutResult {
  nodes: Node[];
  edges: Edge[];
  /** `"dagre"`: ELK failed and flow fell back — treat as a failed layout. `"none"`: manual. */
  engine: "elk" | "dagre" | "none";
  ms: number;
}

const depthOf = (node: Node, byId: ReadonlyMap<string, Node>): number => {
  let depth = 0;
  for (let p = node.parentId; p !== undefined; p = byId.get(p)?.parentId) depth += 1;
  return depth;
};

/** Zone id → its own `direction:`. */
function zoneDirections(nodes: readonly Node[]): Map<string, DiagramDirection> {
  const out = new Map<string, DiagramDirection>();
  for (const node of nodes) {
    if (isZoneNode(node) && node.data.direction) out.set(node.id, node.data.direction);
  }
  return out;
}

/**
 * Handles follow the direction of the innermost zone that holds both ends: an edge inside
 * a `direction: TB` zone leaves from the bottom port and enters on top, when both node
 * types have those ports (DG-10 `pickPort`). Group proxy edges (no handles) stay as they are.
 */
export function followZoneDirection(
  nodes: readonly Node[],
  edges: Edge[],
  root: DiagramDirection,
): Edge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const own = zoneDirections(nodes);
  const chain = (id: string): string[] => {
    const out: string[] = [];
    for (let p = byId.get(id)?.parentId; p !== undefined; p = byId.get(p)?.parentId) out.push(p);
    return out;
  };
  return edges.map((edge) => {
    if (edge.sourceHandle == null || edge.targetHandle == null) return edge;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source?.type || !target?.type) return edge;
    const targetChain = new Set(chain(edge.target));
    const common = chain(edge.source).filter((zone) => targetChain.has(zone));
    const direction = common.map((zone) => own.get(zone)).find((d) => d !== undefined) ?? root;
    const out = pickPort(ARCH_DEFINITIONS.get(source.type), "output", direction);
    const inn = pickPort(ARCH_DEFINITIONS.get(target.type), "input", direction);
    if (out === undefined || inn === undefined) return edge;
    const sourceHandle = `out:${out}`;
    const targetHandle = `in:${inn}`;
    return sourceHandle === edge.sourceHandle && targetHandle === edge.targetHandle
      ? edge
      : { ...edge, sourceHandle, targetHandle };
  });
}

/**
 * The side of `node` a handle sits on, from the arch definitions (the same table `pickPort`
 * reads). No handle id (a collapse proxy edge) → the first port of that direction, which is
 * the handle React Flow falls back to (each node renders its ports in definition order).
 */
function handleSide(
  node: Node | undefined,
  handle: string | null | undefined,
  want: "input" | "output",
): HandleSide | undefined {
  const ports = Object.entries(ARCH_DEFINITIONS.get(node?.type ?? "")?.targets ?? {}).filter(
    ([, port]) => port.direction === want,
  );
  const key = handle?.slice(handle.indexOf(":") + 1);
  return (handle == null ? ports[0] : ports.find(([name]) => name === key))?.[1].side;
}

/**
 * Wave-2 review M2: ELK's labels and ports for the visible edges, with the handles they
 * will be drawn with (`followZoneDirection` runs here, before the layout, so a port and its
 * rendered handle agree). A zone end that floats on the border (`data.floating`) gets no
 * port: ELK attaches it to the border and `DataFlowEdge` accepts any border point.
 */
function edgeRouting(
  shown: readonly Node[],
  edges: readonly Edge[],
  direction: DiagramDirection,
): Pick<ElkRouting, "labels" | "handles"> {
  const byId = new Map(shown.map((node) => [node.id, node]));
  const labels = new Map<string, { width: number; height: number }>();
  const handles = new Map<string, { source?: HandleSide; target?: HandleSide }>();
  for (const edge of followZoneDirection(shown, [...edges], direction)) {
    if (edge.type !== FLOW_EDGE_TYPE_KEY) continue;
    const data = (edge.data ?? {}) as DataFlowEdgeData;
    const size = measureLabelCluster(data);
    if (size) labels.set(edge.id, size);
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const floats = (node: Node | undefined) =>
      Boolean(data.floating) && node !== undefined && isZoneNode(node);
    handles.set(edge.id, {
      source: floats(source) ? undefined : handleSide(source, edge.sourceHandle, "output"),
      target: floats(target) ? undefined : handleSide(target, edge.targetHandle, "input"),
    });
  }
  return { labels, handles };
}

/**
 * Each edge with ELK's route in `data.route`, or without one when ELK did not route it
 * (hidden, lifted to a separate zone, manual layout) — a route from an older layout would
 * not match the new boxes.
 */
function withRoutes(edges: Edge[], routes: ReadonlyMap<string, DataFlowEdgeRoute>): Edge[] {
  return edges.map((edge) => {
    const route = routes.get(edge.id);
    if (route) return { ...edge, data: { ...edge.data, route } };
    if (!edge.data || !("route" in edge.data)) return edge;
    const { route: _stale, ...data } = edge.data;
    return { ...edge, data };
  });
}

/**
 * One ELK pass over what is VISIBLE: hidden nodes and edges are left out, a collapsed zone
 * is a leaf (its `width`/`height` from `collapseGroup`, 220×48, widened to its header's
 * minimum — wave-2 review M5; `measured` still holds the expanded size until React Flow
 * re-measures), a zone is a group only while it has a visible child (at least as wide as its
 * header), and each note is tied to its anchor by a layout-only edge.
 */
async function layoutVisible(
  nodes: Node[],
  edges: Edge[],
  options: DiagramLayoutOptions,
): Promise<{
  nodes: Node[];
  engine: "elk" | "dagre";
  ms: number;
  routes: ReadonlyMap<string, DataFlowEdgeRoute>;
}> {
  const shown = nodes.filter((node) => !node.hidden);
  const visible = new Set(shown.map((node) => node.id));
  const shownById = new Map(shown.map((node) => [node.id, node]));
  const chipWidth = new Map<string, number>();
  const leaves = shown.map((node) => {
    if (!isZoneNode(node) || !node.data.collapsed || !node.width || !node.height) return node;
    const header = zoneHeaderMinWidth({
      data: node.data,
      showOwner: showsOwner(node, shownById),
      collapsed: true,
      count: nodes.filter((child) => child.parentId === node.id).length,
    });
    const width = Math.max(node.width, header);
    chipWidth.set(node.id, width);
    return { ...node, width, measured: { width, height: node.height } };
  });
  const children = new Map<string, string[]>();
  for (const node of shown) {
    if (node.parentId === undefined || !visible.has(node.parentId)) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }
  const groups = shown
    .filter((node) => isZoneNode(node) && !node.data.collapsed && children.has(node.id))
    .map((zone) => ({ id: zone.id, children: children.get(zone.id) ?? [] }));
  const shownEdges = edges.filter(
    (edge) => !edge.hidden && visible.has(edge.source) && visible.has(edge.target),
  );
  const layoutEdges = [...shownEdges, ...noteLayoutEdges(options.noteAnchors, visible)];
  const zoneMinWidth = new Map(
    groups.map(({ id }) => {
      const zone = shownById.get(id)!;
      const data = isZoneNode(zone) ? zone.data : undefined;
      const width = data
        ? zoneHeaderMinWidth({ data, showOwner: showsOwner(zone, shownById), collapsed: false })
        : 0;
      return [id, width] as const;
    }),
  );

  const result = await runElk(leaves, layoutEdges, {
    direction: options.direction,
    zoneDirection: zoneDirections(shown),
    groups,
    routing: { ...edgeRouting(shown, shownEdges, options.direction), zoneMinWidth },
  });
  const groupIds = new Set(groups.map((group) => group.id));
  const placed = new Map(result.nodes.map((node) => [node.id, node]));
  return {
    engine: result.engine,
    ms: result.ms,
    routes: result.routes,
    // Only position (and a group's size) is taken from ELK. Its `extent: "parent"`
    // (layout-flow-elk.ts:359) would clamp a drag at the zone edge, which DG-06's
    // auto-fit needs to cross, and its per-direction `source/targetPosition` is unused.
    nodes: nodes.map((node) => {
      const laid = placed.get(node.id);
      if (!laid) return node;
      return groupIds.has(node.id) && laid.width !== undefined && laid.height !== undefined
        ? {
            ...node,
            position: laid.position,
            width: laid.width,
            height: laid.height,
          }
        : chipWidth.has(node.id)
          ? { ...node, position: laid.position, width: chipWidth.get(node.id) }
          : { ...node, position: laid.position };
    }),
  };
}

/**
 * Full auto layout (plan D6). Pass 1 lays out everything expanded, so `collapseGroup`
 * snapshots real positions for a later expand; then every zone in `collapse` is folded,
 * deepest first; pass 2 lays out only what is visible, so parents shrink round the chips.
 * `nodes` must be measured (React Flow's `getNodes()` once `useNodesInitialized()`).
 */
export async function layoutDiagram(
  nodes: Node[],
  edges: Edge[],
  options: DiagramLayoutOptions & { collapse: readonly string[] },
): Promise<DiagramLayoutResult> {
  const first = await layoutVisible(nodes, edges, options);
  if (first.engine === "dagre") return { ...first, edges: withRoutes(edges, new Map()) };
  const byId = new Map(first.nodes.map((node) => [node.id, node]));
  const fold = options.collapse
    .map((id) => byId.get(id))
    .filter((node): node is Node => node !== undefined && isZoneNode(node))
    .sort((a, b) => depthOf(b, byId) - depthOf(a, byId));
  let graph = { nodes: first.nodes, edges };
  for (const zone of fold) graph = collapseGroup(graph.nodes, graph.edges, zone.id);
  if (fold.length === 0) {
    return {
      nodes: first.nodes,
      engine: first.engine,
      ms: first.ms,
      edges: withRoutes(followZoneDirection(first.nodes, edges, options.direction), first.routes),
    };
  }
  const second = await layoutVisible(graph.nodes, graph.edges, options);
  return {
    nodes: second.nodes,
    edges: withRoutes(
      followZoneDirection(second.nodes, graph.edges, options.direction),
      second.routes,
    ),
    engine: second.engine,
    ms: first.ms + second.ms,
  };
}

/** After a zone was collapsed or expanded on the canvas: pass 2 only, over what is visible. */
export async function relayoutVisible(
  nodes: Node[],
  edges: Edge[],
  options: DiagramLayoutOptions,
): Promise<DiagramLayoutResult> {
  const result = await layoutVisible(nodes, edges, options);
  return {
    nodes: result.nodes,
    engine: result.engine,
    ms: result.ms,
    edges: withRoutes(followZoneDirection(result.nodes, edges, options.direction), result.routes),
  };
}

/**
 * `layout: manual`: positions are the text's (DG-10), relative to the parent. Notes move
 * beside their anchors, zones wrap their children (DG-06 `fitZones`), then the text's
 * collapsed zones fold. No ELK.
 */
export function layoutManual(
  nodes: Node[],
  edges: Edge[],
  options: DiagramLayoutOptions & { collapse: readonly string[] },
): DiagramLayoutResult {
  const t0 = performance.now();
  const placed = fitZones(placeNotesBeside(nodes, options.noteAnchors));
  const byId = new Map(placed.map((node) => [node.id, node]));
  let graph = { nodes: placed, edges };
  const fold = options.collapse
    .map((id) => byId.get(id))
    .filter((node): node is Node => node !== undefined && isZoneNode(node))
    .sort((a, b) => depthOf(b, byId) - depthOf(a, byId));
  for (const zone of fold) graph = collapseGroup(graph.nodes, graph.edges, zone.id);
  return {
    nodes: graph.nodes,
    edges: withRoutes(followZoneDirection(graph.nodes, graph.edges, options.direction), new Map()),
    engine: "none",
    ms: Math.round(performance.now() - t0),
  };
}
