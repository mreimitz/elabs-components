import {
  layoutFlowElk,
  type Edge,
  type FlowElkEngine,
  type FlowElkGraph,
  type FlowLayoutElkResult,
  type Node,
} from "@elabs-ai/components-flow";
import type { DataFlowEdgeRoute } from "../edges/data-flow-edge-data";
import { ZONE_MIN_HEIGHT } from "../nodes/zone-data";

export type DiagramDirection = "LR" | "TB";

const ELK_DIRECTION: Record<DiagramDirection, string> = {
  LR: "RIGHT",
  TB: "DOWN",
};

type ElkEdge = NonNullable<FlowElkGraph["edges"]>[number];

/** The side of a node a handle sits on (the arch definitions' `FlowPortDefinition.side`). */
export type HandleSide = "left" | "right" | "top" | "bottom";

interface Size {
  width: number;
  height: number;
}

/**
 * Wave-2 review M2/M5 — what ELK needs besides boxes, so its routes and label positions are
 * usable as drawn:
 *
 * - `labels`: edge id → its label cluster's size (`measureLabelCluster`). ELK reserves room
 *   for it and places it ON the edge (`edgeLabels.inline`), clear of nodes and other labels.
 * - `handles`: edge id → the side each LEAF end leaves/enters by (its rendered handle). ELK
 *   gets a port there (`FIXED_POS`, the handle's own point: the middle of that side), so a
 *   route starts and ends where React Flow draws the handle. A zone end with a visible child
 *   (an ELK compound node) gets no port: ELK attaches the edge to the zone's border.
 * - `zoneMinWidth`: zone id → its header's minimum width (`zoneHeaderMinWidth`), for zones
 *   ELK sizes from their children (`elk.nodeSize.constraints: [MINIMUM_SIZE]`).
 *
 * P4: library gap — `layoutFlowElk` takes no edge label sizes, ports or group minimum sizes
 * and returns the input edges (no `sections`, no label positions); DG-11-layout.md,
 * "Wave-2 review additions".
 */
export interface ElkRouting {
  labels: ReadonlyMap<string, Size>;
  handles: ReadonlyMap<string, { source?: HandleSide; target?: HandleSide }>;
  zoneMinWidth: ReadonlyMap<string, number>;
}

/** The ELK JSON parts `FlowElkGraph` does not type: ports, edge labels and sections. */
interface ElkPort {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
}
interface ElkLabel {
  id: string;
  text: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
}
interface ElkSection {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: { x: number; y: number }[];
  incomingSections?: string[];
  outgoingSections?: string[];
}
type ElkRoutedEdge = ElkEdge & { labels?: ElkLabel[]; sections?: ElkSection[] };
type ElkRoutedNode = Omit<FlowElkGraph, "children" | "edges"> & {
  ports?: ElkPort[];
  children?: ElkRoutedNode[];
  edges?: ElkRoutedEdge[];
};

/** Edge id → the separate zone each lifted end was re-targeted to. */
type Lifted = Map<string, { source?: string; target?: string }>;

const ELK_SIDE: Record<HandleSide, string> = {
  left: "WEST",
  right: "EAST",
  top: "NORTH",
  bottom: "SOUTH",
};

/** A handle's point on a `width`×`height` box: the middle of its side (React Flow's default). */
function portPoint(side: HandleSide, width: number, height: number) {
  switch (side) {
    case "left":
      return { x: 0, y: height / 2 };
    case "right":
      return { x: width, y: height / 2 };
    case "top":
      return { x: width / 2, y: 0 };
    case "bottom":
      return { x: width / 2, y: height };
  }
}

/**
 * Adds `routing` to a decorated graph (see `ElkRouting`): edge labels, fixed-position ports
 * on leaf ends, header minimum sizes on zones, and ROOT edge coordinates — elkjs 0.12 reads
 * `org.eclipse.elk.json.edgeCoords` per element, inherited from the JSON parent
 * (elk-worker.js:77392-77401; ROOT = `EdgeCoords.ROOT`, :68870), so every route point and
 * label position comes back in the root's coordinates, which are React Flow's absolute
 * ones. Node coordinates stay parent-relative (`shapeCoords` untouched) — `layoutFlowElk`
 * reads them that way. A `lifted` end (re-targeted to a separate zone) gets no port: ELK
 * routes it to that zone's border, and the edge joins the rest (`route.via`).
 */
function attachRouting(graph: FlowElkGraph, routing: ElkRouting, lifted: Lifted) {
  const root = graph as ElkRoutedNode;
  root.layoutOptions = { ...root.layoutOptions, "org.eclipse.elk.json.edgeCoords": "ROOT" };
  const byId = new Map<string, ElkRoutedNode>();
  const walk = (node: ElkRoutedNode) => {
    for (const child of node.children ?? []) {
      byId.set(child.id, child);
      walk(child);
    }
  };
  walk(root);

  for (const [id, width] of routing.zoneMinWidth) {
    const zone = byId.get(id);
    if (!zone?.children?.length) continue;
    zone.layoutOptions = {
      ...zone.layoutOptions,
      "elk.nodeSize.constraints": "[MINIMUM_SIZE]",
      "elk.nodeSize.minimum": `(${width}, ${ZONE_MIN_HEIGHT})`,
    };
  }

  const portOf = (nodeId: string, side: HandleSide, kind: "in" | "out"): string | undefined => {
    const node = byId.get(nodeId);
    if (!node || node.children?.length || !node.width || !node.height) return undefined;
    const id = `${nodeId}::${kind}:${side}`;
    const ports = (node.ports ??= []);
    if (!ports.some((port) => port.id === id)) {
      ports.push({
        id,
        ...portPoint(side, node.width, node.height),
        width: 0,
        height: 0,
        layoutOptions: { "elk.port.side": ELK_SIDE[side] },
      });
    }
    node.layoutOptions = { ...node.layoutOptions, "elk.portConstraints": "FIXED_POS" };
    return id;
  };

  for (const edge of (root.edges ?? []) as ElkRoutedEdge[]) {
    const via = lifted.get(edge.id);
    const label = routing.labels.get(edge.id);
    if (label) {
      edge.labels = [
        {
          id: `${edge.id}::label`,
          // elkjs 0.12 lays out no label without `text`: it stays at (0, 0) and gets no
          // room (verified in isolation; the JSON importer builds it from `text`,
          // elk-worker.js:77222). The words themselves do not matter — the size does.
          text: edge.id,
          width: label.width,
          height: label.height,
          layoutOptions: {
            "elk.edgeLabels.placement": "CENTER",
            "elk.edgeLabels.inline": "true",
          },
        },
      ];
    }
    const sides = routing.handles.get(edge.id);
    const source = edge.sources[0];
    const target = edge.targets[0];
    const sourcePort =
      sides?.source && source && !via?.source ? portOf(source, sides.source, "out") : undefined;
    const targetPort =
      sides?.target && target && !via?.target ? portOf(target, sides.target, "in") : undefined;
    if (sourcePort) edge.sources = [sourcePort];
    if (targetPort) edge.targets = [targetPort];
  }
}

/** A section chain's points, start to end (one section in the usual case). */
function sectionPoints(sections: readonly ElkSection[]) {
  const byId = new Map(sections.map((section) => [section.id, section]));
  let section = sections.find((s) => !s.incomingSections?.length) ?? sections[0];
  const points: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  while (section && !seen.has(section.id)) {
    seen.add(section.id);
    for (const point of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]) {
      const last = points[points.length - 1];
      if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) {
        points.push({ x: point.x, y: point.y });
      }
    }
    const next = section.outgoingSections?.[0];
    section = next === undefined ? undefined : byId.get(next);
  }
  return points;
}

/** Every routed edge in ELK's result → its route (points and label box, root coordinates). */
function collectRoutes(laidOut: ElkRoutedNode, lifted: Lifted) {
  const routes = new Map<string, DataFlowEdgeRoute>();
  const walk = (node: ElkRoutedNode) => {
    for (const edge of node.edges ?? []) {
      if (!edge.sections?.length) continue;
      const via = lifted.get(edge.id);
      const points = sectionPoints(edge.sections);
      if (points.length < 2) continue;
      const label = edge.labels?.[0];
      routes.set(edge.id, {
        points,
        ...(label && label.x !== undefined && label.y !== undefined
          ? { label: { x: label.x, y: label.y, width: label.width, height: label.height } }
          : {}),
        ...(via ? { via } : {}),
      });
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(laidOut);
  return routes;
}

/**
 * DG-13: break only real cycles. `layoutFlowElk` sets `MODEL_ORDER`, which reverses EVERY
 * edge whose target comes earlier in the input (elkjs 0.12 `ModelOrderCycleBreaker`), cycle
 * or not. The compiler emits zones before top-level `nodes:`, so an outside source (users,
 * a SaaS feed) was always laid out after the zone it feeds. `GREEDY_MODEL_ORDER` reverses
 * only what a cycle needs, still preferring the input order when it has to choose.
 *
 * P4: library gap — `layoutFlowElk` hard-codes the cycle-breaking strategy
 * (layout-flow-elk.ts:194); proposed: a `cycleBreaking` option.
 */
const CYCLE_BREAKING = { "elk.layered.cycleBreaking.strategy": "GREEDY_MODEL_ORDER" } as const;

/**
 * The gap between two layers, per direction. Wave-2 review M2: ELK now places every edge
 * label itself — a label is a node of its own layer between the two it joins, and ELK keeps
 * this gap on BOTH sides of it (`nodeNodeBetweenLayers` applies to label dummies too) — so
 * the gap no longer has to hold a label (DG-13 had widened it to 120 px in LR for that).
 * Two node layers with labels between them sit `2 × gap + label` apart.
 */
const RANK_SPACING: Record<DiagramDirection, number> = { LR: 32, TB: 24 };

/** flow's `layoutFlowElk` default `nodeSpacing` (layout-flow-elk.ts:155). */
const NODE_SPACING = 48;

/**
 * Per-zone `direction:` for ELK. Under the root's `INCLUDE_CHILDREN` a zone's own
 * `elk.direction` is ignored, so a zone whose direction differs from its parent's is laid
 * out on its own (`SEPARATE_CHILDREN`); ELK then rejects any edge that crosses its border
 * (`UnsupportedGraphException`), so such an edge is lifted to the outermost separate zone
 * that does not also hold the other end. Edges between a zone and its own descendant are
 * dropped (nothing to lay out). Only the graph ELK sees changes — the rendered edges are
 * untouched.
 *
 * P4: library gap — `layoutFlowElk` takes one `direction` for the whole graph and no
 * per-group layout options (proposed: `groups[].layoutOptions` or a `decorateGraph` hook).
 */
export function decorateElkGraph(
  graph: FlowElkGraph,
  zoneDirection: ReadonlyMap<string, DiagramDirection>,
  rootDirection: DiagramDirection,
  routing?: ElkRouting,
  /** Filled with the edges re-targeted to a separate zone: edge id → the zone per end. */
  lifted: Map<string, { source?: string; target?: string }> = new Map(),
): FlowElkGraph {
  const parentOf = new Map<string, string>();
  const containers: FlowElkGraph[] = [];
  const walk = (node: FlowElkGraph, parent: string | undefined) => {
    if (parent !== undefined) parentOf.set(node.id, parent);
    if (node.children && node.children.length > 0) containers.push(node);
    for (const child of node.children ?? []) walk(child, node.id);
  };
  for (const child of graph.children ?? []) walk(child, undefined);

  const ancestors = (id: string): string[] => {
    const out: string[] = [];
    for (let p = parentOf.get(id); p !== undefined; p = parentOf.get(p)) out.push(p);
    return out;
  };
  const effective = (id: string | undefined): DiagramDirection => {
    if (id === undefined) return rootDirection;
    for (const zone of [id, ...ancestors(id)]) {
      const direction = zoneDirection.get(zone);
      if (direction) return direction;
    }
    return rootDirection;
  };

  graph.layoutOptions = { ...graph.layoutOptions, ...CYCLE_BREAKING };

  // `containers` is in pre-order, so a parent is decided before its children.
  const separate = new Set<string>();
  for (const zone of containers) {
    const direction = effective(zone.id);
    const options: Record<string, string> = {
      ...zone.layoutOptions,
      "elk.direction": ELK_DIRECTION[direction],
      // DG-13: ELK reads a zone's inner spacing from the zone, not the root — without these
      // a zone fell back to ELK's 20 px and a label covered its nodes' titles (the ClickHouse
      // example's Confluent zone). Each zone gets the spacing of its own direction.
      // P4: library gap — `layoutFlowElk` sets `nodeSpacing`/`rankSpacing` on the root only
      // (layout-flow-elk.ts:189); proposed: apply them to every group too.
      "elk.spacing.nodeNode": String(NODE_SPACING),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(RANK_SPACING[direction]),
    };
    if (direction !== effective(parentOf.get(zone.id))) {
      separate.add(zone.id);
      options["elk.algorithm"] = "layered";
      options["elk.hierarchyHandling"] = "SEPARATE_CHILDREN";
      Object.assign(options, CYCLE_BREAKING);
    } else if (ancestors(zone.id).some((a) => separate.has(a))) {
      options["elk.hierarchyHandling"] = "INCLUDE_CHILDREN";
    }
    zone.layoutOptions = options;
  }
  if (separate.size === 0) {
    if (routing) attachRouting(graph, routing, lifted);
    return graph;
  }

  /** The outermost separate zone around `id` (or `id` itself) that does not hold `other`. */
  const lift = (id: string, other: string): string => {
    const otherChain = new Set([other, ...ancestors(other)]);
    let outermost = id;
    for (const candidate of [id, ...ancestors(id)]) {
      if (separate.has(candidate) && !otherChain.has(candidate)) outermost = candidate;
    }
    return outermost;
  };
  const edges: ElkEdge[] = [];
  for (const edge of graph.edges ?? []) {
    const source = edge.sources[0];
    const target = edge.targets[0];
    if (source === undefined || target === undefined) continue;
    if (ancestors(source).includes(target) || ancestors(target).includes(source)) continue;
    const from = lift(source, target);
    const to = lift(target, source);
    if (from !== source || to !== target) {
      lifted.set(edge.id, {
        ...(from === source ? {} : { source: from }),
        ...(to === target ? {} : { target: to }),
      });
    }
    if (from !== to) edges.push({ ...edge, sources: [from], targets: [to] });
  }
  const decorated = { ...graph, edges };
  if (routing) attachRouting(decorated, routing, lifted);
  return decorated;
}

let elk: Promise<FlowElkEngine> | undefined;

/** One ELK instance, loaded on first use (keeps elkjs out of the first chunk). */
function loadElk(): Promise<FlowElkEngine> {
  elk ??= import("elkjs/lib/elk.bundled.js").then(({ default: ELK }) => new ELK());
  return elk;
}

export interface RunElkOptions {
  direction: DiagramDirection;
  /** Zone id → its own `direction:` (zones without one inherit). */
  zoneDirection: ReadonlyMap<string, DiagramDirection>;
  /** Compound nodes: zones that have at least one child in `nodes`. */
  groups: { id: string; children: string[] }[];
  /** Labels, ports and zone minimum widths (wave-2 review M2/M5). */
  routing?: ElkRouting;
}

export type RunElkResult = FlowLayoutElkResult & {
  ms: number;
  /** Edge id → ELK's route, for every edge ELK routed between its real ends. */
  routes: ReadonlyMap<string, DataFlowEdgeRoute>;
};

/**
 * One ELK pass through flow's `layoutFlowElk`, with the per-zone decoration above.
 * `engine === "dagre"` means ELK failed and flow fell back (it logs a warning) — the
 * caller treats that as a failed layout.
 */
export async function runElk(
  nodes: Node[],
  edges: Edge[],
  options: RunElkOptions,
): Promise<RunElkResult> {
  const t0 = performance.now();
  // P4: library gap — `layoutFlowElk` returns the input `edges` unchanged (no bend points,
  // no label positions; DG-03-elk-nested.md gap 2). The wrapper below keeps ELK's own
  // result, and `collectRoutes` reads each edge's sections and label from it.
  let laidOut: ElkRoutedNode | undefined;
  const lifted: Lifted = new Map();
  const result = await layoutFlowElk(nodes, edges, {
    direction: options.direction,
    groups: options.groups,
    edgeRouting: "orthogonal",
    nodeSpacing: NODE_SPACING,
    rankSpacing: RANK_SPACING[options.direction],
    loadEngine: async () => {
      const engine = await loadElk();
      return {
        layout: async (graph) => {
          const decorated = decorateElkGraph(
            graph,
            options.zoneDirection,
            options.direction,
            options.routing,
            lifted,
          );
          const out = await engine.layout(decorated);
          laidOut = out as ElkRoutedNode;
          return out;
        },
      };
    },
  });
  const routes = result.engine === "elk" && laidOut ? collectRoutes(laidOut, lifted) : new Map();
  return { ...result, routes, ms: Math.round(performance.now() - t0) };
}
