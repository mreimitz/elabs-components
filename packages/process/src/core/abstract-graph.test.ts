import { describe, expect, it } from "vitest";

import { abstractGraph } from "./abstract-graph";
import { discoverGraph } from "./discover-graph";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import fixture from "./fixtures/order-to-cash-small.json";
import type { EventLog, ProcessGraph } from "./types";

const orderToCash = fixture as EventLog;
const smallGraph = discoverGraph(orderToCash);
const syntheticGraph = discoverGraph(generateSyntheticLog({ cases: 120, seed: 7 }));

/**
 * Everything reachable from the graph's own start activities, walking its transitions.
 * Deliberately written here rather than imported: the acceptance criterion is a claim
 * about the RETURNED graph, so the test must traverse it independently of the code that
 * produced it.
 */
function reachableFromStart(graph: ProcessGraph): Set<string> {
  const out = new Map<string, string[]>();
  for (const edge of graph.transitions) {
    const bucket = out.get(edge.source);
    if (bucket === undefined) out.set(edge.source, [edge.target]);
    else bucket.push(edge.target);
  }
  const seen = new Set<string>(Object.keys(graph.startActivities));
  const queue = [...seen];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of out.get(queue[head] as string) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** The mirror image: everything that can still get to an end activity. */
function canReachEnd(graph: ProcessGraph): Set<string> {
  const into = new Map<string, string[]>();
  for (const edge of graph.transitions) {
    const bucket = into.get(edge.target);
    if (bucket === undefined) into.set(edge.target, [edge.source]);
    else bucket.push(edge.source);
  }
  const seen = new Set<string>(Object.keys(graph.endActivities));
  const queue = [...seen];
  for (let head = 0; head < queue.length; head += 1) {
    for (const previous of into.get(queue[head] as string) ?? []) {
      if (seen.has(previous)) continue;
      seen.add(previous);
      queue.push(previous);
    }
  }
  return seen;
}

function expectConnected(graph: ProcessGraph): void {
  const fromStart = reachableFromStart(graph);
  const toEnd = canReachEnd(graph);
  const stranded = graph.activities
    .map((activity) => activity.id)
    .filter((id) => !fromStart.has(id) || !toEnd.has(id));
  expect(stranded).toEqual([]);
}

describe("abstractGraph connectivity", () => {
  it("keeps every kept activity between a start and an end at 50/50", () => {
    for (const graph of [smallGraph, syntheticGraph]) {
      const reduced = abstractGraph(graph, { activities: 0.5, paths: 0.5 });
      expect(reduced.activities.length).toBeGreaterThan(0);
      expectConnected(reduced);
    }
  });

  it("holds across the whole slider range, on both fixtures", () => {
    for (const graph of [smallGraph, syntheticGraph]) {
      for (const step of [0, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9, 1]) {
        const reduced = abstractGraph(graph, { activities: step, paths: step });
        expectConnected(reduced);
      }
    }
  });

  it("holds when the reduction is inverted (the rare activities kept)", () => {
    for (const graph of [smallGraph, syntheticGraph]) {
      for (const step of [0.2, 0.5, 0.8]) {
        expectConnected(abstractGraph(graph, { activities: step, paths: step, invert: true }));
      }
    }
  });

  it("leaves islands alone when connectivity repair is switched off", () => {
    // Not a defect — `keepConnected: false` is the "show me literally the top N" view.
    // Asserted so the repair cannot be quietly made unconditional.
    const reduced = abstractGraph(syntheticGraph, {
      activities: 0.4,
      paths: 0.1,
      keepConnected: false,
    });
    const fromStart = reachableFromStart(reduced);
    expect(reduced.activities.some((activity) => !fromStart.has(activity.id))).toBe(true);
  });
});

describe("abstractGraph is a view, not a recomputation", () => {
  it("returns the input's own statistic objects", () => {
    const reduced = abstractGraph(smallGraph, { activities: 0.5, paths: 0.5 });
    for (const activity of reduced.activities) {
      expect(smallGraph.activities).toContain(activity);
    }
    for (const edge of reduced.transitions) {
      expect(smallGraph.transitions).toContain(edge);
    }
    expect(reduced.totals).toBe(smallGraph.totals);
  });

  it("does not mutate the graph it was handed", () => {
    const before = structuredClone(smallGraph);
    abstractGraph(smallGraph, { activities: 0.3, paths: 0.3 });
    abstractGraph(smallGraph, { activities: 0.7, paths: 0.2, invert: true });
    expect(smallGraph).toEqual(before);
  });

  it("reports what it hid, and hides nothing it did not", () => {
    const reduced = abstractGraph(syntheticGraph, { activities: 0.5, paths: 0.5 });
    expect(reduced.hidden.activities).toBe(
      syntheticGraph.activities.length - reduced.activities.length,
    );
    expect(reduced.hidden.paths).toBe(
      syntheticGraph.transitions.length - reduced.transitions.length,
    );
    expect(reduced.hidden.activities).toBeGreaterThan(0);
  });

  it("narrows the start/end tallies to kept activities without changing their counts", () => {
    const reduced = abstractGraph(syntheticGraph, { activities: 0.5, paths: 0.5 });
    const kept = new Set(reduced.activities.map((activity) => activity.id));
    for (const [id, count] of Object.entries(reduced.startActivities)) {
      expect(kept.has(id)).toBe(true);
      expect(count).toBe(syntheticGraph.startActivities[id]);
    }
    for (const [id, count] of Object.entries(reduced.endActivities)) {
      expect(kept.has(id)).toBe(true);
      expect(count).toBe(syntheticGraph.endActivities[id]);
    }
  });
});

describe("abstractGraph identity", () => {
  it("is the identity at { activities: 1, paths: 1 } on both fixtures", () => {
    for (const graph of [smallGraph, syntheticGraph]) {
      const { hidden, ...rest } = abstractGraph(graph, { activities: 1, paths: 1 });
      expect(hidden).toEqual({ activities: 0, paths: 0 });
      expect(rest).toEqual(graph);
    }
  });

  it("is the identity at { activities: 1, paths: 1 } with every other option too", () => {
    for (const options of [
      { keepConnected: false },
      { invert: true },
      { invert: true, keepConnected: false },
    ]) {
      const { hidden, ...rest } = abstractGraph(smallGraph, {
        activities: 1,
        paths: 1,
        ...options,
      });
      expect(hidden).toEqual({ activities: 0, paths: 0 });
      expect(rest).toEqual(smallGraph);
    }
  });

  it("is deterministic — the same input twice gives the same reduced view", () => {
    const first = abstractGraph(syntheticGraph, { activities: 0.35, paths: 0.35 });
    const second = abstractGraph(syntheticGraph, { activities: 0.35, paths: 0.35 });
    expect(second).toEqual(first);
  });
});

describe("abstractGraph ranking", () => {
  it("keeps the activities most cases touch, ranked by `cases` not `instances`", () => {
    const reduced = abstractGraph(smallGraph, { activities: 0.5, paths: 1, keepConnected: false });
    // 8 activities × 0.5, rounded → 4. Counted from the fixture: Check Credit and Create
    // Order touch all 5 cases; Approve Order, Receive Payment, Send Invoice and Ship Order
    // touch 4 each with 4 instances each, so that four-way tie is broken by NAME and the
    // first two of them win. Check Credit has 6 instances to Create Order's 5 — irrelevant
    // here, which is the point: `cases` ranks first, so a looping step cannot buy its way
    // up the list by repeating inside one case.
    expect(reduced.activities.map((activity) => activity.id).sort()).toEqual([
      "Approve Order",
      "Check Credit",
      "Create Order",
      "Receive Payment",
    ]);
  });

  it("never empties the graph, whatever the slider says", () => {
    const reduced = abstractGraph(smallGraph, { activities: 0, paths: 0, keepConnected: false });
    expect(reduced.activities.length).toBe(1);
    expect(reduced.transitions).toEqual([]);
  });

  it("reads a non-finite fraction as `keep everything`", () => {
    const reduced = abstractGraph(smallGraph, { activities: Number.NaN, paths: Number.NaN });
    expect(reduced.hidden).toEqual({ activities: 0, paths: 0 });
  });
});
