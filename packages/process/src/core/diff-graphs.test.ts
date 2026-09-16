import { describe, expect, it } from "vitest";
import { diffGraphs } from "./diff-graphs";
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

describe("diffGraphs", () => {
  it("marks every entry common with delta 0 on two identical graphs", () => {
    const a = graph({
      activities: [activity("Create", { isStart: true }), activity("Ship", { isEnd: true })],
      transitions: [transition("Create", "Ship")],
    });
    const b = graph({
      activities: [activity("Create", { isStart: true }), activity("Ship", { isEnd: true })],
      transitions: [transition("Create", "Ship")],
    });

    const diff = diffGraphs(a, b);

    expect(diff.activities).toHaveLength(2);
    for (const entry of diff.activities) {
      expect(entry.state).toBe("common");
      expect(entry.delta).toBe(0);
      expect(entry.ratio).toBe(1);
    }
    expect(diff.transitions).toHaveLength(1);
    expect(diff.transitions[0]!.state).toBe("common");
    expect(diff.transitions[0]!.delta).toBe(0);
  });

  it("marks every entry aOnly or bOnly on fully disjoint graphs", () => {
    const a = graph({
      activities: [activity("Create")],
      transitions: [transition("Create", "Create")],
    });
    const b = graph({
      activities: [activity("Cancel")],
      transitions: [transition("Cancel", "Cancel")],
    });

    const diff = diffGraphs(a, b);

    expect(diff.activities).toHaveLength(2);
    // A one-sided entry never sets its ABSENT side's key at all (no `b: undefined` noise) —
    // check presence/absence directly rather than via `toMatchObject`, which treats an
    // expected `undefined` value inconsistently with a genuinely missing key.
    const createEntry = diff.activities.find((e) => e.id === "Create");
    expect(createEntry).toMatchObject({ state: "aOnly", a: expect.any(Object) });
    expect(createEntry?.b).toBeUndefined();
    expect(createEntry?.delta).toBeUndefined();
    const cancelEntry = diff.activities.find((e) => e.id === "Cancel");
    expect(cancelEntry).toMatchObject({ state: "bOnly", b: expect.any(Object) });
    expect(cancelEntry?.a).toBeUndefined();
    expect(cancelEntry?.delta).toBeUndefined();
    expect(diff.transitions).toHaveLength(2);
    for (const entry of diff.transitions) {
      expect(["aOnly", "bOnly"]).toContain(entry.state);
      expect(entry.delta).toBeUndefined();
    }
  });

  it("computes delta and ratio for a common entry whose value changed", () => {
    const a = graph({ activities: [activity("Create", { instances: 20 })] });
    const b = graph({ activities: [activity("Create", { instances: 30 })] });

    const diff = diffGraphs(a, b);

    expect(diff.activities[0]).toMatchObject({ state: "common", delta: 10, ratio: 1.5 });
  });

  it("omits ratio (never Infinity) when a's reference value is zero", () => {
    const a = graph({ activities: [activity("Create", { instances: 0 })] });
    const b = graph({ activities: [activity("Create", { instances: 5 })] });

    const diff = diffGraphs(a, b);

    expect(diff.activities[0]!.delta).toBe(5);
    expect(diff.activities[0]!.ratio).toBeUndefined();
  });

  it("carries each side's own totals through untouched", () => {
    const a = graph({ totals: { cases: 3, events: 9, variants: 1 } });
    const b = graph({ totals: { cases: 7, events: 21, variants: 2 } });

    const diff = diffGraphs(a, b);

    expect(diff.totals).toEqual({
      a: { cases: 3, events: 9, variants: 1 },
      b: { cases: 7, events: 21, variants: 2 },
    });
  });

  it("keys a transition by source+target, not by object identity", () => {
    const a = graph({ transitions: [transition("A", "B", { count: 4 })] });
    const b = graph({ transitions: [transition("A", "B", { count: 9 })] });

    const diff = diffGraphs(a, b);

    expect(diff.transitions).toHaveLength(1);
    expect(diff.transitions[0]).toMatchObject({ state: "common", delta: 5 });
  });
});
