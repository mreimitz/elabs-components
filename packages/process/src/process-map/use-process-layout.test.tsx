import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";
import { buildProcessMapModel, processGraphStructureKey } from "./map-model";
import { applyLayoutSnapshot, useProcessLayout } from "./use-process-layout";

afterEach(cleanup);

const EMPTY_DURATION: DurationStats = {
  min: 0,
  max: 0,
  mean: 0,
  median: 0,
  p90: 0,
  sum: 0,
  trimmedMean: 0,
};

function activity(id: string, index: number, total: number): ActivityStats {
  return {
    id,
    label: id,
    instances: total - index,
    cases: total - index,
    isStart: index === 0,
    isEnd: index === total - 1,
    duration: { ...EMPTY_DURATION },
  };
}

function transition(source: string, target: string, count: number): TransitionStats {
  return {
    source,
    target,
    count,
    caseCount: count,
    duration: { ...EMPTY_DURATION },
    isSelfLoop: source === target,
    isBackEdge: false,
  };
}

/** A synthetic chain of `size` activities — the shape the 60-node budget is stated over. */
function chainGraph(size: number): ProcessGraph {
  const ids = Array.from({ length: size }, (_, i) => `Activity ${i + 1}`);
  const transitions: TransitionStats[] = [];
  for (let i = 0; i < ids.length - 1; i += 1) {
    transitions.push(transition(ids[i]!, ids[i + 1]!, size - i));
    // A second, skipping path so the layout has real width to solve, not a straight line.
    if (i + 2 < ids.length)
      transitions.push(transition(ids[i]!, ids[i + 2]!, Math.max(1, size - i - 3)));
  }
  return {
    activities: ids.map((id, index) => activity(id, index, size)),
    transitions,
    startActivities: { [ids[0]!]: size },
    endActivities: { [ids[ids.length - 1]!]: size },
    totals: { cases: size, events: size * 2, variants: 2 },
  };
}

const graph = chainGraph(60);
const structureKey = processGraphStructureKey(graph);

function modelFor(metric: "absolute" | "absolute_case") {
  return buildProcessMapModel({ graph, metric: { node: metric, edge: metric } });
}

describe("useProcessLayout", () => {
  it("lays out once on mount, without waiting for the debounce", async () => {
    const model = modelFor("absolute");
    const { result } = renderHook(() =>
      useProcessLayout({ nodes: model.nodes, edges: model.edges, structureKey, direction: "TB" }),
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    expect(result.current.nodes).toHaveLength(graph.activities.length);
  });

  it("positions every node — the layout is applied, not merely computed", async () => {
    const model = modelFor("absolute");
    const { result } = renderHook(() =>
      useProcessLayout({ nodes: model.nodes, edges: model.edges, structureKey, direction: "TB" }),
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    const distinct = new Set(result.current.nodes.map((n) => `${n.position.x}:${n.position.y}`));
    expect(distinct.size).toBe(graph.activities.length);
  });

  it("does NOT re-run layoutFlow for a metric-only change (the cache-hit criterion)", async () => {
    const first = modelFor("absolute");
    const { result, rerender } = renderHook(
      ({ nodes, edges }) => useProcessLayout({ nodes, edges, structureKey, direction: "TB" }),
      { initialProps: { nodes: first.nodes, edges: first.edges } },
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    const positionsBefore = result.current.nodes.map(
      (n) => `${n.id}:${n.position.x},${n.position.y}`,
    );

    // A metric switch produces entirely NEW node objects with the SAME structure.
    const second = modelFor("absolute_case");
    expect(second.nodes[0]).not.toBe(first.nodes[0]);
    rerender({ nodes: second.nodes, edges: second.edges });

    await waitFor(() =>
      expect(result.current.nodes[0]!.data.metricLabel).toBe(second.nodes[0]!.data.metricLabel),
    );
    expect(result.current.layoutRuns).toBe(1);
    expect(result.current.nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`)).toEqual(
      positionsBefore,
    );
  });

  it("re-runs layout when the STRUCTURE changes, after the debounce", async () => {
    const first = modelFor("absolute");
    const smallerGraph = chainGraph(12);
    const smaller = buildProcessMapModel({
      graph: smallerGraph,
      metric: { node: "absolute", edge: "absolute" },
    });
    const { result, rerender } = renderHook(
      ({ nodes, edges, key }) =>
        useProcessLayout({ nodes, edges, structureKey: key, direction: "TB", debounceMs: 10 }),
      { initialProps: { nodes: first.nodes, edges: first.edges, key: structureKey } },
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));

    rerender({
      nodes: smaller.nodes,
      edges: smaller.edges,
      key: processGraphStructureKey(smallerGraph),
    });
    await waitFor(() => expect(result.current.layoutRuns).toBe(2));
    expect(result.current.nodes).toHaveLength(12);
  });

  it("re-runs layout for a direction change, and caches each direction separately", async () => {
    const model = modelFor("absolute");
    const { result, rerender } = renderHook(
      ({ direction }: { direction: "TB" | "LR" }) =>
        useProcessLayout({
          nodes: model.nodes,
          edges: model.edges,
          structureKey,
          direction,
          debounceMs: 0,
        }),
      { initialProps: { direction: "TB" as "TB" | "LR" } },
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    rerender({ direction: "LR" });
    await waitFor(() => expect(result.current.layoutRuns).toBe(2));
    rerender({ direction: "TB" });
    // Back to a key already in the cache — no third dagre run.
    await waitFor(() => expect(result.current.nodes.length).toBe(graph.activities.length));
    expect(result.current.layoutRuns).toBe(2);
  });

  it("lays a 60-node graph out in under 200 ms", async () => {
    const model = modelFor("absolute");
    const { result } = renderHook(() =>
      useProcessLayout({ nodes: model.nodes, edges: model.edges, structureKey, direction: "TB" }),
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    expect(graph.activities).toHaveLength(60);
    expect(result.current.lastLayoutMs).toBeLessThan(200);
  });

  it("reports back-edges and self-loops so the edge component can change SHAPE", async () => {
    const withLoop: ProcessGraph = {
      ...graph,
      transitions: [
        ...graph.transitions,
        transition("Activity 3", "Activity 3", 4),
        transition("Activity 5", "Activity 2", 3),
      ],
    };
    const model = buildProcessMapModel({
      graph: withLoop,
      metric: { node: "absolute", edge: "absolute" },
    });
    const { result } = renderHook(() =>
      useProcessLayout({
        nodes: model.nodes,
        edges: model.edges,
        structureKey: processGraphStructureKey(withLoop),
        direction: "TB",
      }),
    );
    await waitFor(() => expect(result.current.layoutRuns).toBe(1));
    expect(result.current.selfLoopIds.size).toBeGreaterThan(0);
    expect(result.current.backEdgeIds.size).toBeGreaterThan(0);
  });

  it("renders an empty graph without laying anything out", async () => {
    const { result } = renderHook(() =>
      useProcessLayout({ nodes: [], edges: [], structureKey: "", direction: "TB" }),
    );
    await act(async () => {});
    expect(result.current.layoutRuns).toBe(0);
    expect(result.current.pending).toBe(false);
  });
});

describe("applyLayoutSnapshot", () => {
  it("matches positions on id, so fresh node objects keep their place", () => {
    const model = modelFor("absolute");
    const snapshot = {
      positions: { [model.nodes[0]!.id]: { x: 42, y: 99 } },
      sourcePosition: {},
      targetPosition: {},
      backEdges: [],
      selfLoops: [],
      durationMs: 0,
    };
    const applied = applyLayoutSnapshot(model.nodes, snapshot);
    expect(applied[0]!.position).toEqual({ x: 42, y: 99 });
    // A node the snapshot does not know is returned untouched, not dropped.
    expect(applied).toHaveLength(model.nodes.length);
    expect(applied[1]).toBe(model.nodes[1]);
  });
});
