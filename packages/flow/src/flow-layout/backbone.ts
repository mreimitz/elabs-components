import type { Edge, Node } from "@xyflow/react";

/**
 * One path through the graph to lay out on a single straight line (RM-067).
 *
 * Produced by {@link pinBackbone}, consumed by `layoutFlowElk`'s `backbone` option. Plain
 * data, so it clones, serializes and memoizes like any other layout input.
 */
export interface FlowElkBackbone {
  /** Node ids on the pinned path, in path order. */
  nodeIds: string[];
  /** Ids of the edges joining consecutive pinned nodes, in path order. */
  edgeIds: string[];
}

/**
 * Pin a variant's activity sequence to one straight row (LR/RL) or column (TB/BT) — the
 * Apromore-style "backbone" layout (RM-067).
 *
 * A pre-pass, not a layout: hand the result to `layoutFlowElk` as `backbone` and the rest of
 * the graph lays out around it. ELK gets the joining edges at the highest straightness
 * priority, then every layer holding a pinned node is translated as a whole along the
 * cross axis so the pinned nodes share one line — a whole-layer shift, so no two nodes of
 * a layer can ever be pushed onto each other.
 *
 * `variant` is the sequence of NODE IDS — for a process graph, the most frequent variant's
 * activities, which are the activity nodes' ids. An id with no node is skipped; a repeated
 * activity (rework inside the variant) is pinned once, at its first occurrence, because a
 * node cannot sit on a straight line twice.
 *
 * @example
 * ```ts
 * const backbone = pinBackbone(nodes, edges, variants[0].activities);
 * const { nodes: laidOut } = await layoutFlowElk(nodes, edges, { direction: "LR", backbone });
 * ```
 */
export function pinBackbone(
  nodes: readonly Node[],
  edges: readonly Edge[],
  variant: readonly string[],
): FlowElkBackbone {
  const known = new Set(nodes.map((node) => node.id));
  const nodeIds: string[] = [];
  const seen = new Set<string>();
  for (const id of variant) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    nodeIds.push(id);
  }

  const edgeIds: string[] = [];
  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    const edge = edges.find((e) => e.source === nodeIds[i] && e.target === nodeIds[i + 1]);
    if (edge) edgeIds.push(edge.id);
  }

  return { nodeIds, edgeIds };
}
