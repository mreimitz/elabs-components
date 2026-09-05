import { describe, expect, it } from "vitest";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { discoverGraph } from "../core/discover-graph";
import { computeAutoAbstraction } from "./auto-abstraction";

function keptCount(total: number, fraction: number): number {
  return Math.max(1, Math.round(total * fraction));
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
    // reasonable budget, so "Auto" is correctly a no-op here. The bound and the fit are
    // what this test is proving, not a particular fraction.
    expect(graph.activities.length).toBeLessThanOrEqual(25);
    expect(result).toEqual({ activities: 1, steps: 0 });
  });
});
