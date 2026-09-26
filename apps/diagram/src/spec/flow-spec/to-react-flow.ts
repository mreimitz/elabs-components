/**
 * `toReactFlow(spec, definitions)` — review §4.4. FlowSpec → React Flow `nodes`/`edges`.
 * React-free: `@xyflow/react` is imported for its TYPES only (erased).
 */
import type { Edge, Node } from "@xyflow/react";
import type {
  FlowPortSide,
  FlowSpec,
  FlowSpecDefinition,
  FlowSpecDefinitions,
  FlowSpecDirection,
  FlowSpecNode,
} from "./types";

export interface ReactFlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/** The side an edge leaves / enters on, per diagram direction — edges follow the flow. */
const OUT_SIDE: Record<FlowSpecDirection, FlowPortSide> = { LR: "right", TB: "bottom" };
const IN_SIDE: Record<FlowSpecDirection, FlowPortSide> = { LR: "left", TB: "top" };

/**
 * The port an edge uses when the spec names none: the wanted direction's port on the side
 * the flow runs (`output` → right in LR, bottom in TB; `input` → left / top), else the
 * first port with that direction, else none. DG-11 reuses it for zones with their own
 * `direction:`.
 */
export function pickPort(
  def: FlowSpecDefinition | undefined,
  want: "input" | "output",
  direction: FlowSpecDirection,
): string | undefined {
  const side = want === "output" ? OUT_SIDE[direction] : IN_SIDE[direction];
  const ports = Object.entries(def?.targets ?? {}).filter(([, p]) => p.direction === want);
  return (ports.find(([, p]) => p.side === side) ?? ports[0])?.[0];
}

/** Ids whose parent chain loops (reported as `parent-cycle`): they get no `parentId`. */
function cyclic(nodes: readonly FlowSpecNode[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  for (const node of nodes) {
    const seen = new Set<string>();
    for (let p: FlowSpecNode | undefined = node; p; p = p.parent ? byId.get(p.parent) : undefined) {
      if (seen.has(p.id)) {
        out.add(node.id);
        break;
      }
      seen.add(p.id);
    }
  }
  return out;
}

/**
 * Parents before children, otherwise document order: React Flow (and flow's group
 * operations) need a parent earlier in `nodes` than its children (verified-apis.md → flow).
 * The dialect allows `parent:` to point forward (DG-09 "Notes for later items").
 */
function parentFirst(nodes: readonly FlowSpecNode[], skip: ReadonlySet<string>): FlowSpecNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = (node: FlowSpecNode): number => {
    let d = 0;
    for (let p = node.parent; p !== undefined && !skip.has(node.id); ) {
      const parent = byId.get(p);
      if (!parent) break;
      d += 1;
      p = parent.parent;
    }
    return d;
  };
  return nodes
    .map((node, index) => ({ node, index, depth: depth(node) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.node);
}

/**
 * Node `position` is the spec's (manual layout) or `{0,0}` until DG-11 lays it out. No
 * `extent`: DG-06's auto-fit needs a drag to cross the zone edge (DG-06 finding 6). No
 * `zIndex`: React Flow's basic z-index mode already lifts children above their parent and
 * edges that touch a child (`@xyflow/system` 0.0.78 `getElevatedEdgeZIndex`, dist/esm/index.js
 * L1000–1007).
 * Edges whose end does not exist or has no port are skipped — `validateFlowSpec` reports them.
 */
export function toReactFlow(spec: FlowSpec, definitions: FlowSpecDefinitions): ReactFlowGraph {
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const loops = cyclic(spec.nodes);
  const nodes: Node[] = parentFirst(spec.nodes, loops).map((n) => ({
    id: n.id,
    type: n.type,
    data: { ...n.data },
    position: n.position ? { ...n.position } : { x: 0, y: 0 },
    ...(n.parent !== undefined && byId.has(n.parent) && !loops.has(n.id)
      ? { parentId: n.parent }
      : {}),
  }));

  const direction = spec.layout.direction;
  const edges: Edge[] = [];
  for (const e of spec.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) continue;
    const sourcePort = e.sourcePort ?? pickPort(definitions.get(source.type), "output", direction);
    const targetPort = e.targetPort ?? pickPort(definitions.get(target.type), "input", direction);
    if (sourcePort === undefined || targetPort === undefined) continue;
    edges.push({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: `out:${sourcePort}`,
      targetHandle: `in:${targetPort}`,
      data: { ...e.data },
    });
  }
  return { nodes, edges };
}
