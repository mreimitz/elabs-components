import { describe, expect, it } from "vitest";
import { EMPTY_DURATION_STATS } from "./duration-stats";
import { reconcileGraph } from "./reconcile-graph";
import type { AbstractedGraph } from "./abstract-graph";
import type { ActivityStats, ProcessGraph, TransitionStats } from "./types";

const DURATION = {
  min: 1,
  max: 10,
  mean: 5,
  median: 5,
  p90: 9,
  sum: 50,
  trimmedMean: 5,
};

function activity(id: string, overrides: Partial<ActivityStats> = {}): ActivityStats {
  return {
    id,
    label: id,
    instances: 10,
    cases: 5,
    isStart: false,
    isEnd: false,
    duration: DURATION,
    ...overrides,
  };
}

function transition(
  source: string,
  target: string,
  overrides: Partial<TransitionStats> = {},
): TransitionStats {
  return {
    source,
    target,
    count: 10,
    caseCount: 5,
    duration: DURATION,
    isSelfLoop: source === target,
    isBackEdge: false,
    ...overrides,
  };
}

function graph(overrides: Partial<ProcessGraph> = {}): ProcessGraph {
  return {
    activities: [],
    transitions: [],
    startActivities: {},
    endActivities: {},
    totals: { cases: 0, events: 0, variants: 0 },
    ...overrides,
  };
}

describe("reconcileGraph", () => {
  it("is the identity when filtered is deep-equal to presented (no filter applied)", () => {
    const presented = graph({
      activities: [activity("A", { isStart: true }), activity("B", { isEnd: true })],
      transitions: [transition("A", "B")],
      startActivities: { A: 5 },
      endActivities: { B: 5 },
      totals: { cases: 5, events: 10, variants: 1 },
    });
    // A structurally distinct but deep-equal graph, as a fresh discoverGraph(log) call with
    // no active filter would actually produce.
    const filtered = graph({
      activities: [activity("A", { isStart: true }), activity("B", { isEnd: true })],
      transitions: [transition("A", "B")],
      startActivities: { A: 5 },
      endActivities: { B: 5 },
      totals: { cases: 5, events: 10, variants: 1 },
    });

    const result = reconcileGraph(presented, filtered);

    expect(result.graph).toEqual(presented);
    expect(result.excludedActivities).toEqual([]);
    expect(result.excludedTransitions).toEqual([]);
  });

  it("ghosts an activity the filter dropped: same id, every count zeroed", () => {
    const presented = graph({
      activities: [
        activity("A", { isStart: true, instances: 10, cases: 5 }),
        activity("B", { instances: 3, cases: 2 }),
      ],
      transitions: [transition("A", "B", { count: 3, caseCount: 2 })],
      totals: { cases: 5, events: 13, variants: 2 },
    });
    // The filter kept only "A" — "B" (and its edge) did not survive.
    const filtered = graph({
      activities: [activity("A", { isStart: true, instances: 10, cases: 5 })],
      transitions: [],
      startActivities: { A: 5 },
      totals: { cases: 5, events: 10, variants: 1 },
    });

    const {
      graph: reconciled,
      excludedActivities,
      excludedTransitions,
    } = reconcileGraph(presented, filtered);

    // Invariant F: the element set is unchanged — "B" is still on the map.
    expect(reconciled.activities.map((a) => a.id)).toEqual(["A", "B"]);
    expect(reconciled.transitions).toHaveLength(1);

    const ghost = reconciled.activities.find((a) => a.id === "B")!;
    expect(ghost.instances).toBe(0);
    expect(ghost.cases).toBe(0);
    expect(ghost.isStart).toBe(false);
    expect(ghost.isEnd).toBe(false);
    expect(ghost.duration).toEqual(EMPTY_DURATION_STATS);

    const ghostEdge = reconciled.transitions[0]!;
    expect(ghostEdge.source).toBe("A");
    expect(ghostEdge.target).toBe("B");
    expect(ghostEdge.count).toBe(0);
    expect(ghostEdge.caseCount).toBe(0);
    expect(ghostEdge.duration).toEqual(EMPTY_DURATION_STATS);

    expect(excludedActivities).toEqual(["B"]);
    expect(excludedTransitions).toEqual([`AB`]);
  });

  it("takes startActivities, endActivities and totals from the FILTERED graph", () => {
    const presented = graph({
      activities: [activity("A"), activity("B")],
      startActivities: { A: 5, B: 1 },
      endActivities: { B: 5, A: 1 },
      totals: { cases: 5, events: 20, variants: 3 },
    });
    const filtered = graph({
      activities: [activity("A")],
      startActivities: { A: 2 },
      endActivities: { A: 2 },
      totals: { cases: 2, events: 4, variants: 1 },
    });

    const { graph: reconciled } = reconcileGraph(presented, filtered);

    expect(reconciled.startActivities).toEqual({ A: 2 });
    expect(reconciled.endActivities).toEqual({ A: 2 });
    expect(reconciled.totals).toEqual({ cases: 2, events: 4, variants: 1 });
  });

  it("preserves a surviving element's structural fields (isSelfLoop / isBackEdge) even when zeroed", () => {
    // A ghosted transition still carries its structural shape — only its statistics zero.
    const presented = graph({
      activities: [activity("A")],
      transitions: [transition("A", "A", { isBackEdge: true, count: 4, caseCount: 4 })],
    });
    const filtered = graph({ activities: [activity("A")], transitions: [] });

    const { graph: reconciled } = reconcileGraph(presented, filtered);
    const ghostEdge = reconciled.transitions[0]!;
    expect(ghostEdge.isSelfLoop).toBe(true);
    expect(ghostEdge.isBackEdge).toBe(true);
    expect(ghostEdge.count).toBe(0);
  });

  it("passes an extra field on G (AbstractedGraph.hidden) through untouched", () => {
    const presented: AbstractedGraph = {
      ...graph({ activities: [activity("A"), activity("B")] }),
      hidden: { activities: 3, paths: 1 },
    };
    const filtered = graph({ activities: [activity("A")] });

    const { graph: reconciled } = reconcileGraph(presented, filtered);
    expect(reconciled.hidden).toEqual({ activities: 3, paths: 1 });
  });
});
