/**
 * Worked example — a resource-handover network computed from a raw event log (RM-068,
 * issue #222; roadmap finding §4 R20: "handover / social network between resources").
 *
 * REFERENCE IMPLEMENTATION — copy it into your app; nothing in this repo runs it. It
 * imports NOTHING from `@elabs-ai/components-process` on purpose: a handover network is a
 * general "who hands off to whom" graph over any log with a case id, an activity and a
 * resource, and `@elabs-ai/components-flow` already draws exactly that shape with
 * `layoutGraph({ algorithm: "force" })` + `FlowWeightedEdge` — so this is a recipe, not a
 * new component, per R20's own "reuse" instruction.
 *
 * See ./README.md for the aggregation this file implements and how to layer resource-role
 * colouring on top with `useFlowGroups`/`Legend` if your app already has one.
 *
 * Assumes your app root already imports the React Flow stylesheet once, per
 * `@elabs-ai/components-flow`'s own barrel docblock (`import "@xyflow/react/dist/style.css"`)
 * — this file does not import it again.
 */
import { useMemo } from "react";
import { useEdgesState, useNodesState, type Edge } from "@xyflow/react";
import {
  CanvasShell,
  FlowNode,
  FlowWeightedEdge,
  layoutGraph,
  ZoomControls,
  type BrandFlowNode,
  type FlowWeightedEdgeData,
} from "@elabs-ai/components-flow";

/**
 * The minimal event-log row this recipe needs. Deliberately NOT
 * `@elabs-ai/components-process`'s `EventRow`/`EventLog` — this file has zero dependency
 * on the process package, so it works for a host app that never installs it.
 */
export interface HandoverEventRow {
  caseId: string;
  activity: string;
  resource: string;
  /** Anything `Date` can order — a raw log's own timestamp column. */
  timestamp: string | number | Date;
}

/** One resource pair's interaction count — the edge weight `FlowWeightedEdge` reads. */
export interface HandoverPair {
  from: string;
  to: string;
  count: number;
}

/** Joins `from`/`to` into one map key without colliding with either resource name. */
function pairKey(from: string, to: string): string {
  return JSON.stringify([from, to]);
}

/**
 * Resource × resource interaction counts: within each case, sort its events by timestamp,
 * then count one handover per CONSECUTIVE pair of events whose resource differs. Summed
 * across every case — i.e. case-weighted: a case that hands off A→B→A twice contributes 2
 * to A→B and 1 to B→A, never collapsed to "did this pair occur".
 */
export function computeHandoverPairs(rows: readonly HandoverEventRow[]): HandoverPair[] {
  const byCase = new Map<string, HandoverEventRow[]>();
  for (const row of rows) {
    const bucket = byCase.get(row.caseId);
    if (bucket) bucket.push(row);
    else byCase.set(row.caseId, [row]);
  }

  const counts = new Map<string, number>();
  for (const events of byCase.values()) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]?.resource;
      const to = sorted[i + 1]?.resource;
      if (!from || !to || from === to) continue;
      const key = pairKey(from, to);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([key, count]) => {
    const [from, to] = JSON.parse(key) as [string, string];
    return { from, to, count };
  });
}

const NODE_TYPES = { brand: FlowNode };
const EDGE_TYPES = { weighted: FlowWeightedEdge };

/** Every edge in one network shares this group, so the width scale is min-maxed once. */
const HANDOVER_SCALE_GROUP = "handover-network";
const FORCE_LAYOUT_ITERATIONS = 250;

/**
 * Lays a handover network out with `flow`'s own `layoutGraph({ algorithm: "force" })` —
 * the reuse R20 asks for, rather than a bespoke layout — and draws every pair with
 * `FlowWeightedEdge` so the count is a stroke width AND a printed pill before it is a tint,
 * never colour alone (WCAG 1.4.1).
 */
export function HandoverNetwork({ rows }: { rows: readonly HandoverEventRow[] }) {
  const pairs = useMemo(() => computeHandoverPairs(rows), [rows]);

  const seedNodes = useMemo<BrandFlowNode[]>(() => {
    const resources = [...new Set(pairs.flatMap((pair) => [pair.from, pair.to]))];
    return resources.map((resource, index) => ({
      id: resource,
      type: "brand",
      // An arbitrary seed grid — `layoutGraph`'s force pass below is what actually
      // places these; only the id/data matter here.
      position: { x: (index % 5) * 220, y: Math.floor(index / 5) * 160 },
      data: { kind: "Resource", title: resource },
    }));
  }, [pairs]);

  const seedEdges = useMemo<Edge[]>(
    () =>
      pairs.map((pair) => ({
        id: `${pair.from}->${pair.to}`,
        source: pair.from,
        target: pair.to,
        type: "weighted",
      })),
    [pairs],
  );

  const laidOutNodes = useMemo(
    () =>
      layoutGraph(seedNodes, seedEdges, {
        algorithm: "force",
        iterations: FORCE_LAYOUT_ITERATIONS,
      }),
    [seedNodes, seedEdges],
  );

  const laidOutEdges = useMemo<Edge<FlowWeightedEdgeData>[]>(() => {
    const maxCount = Math.max(1, ...pairs.map((pair) => pair.count));
    return pairs.map((pair) => ({
      id: `${pair.from}->${pair.to}`,
      source: pair.from,
      target: pair.to,
      type: "weighted",
      data: {
        weight: pair.count,
        scaleGroup: HANDOVER_SCALE_GROUP,
        // A second, redundant tint channel — the count is already the stroke width and
        // the printed pill; see this file's own docblock.
        value: pair.count,
        valueDomain: [1, maxCount],
        label: String(pair.count),
      },
    }));
  }, [pairs]);

  const [nodes, , onNodesChange] = useNodesState(laidOutNodes);
  const [edges, , onEdgesChange] = useEdgesState(laidOutEdges);

  return (
    <div className="h-[560px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}
