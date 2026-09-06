import { describe, expect, it } from "vitest";
import { abstractGraph } from "../core/abstract-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { discoverGraph } from "../core/discover-graph";
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";
import { computeAutoAbstraction } from "./auto-abstraction";

function keptCount(total: number, fraction: number): number {
  return Math.max(1, Math.round(total * fraction));
}

const ZERO_DURATION: DurationStats = {
  min: 0,
  max: 0,
  mean: 0,
  median: 0,
  p90: 0,
  sum: 0,
  trimmedMean: 0,
};

/**
 * A single, unbranched activity chain — `size` activities, `size - 1` directly-follows
 * edges, strictly decreasing frequency along the chain, NO skip/bypass paths, no loops.
 * Neither shipped fixture reaches this module's own real >25-activity failure mode
 * (`generateSyntheticLog`'s vocabulary is 11 activities; `generateBpi2012Subset`'s is 19),
 * so this is a purpose-built minimal graph for it — mirrors the `largeGraph()` helper in
 * `process-map.stories.tsx`, but WITHOUT that helper's skip-path edges, which is exactly
 * the property this fixture needs: a bypass edge would let `abstractGraph`'s connectivity
 * repair route AROUND a dropped activity instead of being forced to restore it.
 */
function chainGraph(size: number): ProcessGraph {
  const ids = Array.from({ length: size }, (_, i) => `Step ${String(i + 1).padStart(2, "0")}`);
  const activities: ActivityStats[] = ids.map((id, index) => ({
    id,
    label: id,
    instances: size - index,
    cases: size - index,
    isStart: index === 0,
    isEnd: index === size - 1,
    duration: ZERO_DURATION,
  }));
  const transitions: TransitionStats[] = [];
  for (let i = 0; i < ids.length - 1; i += 1) {
    transitions.push({
      source: ids[i]!,
      target: ids[i + 1]!,
      count: size - i,
      caseCount: size - i,
      duration: ZERO_DURATION,
      isSelfLoop: false,
      isBackEdge: false,
    });
  }
  return {
    activities,
    transitions,
    startActivities: { [ids[0]!]: size },
    endActivities: { [ids[size - 1]!]: size },
    totals: { cases: size, events: size * 2, variants: 1 },
  };
}

describe("computeAutoAbstraction — the bound (terminates in at most maxSteps probes)", () => {
  it("never exceeds maxSteps regardless of how large the graph is", () => {
    const result = computeAutoAbstraction(1000, { maxActivities: 25, maxSteps: 8 });
    expect(result.steps).toBeLessThanOrEqual(8);
  });

  it("a graph already within budget needs zero probes", () => {
    const result = computeAutoAbstraction(10, { maxActivities: 25 });
    expect(result).toEqual({ activities: 1, steps: 0 });
  });

  it("a graph too large even at the floor fraction needs exactly one probe", () => {
    const result = computeAutoAbstraction(100_000, { maxActivities: 5, minFraction: 0.05 });
    expect(result).toEqual({ activities: 0.05, steps: 1 });
  });

  it("is deterministic — the same count and options always return the same fraction", () => {
    const first = computeAutoAbstraction(200, { maxActivities: 25 });
    const second = computeAutoAbstraction(200, { maxActivities: 25 });
    expect(second).toEqual(first);
  });
});

describe("computeAutoAbstraction — the result actually fits the budget", () => {
  it("the returned fraction keeps at most maxActivities, on a graph that needs the full search budget", () => {
    // 200 activities, budget 25: the floor (5% -> 10 activities) fits, so the search runs
    // its full 8 probes rather than short-circuiting on either edge case above.
    const result = computeAutoAbstraction(200, { maxActivities: 25, maxSteps: 8 });
    expect(result.steps).toBe(8);
    expect(keptCount(200, result.activities)).toBeLessThanOrEqual(25);
  });

  it("converges toward the LARGEST fitting fraction, not the smallest (60-activity graph)", () => {
    const coarse = computeAutoAbstraction(60, { maxActivities: 10, maxSteps: 2 });
    const fine = computeAutoAbstraction(60, { maxActivities: 10, maxSteps: 8 });
    expect(keptCount(60, coarse.activities)).toBeLessThanOrEqual(10);
    expect(keptCount(60, fine.activities)).toBeLessThanOrEqual(10);
    // More probes never do WORSE than fewer — the search only tightens toward the budget,
    // it never wanders away from a fraction it already confirmed fits.
    expect(fine.activities).toBeGreaterThanOrEqual(coarse.activities);
    // And it isn't the degenerate "smallest fraction that fits" reading: the floor (0.05 ->
    // 3 activities) is far below what an 8-step search settles on for a 10-activity budget.
    expect(keptCount(60, fine.activities)).toBeGreaterThan(3);
  });
});

describe("computeAutoAbstraction — a real, large fixture (the roadmap's 13 000-case log)", () => {
  it("handles the 13k-case synthetic fixture's discovered graph without hanging or exceeding the bound", () => {
    const log = generateSyntheticLog({ cases: 13_000, seed: 1 });
    const graph = discoverGraph(log);
    const result = computeAutoAbstraction(graph.activities.length, {
      maxActivities: 25,
      maxSteps: 8,
    });
    expect(result.steps).toBeLessThanOrEqual(8);
    expect(keptCount(graph.activities.length, result.activities)).toBeLessThanOrEqual(25);
    // The synthetic order-to-cash vocabulary is small (8 activities) — already inside any
    // reasonable budget, so "Auto" is correctly a no-op here. This locks that no-op shape;
    // it does NOT exercise the search against a graph that genuinely exceeds the budget —
    // that is what the two describe blocks below are for.
    expect(graph.activities.length).toBeLessThanOrEqual(25);
    expect(result).toEqual({ activities: 1, steps: 0 });
  });
});

describe("computeAutoAbstraction — a fixture that actually exceeds the budget (RM-052 round 2, #227, F2)", () => {
  it("on a 30-activity chain, the naive prediction fits maxActivities exactly", () => {
    // This is the module's own promise, restated against a real >25-activity graph rather
    // than the always-under-budget fixture above. It is NOT a claim about `abstractGraph`'s
    // real output — see the next describe block for why those two numbers diverge here.
    const graph = chainGraph(30);
    const result = computeAutoAbstraction(graph.activities.length, {
      maxActivities: 10,
      maxSteps: 8,
    });
    expect(keptCount(graph.activities.length, result.activities)).toBeLessThanOrEqual(10);
  });
});

describe("computeAutoAbstraction — known limitation: connectivity repair can blow the naive budget (RM-052 round 2, #227, F2)", () => {
  // `computeAutoAbstraction` predicts a fraction from activity COUNT alone; it has no
  // visibility into the graph's TOPOLOGY. `abstractGraph`'s default `keepConnected: true`
  // adds activities back to restore reachability to a start/end activity that truncation
  // would otherwise strand. On a graph with no bypass edges — a strict chain, where every
  // activity's only path to the end activity runs through every activity after it —
  // dropping ANY suffix forces the entire remainder back in, so the real kept count can
  // land far above what the naive prediction promised. This is a documented, accepted
  // best-effort gap (see the module docblock), not a bug this test is asserting has been
  // fixed — it locks the exact divergence so a future change to either `computeAutoAbstraction`
  // or `abstractGraph`'s reconnection heuristic must consciously re-measure it.
  it("keepConnected:true reconnects the whole chain — the real kept count blows past maxActivities", () => {
    const graph = chainGraph(30);
    const result = computeAutoAbstraction(graph.activities.length, {
      maxActivities: 10,
      maxSteps: 8,
    });
    expect(keptCount(graph.activities.length, result.activities)).toBeLessThanOrEqual(10);

    const abstracted = abstractGraph(graph, {
      activities: result.activities,
      paths: 1,
      keepConnected: true,
    });

    // The naive prediction said 10 activities would remain; connectivity repair on a
    // graph with no bypass paths instead restores every activity in the chain.
    expect(abstracted.activities.length).toBe(30);
    expect(abstracted.activities.length).toBeGreaterThan(10);
    expect(abstracted.hidden.activities).toBe(0);
  });

  it("keepConnected:false matches the naive prediction exactly — isolating connectivity repair as the sole cause", () => {
    const graph = chainGraph(30);
    const result = computeAutoAbstraction(graph.activities.length, {
      maxActivities: 10,
      maxSteps: 8,
    });

    const abstracted = abstractGraph(graph, {
      activities: result.activities,
      paths: 1,
      keepConnected: false,
    });

    // With reconnection disabled, the real result matches this module's own naive mirror
    // exactly — proving the divergence above comes SPECIFICALLY from `keepConnected`'s
    // reachability repair, not from some more general inaccuracy in the heuristic.
    expect(abstracted.activities.length).toBe(
      keptCount(graph.activities.length, result.activities),
    );
    expect(abstracted.activities.length).toBeLessThanOrEqual(10);
  });
});
