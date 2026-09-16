import type { Edge, Node, XYPosition } from "@xyflow/react";
import type { FlowElkBackbone } from "./backbone";
import {
  HANDLE_BY_DIRECTION,
  layoutFlow,
  type FlowLayoutDirection,
  type FlowLayoutResult,
} from "./flow-layout";

/**
 * elkjs layout adapter — RM-067.
 *
 * dagre has no self-loop layout, no edge routing and weak compound nodes. ELK (Eclipse
 * Layout Kernel, EPL-2.0) has all three, and it is large — so it is an OPTIONAL peer of this
 * package, reached ONLY through `import()` inside {@link layoutFlowElk}'s body. A consumer
 * that never calls it never downloads it, and a consumer that calls it without installing
 * elkjs gets `layoutFlow`'s dagre answer plus a development-only console warning, never a
 * crash.
 *
 * The engine runs in a web worker (`./elk-worker.ts`) when the environment has one, and
 * inline on the calling thread when it does not (a Node test, a server render) or when the
 * worker fails to start — the same degrade-never-fail contract as RM-050's
 * `createProcessWorker`. No remote origin is involved: the worker is a same-origin module
 * the host bundler emits next to this one.
 */

/** Options for {@link layoutFlowElk}. */
export interface FlowLayoutElkOptions {
  /** Layout direction. @default "TB" */
  direction?: FlowLayoutDirection;
  /** How ELK routes edges. @default "splines" */
  edgeRouting?: "orthogonal" | "splines";
  /** Route back-edges as ELK feedback edges (around the graph, not through it). @default true */
  feedbackEdges?: boolean;
  /** Gap between nodes in the same layer. @default 48 */
  nodeSpacing?: number;
  /** Gap between layers. @default 72 */
  rankSpacing?: number;
  /**
   * Compound nodes. Each `id` names a node already in `nodes` (typically a `FlowGroupNode`);
   * its `children` are laid out inside it and come back with `parentId` set, positioned
   * relative to the group, and the group comes back sized to fit them.
   */
  groups?: { id: string; children: string[] }[];
  /** A pinned straight path — see `pinBackbone`. */
  backbone?: FlowElkBackbone;
  /**
   * Supply the engine yourself: a host with its own worker URL, or a test. Rejecting (for
   * example because elkjs is not installed) falls back to dagre exactly like the default
   * loader does.
   */
  loadEngine?: () => Promise<FlowElkEngine>;
}

/** A graph in ELK's JSON format — the minimal shape this adapter reads and writes. */
export interface FlowElkGraph {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
  children?: FlowElkGraph[];
  edges?: {
    id: string;
    sources: string[];
    targets: string[];
    layoutOptions?: Record<string, string>;
  }[];
}

/** A running ELK engine. `new ELK()` from elkjs satisfies it. */
export interface FlowElkEngine {
  layout(graph: FlowElkGraph): Promise<FlowElkGraph>;
}

/** What {@link layoutFlowElk} answers — `layoutFlow`'s result plus which engine produced it. */
export interface FlowLayoutElkResult<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> extends FlowLayoutResult<NodeType, EdgeType> {
  /** `"elk"`, or `"dagre"` when elkjs could not be loaded or failed and dagre answered. */
  engine: "elk" | "dagre";
}

const ELK_DIRECTION: Record<FlowLayoutDirection, string> = {
  TB: "DOWN",
  BT: "UP",
  LR: "RIGHT",
  RL: "LEFT",
};

/** Room above a group's children for its header, matching `groupNodes`' own offset. */
const GROUP_PADDING = "[top=60,left=16,bottom=16,right=16]";

/**
 * Straightness priority for backbone edges, against the default `0` of every other edge —
 * enough for network-simplex placement to favour them in every tie it breaks.
 */
const BACKBONE_STRAIGHTNESS = "100";

const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 40;

function nodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/** CommonJS interop: elkjs ships CJS, which bundlers and Node wrap in `default` differently. */
function interopDefault<T>(mod: unknown): T {
  let value = mod as { default?: unknown };
  while (value && typeof value === "object" && "default" in value && value.default) {
    value = value.default as { default?: unknown };
  }
  return value as T;
}

type ElkConstructor = new (args: { workerFactory: (url?: string) => unknown }) => FlowElkEngine & {
  terminateWorker(): void;
};

type FakeWorkerConstructor = new (url?: string) => unknown;

/** Raised when the worker itself fails, so the layout can be retried inline. */
class ElkWorkerFailure extends Error {}

async function loadInlineEngine(ELK: ElkConstructor): Promise<FlowElkEngine> {
  // `elk-worker.min.js` exports `{ default: FakeWorker, Worker: FakeWorker }` outside a worker.
  // @ts-expect-error -- elkjs ships no declaration for the minified worker; the shape is narrowed below.
  const mod = (await import("elkjs/lib/elk-worker.min.js")) as {
    Worker?: FakeWorkerConstructor;
    default?: FakeWorkerConstructor | { Worker?: FakeWorkerConstructor };
  };
  const FakeWorker =
    mod.Worker ?? (typeof mod.default === "function" ? mod.default : mod.default?.Worker);
  if (FakeWorker === undefined) throw new Error("elkjs inline worker not found");
  return new ELK({ workerFactory: (url) => new FakeWorker(url) });
}

/**
 * The default engine: a real web worker when one can be constructed, degrading to the inline
 * engine if construction throws or the worker errors (e.g. a bundler that did not emit the
 * worker file). Each call owns its worker and terminates it when the layout settles.
 */
async function loadDefaultEngine(): Promise<FlowElkEngine> {
  const ELK = interopDefault<ElkConstructor>(await import("elkjs/lib/elk-api.js"));
  if (typeof Worker === "undefined" || typeof URL === "undefined") return loadInlineEngine(ELK);

  return {
    async layout(graph) {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./elk-worker.ts", import.meta.url), { type: "module" });
      } catch {
        return (await loadInlineEngine(ELK)).layout(graph);
      }
      const elk = new ELK({ workerFactory: () => worker });
      const failed = new Promise<never>((_, reject) => {
        worker.addEventListener("error", () => reject(new ElkWorkerFailure("elk worker failed")));
        worker.addEventListener("messageerror", () =>
          reject(new ElkWorkerFailure("elk worker message failed")),
        );
      });
      try {
        return await Promise.race([elk.layout(graph), failed]);
      } catch (error) {
        if (!(error instanceof ElkWorkerFailure)) throw error;
        return (await loadInlineEngine(ELK)).layout(graph);
      } finally {
        failed.catch(() => undefined);
        elk.terminateWorker();
      }
    },
  };
}

function warnFallback(error: unknown): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  console.warn(
    "[@elabs-ai/components-flow] layoutFlowElk could not run elkjs (is the optional peer " +
      "`elkjs` installed?) — falling back to the dagre layout.",
    error,
  );
}

/** Build ELK's hierarchical graph, nesting grouped nodes under their group. */
function toElkGraph(nodes: Node[], edges: Edge[], options: FlowLayoutElkOptions): FlowElkGraph {
  const {
    direction = "TB",
    edgeRouting = "splines",
    feedbackEdges = true,
    nodeSpacing = 48,
    rankSpacing = 72,
    groups = [],
    backbone,
  } = options;

  const ids = new Set(nodes.map((n) => n.id));
  const straight = new Set(backbone?.edgeIds ?? []);
  const parentOf = new Map<string, string>();
  const groupIds = new Set<string>();
  for (const group of groups) {
    if (!ids.has(group.id)) continue;
    groupIds.add(group.id);
    for (const child of group.children) {
      if (ids.has(child) && child !== group.id) parentOf.set(child, group.id);
    }
  }

  const elkNodes = new Map<string, FlowElkGraph>();
  for (const node of nodes) {
    const isGroup = groupIds.has(node.id);
    elkNodes.set(node.id, {
      id: node.id,
      // A group is sized by ELK from its children; a leaf keeps its measured size.
      ...(isGroup ? { layoutOptions: { "elk.padding": GROUP_PADDING } } : nodeSize(node)),
    });
  }

  const root: FlowElkGraph = {
    id: "__flow_elk_root__",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": ELK_DIRECTION[direction],
      "elk.edgeRouting": edgeRouting === "orthogonal" ? "ORTHOGONAL" : "SPLINES",
      "elk.spacing.nodeNode": String(nodeSpacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(rankSpacing),
      "elk.layered.feedbackEdges": String(feedbackEdges),
      // Break cycles by input order, as a reader would: the edge pointing back to an
      // EARLIER node is the reversed one — the same edge dagre reports.
      "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
      "elk.hierarchyHandling": groupIds.size > 0 ? "INCLUDE_CHILDREN" : "INHERIT",
      ...(backbone && backbone.nodeIds.length > 0
        ? { "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX" }
        : {}),
    },
    children: [],
    edges: edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        ...(straight.has(edge.id)
          ? { layoutOptions: { "elk.layered.priority.straightness": BACKBONE_STRAIGHTNESS } }
          : {}),
      })),
  };

  for (const node of nodes) {
    const elkNode = elkNodes.get(node.id)!;
    const parent = resolveParent(node.id, parentOf);
    const container = parent === undefined ? root : elkNodes.get(parent)!;
    (container.children ??= []).push(elkNode);
  }
  return root;
}

/** A node's group, ignoring any parent chain that would loop back onto itself. */
function resolveParent(id: string, parentOf: Map<string, string>): string | undefined {
  const parent = parentOf.get(id);
  if (parent === undefined) return undefined;
  const seen = new Set([id]);
  let cursor: string | undefined = parent;
  while (cursor !== undefined) {
    if (seen.has(cursor)) return undefined;
    seen.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return parent;
}

interface PlacedNode {
  relative: XYPosition;
  absolute: XYPosition;
  width?: number;
  height?: number;
  parentId?: string;
}

function collectPlacements(
  graph: FlowElkGraph,
  origin: XYPosition,
  parentId: string | undefined,
  out: Map<string, PlacedNode>,
): void {
  for (const child of graph.children ?? []) {
    const relative = { x: child.x ?? 0, y: child.y ?? 0 };
    const absolute = { x: origin.x + relative.x, y: origin.y + relative.y };
    out.set(child.id, {
      relative,
      absolute,
      width: child.width,
      height: child.height,
      ...(parentId === undefined ? {} : { parentId }),
    });
    if (child.children && child.children.length > 0) {
      collectPlacements(child, absolute, child.id, out);
    }
  }
}

/**
 * Put the backbone's nodes on one line by translating each of their LAYERS along the cross
 * axis. ELK's straightness priority gets close but does not guarantee a line; shifting a
 * whole layer does, and cannot overlap two nodes of that layer. Only top-level nodes are
 * moved — a node inside a group is positioned relative to it.
 */
function straightenBackbone(
  placements: Map<string, PlacedNode>,
  nodeIds: readonly string[],
  direction: FlowLayoutDirection,
): void {
  const along = direction === "LR" || direction === "RL" ? "x" : "y";
  const cross = along === "x" ? "y" : "x";
  const extent = (p: PlacedNode, axis: "x" | "y") => (axis === "x" ? p.width : p.height) ?? 0;
  const centerOf = (p: PlacedNode) => p.absolute[cross] + extent(p, cross) / 2;

  const pinned = nodeIds
    .map((id) => placements.get(id))
    .filter((p): p is PlacedNode => p !== undefined && p.parentId === undefined);
  const first = pinned[0];
  if (first === undefined) return;
  const line = centerOf(first);

  const topLevel = [...placements.values()].filter((p) => p.parentId === undefined);
  const moved = new Set<PlacedNode>();
  for (const anchor of pinned) {
    const delta = line - centerOf(anchor);
    if (delta === 0) continue;
    const start = anchor.absolute[along];
    const end = start + extent(anchor, along);
    for (const p of topLevel) {
      if (moved.has(p)) continue;
      const pStart = p.absolute[along];
      if (pStart >= end || pStart + extent(p, along) <= start) continue;
      p.absolute = { ...p.absolute, [cross]: p.absolute[cross] + delta };
      p.relative = { ...p.relative, [cross]: p.relative[cross] + delta };
      moved.add(p);
    }
  }
}

/**
 * Lay a graph out with ELK's layered algorithm — `layoutFlow`'s async sibling.
 *
 * Same result shape as `layoutFlow` (`nodes`, `edges`, `backEdges`, `selfLoops`), so a
 * caller can swap engines without a different consumption path; `engine` says which one
 * actually answered. Self-loops are laid out by ELK (it routes them around their node) and
 * still reported in `selfLoops`; `backEdges` are the edges whose source sits at or after
 * their target along the layout direction.
 *
 * elkjs is imported lazily inside this function. If it is not installed, or ELK throws,
 * the result is `layoutFlow`'s dagre layout with `engine: "dagre"`.
 */
export async function layoutFlowElk<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
  options: FlowLayoutElkOptions = {},
): Promise<FlowLayoutElkResult<NodeType, EdgeType>> {
  const direction = options.direction ?? "TB";

  let laidOut: FlowElkGraph;
  try {
    const engine = await (options.loadEngine ?? loadDefaultEngine)();
    laidOut = await engine.layout(toElkGraph(nodes, edges, options));
  } catch (error) {
    warnFallback(error);
    return {
      ...layoutFlow(nodes, edges, {
        direction,
        ...(options.nodeSpacing === undefined ? {} : { nodeSpacing: options.nodeSpacing }),
        ...(options.rankSpacing === undefined ? {} : { rankSpacing: options.rankSpacing }),
      }),
      engine: "dagre",
    };
  }

  const placements = new Map<string, PlacedNode>();
  collectPlacements(laidOut, { x: 0, y: 0 }, undefined, placements);
  if (options.backbone) straightenBackbone(placements, options.backbone.nodeIds, direction);

  const handles = HANDLE_BY_DIRECTION[direction];
  const groupIds = new Set((options.groups ?? []).map((group) => group.id));
  const layoutedNodes = nodes.map((node) => {
    const placed = placements.get(node.id);
    if (!placed) return node;
    const next: NodeType = {
      ...node,
      sourcePosition: handles.source,
      targetPosition: handles.target,
      position: placed.relative,
    };
    if (placed.parentId !== undefined) {
      next.parentId = placed.parentId;
      next.extent = "parent";
    }
    if (groupIds.has(node.id) && placed.width !== undefined && placed.height !== undefined) {
      next.width = placed.width;
      next.height = placed.height;
    }
    return next;
  });

  const selfLoops: string[] = [];
  const backEdges: string[] = [];
  const axis = direction === "LR" || direction === "RL" ? "x" : "y";
  const sign = direction === "BT" || direction === "RL" ? -1 : 1;
  const center = (id: string): number | undefined => {
    const placed = placements.get(id);
    if (!placed) return undefined;
    const size = axis === "x" ? (placed.width ?? 0) : (placed.height ?? 0);
    return sign * (placed.absolute[axis] + size / 2);
  };
  for (const edge of edges) {
    if (edge.source === edge.target) {
      selfLoops.push(edge.id);
      continue;
    }
    const source = center(edge.source);
    const target = center(edge.target);
    if (source === undefined || target === undefined) continue;
    if (source >= target) backEdges.push(edge.id);
  }

  return { nodes: layoutedNodes, edges, backEdges, selfLoops, engine: "elk" };
}
