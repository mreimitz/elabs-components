import {
  layoutFlowElk,
  type Edge,
  type FlowElkEngine,
  type FlowElkGraph,
  type FlowLayoutElkResult,
  type Node,
} from "@elabs-ai/components-flow";

export type DiagramDirection = "LR" | "TB";

const ELK_DIRECTION: Record<DiagramDirection, string> = {
  LR: "RIGHT",
  TB: "DOWN",
};

type ElkEdge = NonNullable<FlowElkGraph["edges"]>[number];

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
 * DG-13: the gap between two layers, per direction. An edge label sits in that gap: across
 * it in LR (a label is ~80–130 px wide, so flow's 72 px default let it cover the node titles
 * on both sides), along it in TB (label plus protocol line, ~40 px tall, fits in 72).
 */
const RANK_SPACING: Record<DiagramDirection, number> = { LR: 120, TB: 72 };

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
  if (separate.size === 0) return graph;

  /** The outermost separate zone around `id` (or `id` itself) that does not hold `other`. */
  const lift = (id: string, other: string): string => {
    const otherChain = new Set([other, ...ancestors(other)]);
    let lifted = id;
    for (const candidate of [id, ...ancestors(id)]) {
      if (separate.has(candidate) && !otherChain.has(candidate)) lifted = candidate;
    }
    return lifted;
  };
  const edges: ElkEdge[] = [];
  for (const edge of graph.edges ?? []) {
    const source = edge.sources[0];
    const target = edge.targets[0];
    if (source === undefined || target === undefined) continue;
    if (ancestors(source).includes(target) || ancestors(target).includes(source)) continue;
    const from = lift(source, target);
    const to = lift(target, source);
    if (from !== to) edges.push({ ...edge, sources: [from], targets: [to] });
  }
  return { ...graph, edges };
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
}

export type RunElkResult = FlowLayoutElkResult & { ms: number };

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
  // P4: library gap — `edgeRouting: "orthogonal"` only steers ELK's own internal graph
  // computation; the returned `edges` are the input array unchanged (no bend points), and
  // the edges draw their own paths. See DG-03-elk-nested.md gap 2.
  const result = await layoutFlowElk(nodes, edges, {
    direction: options.direction,
    groups: options.groups,
    edgeRouting: "orthogonal",
    nodeSpacing: NODE_SPACING,
    rankSpacing: RANK_SPACING[options.direction],
    loadEngine: async () => {
      const engine = await loadElk();
      return {
        layout: (graph) =>
          engine.layout(decorateElkGraph(graph, options.zoneDirection, options.direction)),
      };
    },
  });
  return { ...result, ms: Math.round(performance.now() - t0) };
}
