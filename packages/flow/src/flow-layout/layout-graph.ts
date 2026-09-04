import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { Edge, Node } from "@xyflow/react";
import { HANDLE_BY_DIRECTION, layoutFlow, type FlowLayoutDirection } from "./flow-layout";

/** Which generic graph-geometry algorithm `layoutGraph` should run. */
export type LayoutAlgorithm = "concentric" | "force" | "layered-lr" | "layered-tb" | "grid";

/** Horizontal/vertical gap used by the `"grid"` and `"layered-*"` algorithms. */
export interface LayoutSpacing {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Which layout algorithm to run. */
  algorithm: LayoutAlgorithm;
  /**
   * `"concentric"` only — the focal node placed at the origin. Defaults to the
   * highest-degree node when omitted (or when the id doesn't match a node).
   */
  centerId?: string;
  /** `"concentric"` only — radius of ring 1; ring N sits at `N × ringRadius`. @default 180 */
  ringRadius?: number;
  /** `"force"` only — number of synchronous simulation ticks to run. @default 300 */
  iterations?: number;
  /** `"grid"` / `"layered-lr"` / `"layered-tb"` — gap between nodes. @default {x:200,y:120} for grid. */
  spacing?: LayoutSpacing;
  /** Resolve a node's size by id. Falls back to `measured`/`width`/`height`/a sensible default. */
  nodeSize?: (id: string) => { width: number; height: number };
}

const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 40;
const DEFAULT_RING_RADIUS = 180;
const DEFAULT_FORCE_ITERATIONS = 300;
const DEFAULT_GRID_SPACING: LayoutSpacing = { x: 200, y: 120 };
/** Base charge/link/collide tuning — chosen to read well at brand-ui's default node size. */
const FORCE_CHARGE_STRENGTH = -300;
const FORCE_LINK_DISTANCE = 150;

function resolveNodeSize(
  node: Node,
  nodeSize?: (id: string) => { width: number; height: number },
): { width: number; height: number } {
  if (nodeSize) return nodeSize(node.id);
  return {
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Pure graph-geometry auto layout. Computes new `position`s for `nodes` given
 * `edges` and a `LayoutAlgorithm` — no React, no DOM, no side effects, safe to
 * call anywhere (including outside a component or in a test). Deterministic:
 * identical `nodes`/`edges`/`options` always produce identical positions.
 *
 * Node identity and `data` are left untouched — only `position` changes.
 * Pair with `useAutoLayout` for a memoized hook form.
 *
 * - `"layered-lr"` / `"layered-tb"` delegate to the dagre-powered `layoutFlow`
 *   (direction `"LR"` / `"TB"`). `spacing.x` is always the horizontal gap and
 *   `spacing.y` the vertical one, so the two differ only in which axis carries
 *   the ranks.
 * - `"concentric"` places `centerId` (or the highest-degree node) at the
 *   origin, with BFS shells at `ring × ringRadius`; disconnected nodes land in
 *   one extra outer ring so positions are never `NaN`.
 * - `"force"` runs `d3-force` synchronously for a fixed number of `iterations`,
 *   seeded on a circle by index (no randomness) so runs are reproducible.
 * - `"grid"` lays nodes out row-major using `spacing`.
 */
export function layoutGraph<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: LayoutOptions,
): NodeType[] {
  if (nodes.length === 0) return [];

  switch (options.algorithm) {
    case "layered-lr":
      return layoutLayered(nodes, edges, options, "LR");
    case "layered-tb":
      return layoutLayered(nodes, edges, options, "TB");
    case "concentric":
      return layoutConcentric(nodes, edges, options);
    case "force":
      return layoutForce(nodes, edges, options);
    case "grid":
      return layoutGrid(nodes, options);
    default: {
      const exhaustiveCheck: never = options.algorithm;
      throw new Error(`layoutGraph: unknown algorithm "${String(exhaustiveCheck)}"`);
    }
  }
}

function layoutLayered<NodeType extends Node, EdgeType extends Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: LayoutOptions,
  direction: FlowLayoutDirection,
): NodeType[] {
  const { spacing, nodeSize } = options;

  // dagre (via layoutFlow) reads sizes off `measured`/`width`/`height` — feed it
  // resolved sizes on a throwaway copy so a caller-supplied `nodeSize` is honored
  // without mutating (or permanently resizing) the nodes we return.
  const sizedNodes = nodeSize
    ? nodes.map((node) => {
        const { width, height } = nodeSize(node.id);
        return { ...node, width, height, measured: { width, height } };
      })
    : nodes;

  // Ranks progress along the layout axis and nodes stack across it, so the two
  // directions map the SAME `spacing.x`/`spacing.y` onto dagre's rank/node sep
  // with the axes swapped: LR ranks horizontally (x), TB ranks vertically (y).
  const horizontalRanks = direction === "LR" || direction === "RL";
  const { nodes: laidOut } = layoutFlow(sizedNodes, edges, {
    direction,
    nodeSpacing: horizontalRanks ? spacing?.y : spacing?.x,
    rankSpacing: horizontalRanks ? spacing?.x : spacing?.y,
  });

  // Carry the handle sides layoutFlow stamped on (LR right-out/left-in, TB
  // bottom-out/top-in), not just the position — otherwise the layout moves the
  // nodes but leaves the anchors on the wrong sides.
  return nodes.map((node, i) => ({
    ...node,
    sourcePosition: laidOut[i]!.sourcePosition,
    targetPosition: laidOut[i]!.targetPosition,
    position: laidOut[i]!.position,
  }));
}

function resolveCenterId(
  centerId: string | undefined,
  nodeIds: string[],
  adjacency: Map<string, Set<string>>,
): string {
  if (centerId && nodeIds.includes(centerId)) return centerId;

  let best = nodeIds[0]!;
  let bestDegree = -1;
  for (const id of nodeIds) {
    const degree = adjacency.get(id)?.size ?? 0;
    if (degree > bestDegree) {
      bestDegree = degree;
      best = id;
    }
  }
  return best;
}

function layoutConcentric<NodeType extends Node, EdgeType extends Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: LayoutOptions,
): NodeType[] {
  const ringRadius = options.ringRadius ?? DEFAULT_RING_RADIUS;
  const nodeIds = nodes.map((node) => node.id);
  const idSet = new Set(nodeIds);

  const adjacency = new Map<string, Set<string>>();
  for (const id of nodeIds) adjacency.set(id, new Set());
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  const centerId = resolveCenterId(options.centerId, nodeIds, adjacency);

  // BFS shells from the center — hop distance doubles as the ring index.
  const hopOf = new Map<string, number>();
  hopOf.set(centerId, 0);
  const queue: string[] = [centerId];
  let maxHop = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentHop = hopOf.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (hopOf.has(neighbor)) continue;
      const hop = currentHop + 1;
      hopOf.set(neighbor, hop);
      maxHop = Math.max(maxHop, hop);
      queue.push(neighbor);
    }
  }

  // Disconnected nodes (unreachable from the center) get one extra ring beyond
  // the farthest reached hop — never left with a NaN/undefined position.
  const leftoverHop = maxHop + 1;
  for (const id of nodeIds) {
    if (!hopOf.has(id)) hopOf.set(id, leftoverHop);
  }

  const rings = new Map<number, string[]>();
  for (const id of nodeIds) {
    const hop = hopOf.get(id)!;
    if (hop === 0) continue;
    if (!rings.has(hop)) rings.set(hop, []);
    rings.get(hop)!.push(id);
  }

  const positionById = new Map<string, { x: number; y: number }>();
  positionById.set(centerId, { x: 0, y: 0 });

  for (const [hop, ids] of rings) {
    const count = ids.length;
    const angleStep = (2 * Math.PI) / count;
    // Stagger successive rings by a growing half-step so radial edges don't
    // trivially line up with the ring behind/ahead of them.
    const ringOffset = (hop - 1) * (angleStep / 2);
    const radius = hop * ringRadius;
    ids.forEach((id, i) => {
      const angle = ringOffset + i * angleStep;
      positionById.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positionById.get(node.id) ?? { x: 0, y: 0 },
  }));
}

interface ForceSimNode extends SimulationNodeDatum {
  id: string;
}

function layoutForce<NodeType extends Node, EdgeType extends Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: LayoutOptions,
): NodeType[] {
  const iterations = options.iterations ?? DEFAULT_FORCE_ITERATIONS;
  const nodeIds = new Set(nodes.map((node) => node.id));

  // Seed initial positions deterministically on a circle by index — never
  // `Math.random()` — so two runs with the same input converge identically.
  const seedRadius = Math.max(nodes.length * 20, 100);
  const simNodes: ForceSimNode[] = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return { id: node.id, x: seedRadius * Math.cos(angle), y: seedRadius * Math.sin(angle) };
  });

  const simLinks: SimulationLinkDatum<ForceSimNode>[] = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target }));

  const collisionById = new Map(
    nodes.map((node) => {
      const { width, height } = resolveNodeSize(node, options.nodeSize);
      return [node.id, Math.max(width, height) / 2];
    }),
  );

  const simulation = forceSimulation(simNodes)
    .force("charge", forceManyBody().strength(FORCE_CHARGE_STRENGTH))
    .force(
      "link",
      forceLink<ForceSimNode, SimulationLinkDatum<ForceSimNode>>(simLinks)
        .id((d) => d.id)
        .distance(FORCE_LINK_DISTANCE),
    )
    .force("center", forceCenter(0, 0))
    .force(
      "collide",
      forceCollide<ForceSimNode>((d) => collisionById.get(d.id) ?? DEFAULT_NODE_WIDTH / 2),
    )
    .stop();

  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  const positionById = new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));

  return nodes.map((node) => ({
    ...node,
    position: positionById.get(node.id) ?? { x: 0, y: 0 },
  }));
}

function layoutGrid<NodeType extends Node>(nodes: NodeType[], options: LayoutOptions): NodeType[] {
  const spacing = options.spacing ?? DEFAULT_GRID_SPACING;
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  // A grid reads top-to-bottom; anchor edges bottom-out / top-in to match.
  const handles = HANDLE_BY_DIRECTION.TB;

  return nodes.map((node, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      ...node,
      sourcePosition: handles.source,
      targetPosition: handles.target,
      position: { x: col * spacing.x, y: row * spacing.y },
    };
  });
}
