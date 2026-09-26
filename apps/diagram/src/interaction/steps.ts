/**
 * DG-18 — the numbered flows (`step:` on a flow, plan D12) as a walk-through: one entry per
 * step number, in order, each naming its flows. Pure; the step player and the canvas hook
 * read it.
 */
import type { Edge, Node } from "@elabs-ai/components-flow";
import type { DataFlowEdgeData } from "../edges/data-flow-edge-data";

export interface WalkFlow {
  /** The flow's edge id. */
  id: string;
  label?: string;
  /** Titles of the two ends, in the arrow's direction. */
  from: string;
  to: string;
}

export interface WalkStep {
  step: number;
  flows: WalkFlow[];
}

function flowData(edge: Edge): DataFlowEdgeData {
  return (edge.data ?? {}) as DataFlowEdgeData;
}

/** Every step number the graph's flows carry, ascending, with the flows of each. */
export function walkSteps(graph: { nodes: readonly Node[]; edges: readonly Edge[] }): WalkStep[] {
  const titles = new Map(
    graph.nodes.map((node) => [
      node.id,
      typeof node.data.title === "string" ? node.data.title : node.id,
    ]),
  );
  const byStep = new Map<number, WalkFlow[]>();
  for (const edge of graph.edges) {
    const data = flowData(edge);
    if (data.step === undefined) continue;
    const source = titles.get(edge.source) ?? edge.source;
    const target = titles.get(edge.target) ?? edge.target;
    // `a <- b` keeps the written order and only flips the arrowhead (DataFlowEdgeData).
    const back = data.direction === "back";
    const flow: WalkFlow = {
      id: edge.id,
      label: data.label,
      from: back ? target : source,
      to: back ? source : target,
    };
    byStep.set(data.step, [...(byStep.get(data.step) ?? []), flow]);
  }
  return [...byStep.entries()].sort(([a], [b]) => a - b).map(([step, flows]) => ({ step, flows }));
}

/**
 * The nodes the current step lights: both ends of every rendered flow with that step,
 * a collapsed zone's proxy flows included (flow's `collapseGroup` copies `data`).
 */
export function litNodeIds(edges: readonly Edge[], step: number): Set<string> {
  const lit = new Set<string>();
  for (const edge of edges) {
    if (edge.hidden || flowData(edge).step !== step) continue;
    lit.add(edge.source);
    lit.add(edge.target);
  }
  return lit;
}
