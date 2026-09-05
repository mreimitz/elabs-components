import { describe, expect, it } from "vitest";

import { aggregatePerformance, DURATION_UNIT_MS, performanceValue } from "./aggregate-performance";
import { discoverGraph, EDGE_KEY_SEPARATOR } from "./discover-graph";
import { normalizeLog } from "./event-log";
import type { DurationStats, EventLog } from "./types";

const MINUTE = 60_000;

/**
 * Two cases, atomic events, one edge A→B whose gaps are 1 and 3 minutes.
 *
 * Small enough that every expected number below is arithmetic anyone can redo: the edge's
 * samples are [60000, 180000], so median 120000, min 60000, max 180000, sum 240000.
 */
const twoGaps: EventLog = {
  events: [
    { caseId: "c1", activity: "A", timestamp: 0 },
    { caseId: "c1", activity: "B", timestamp: MINUTE },
    { caseId: "c2", activity: "A", timestamp: 0 },
    { caseId: "c2", activity: "B", timestamp: 3 * MINUTE },
  ],
};

/** One case of INTERVAL events, where waiting time and cycle time genuinely differ. */
const interval: EventLog = {
  events: [
    { caseId: "c1", activity: "A", startTimestamp: 0, timestamp: 30_000 },
    { caseId: "c1", activity: "B", startTimestamp: MINUTE, timestamp: 90_000 },
  ],
};

const edgeKey = (source: string, target: string): string =>
  `${source}${EDGE_KEY_SEPARATOR}${target}`;

describe("performanceValue", () => {
  const stats: DurationStats = {
    min: 1,
    max: 7,
    mean: 3,
    median: 2,
    p90: 6,
    sum: 12,
    trimmedMean: 4,
  };

  it("maps every aggregate name to its own member", () => {
    expect(performanceValue(stats, "min")).toBe(1);
    expect(performanceValue(stats, "max")).toBe(7);
    expect(performanceValue(stats, "mean")).toBe(3);
    expect(performanceValue(stats, "median")).toBe(2);
    expect(performanceValue(stats, "p90")).toBe(6);
    expect(performanceValue(stats, "sum")).toBe(12);
    // The snake_case wire spelling of `trimmedMean` — the mapping that is easy to get
    // wrong and impossible to notice, because every value is a plausible duration.
    expect(performanceValue(stats, "trimmed_mean")).toBe(4);
  });
});

describe("aggregatePerformance unit conversion", () => {
  const graph = discoverGraph(twoGaps);

  it("converts every member of every DurationStats, not only the selected one", () => {
    const layered = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "idle_time",
      unit: "min",
    });
    const edge = layered.transitions.find((t) => t.source === "A" && t.target === "B");
    const duration = edge?.duration as DurationStats;
    // Member by member, and with a tolerance: a unit conversion is a float multiply, so
    // p90 lands on 2.8000000000000003 and asserting the decimal literal would be a test
    // that fails for the wrong reason.
    const expected: DurationStats = {
      min: 1,
      max: 3,
      mean: 2,
      median: 2,
      p90: 2.8,
      sum: 4,
      trimmedMean: 2,
    };
    for (const key of Object.keys(expected) as (keyof DurationStats)[]) {
      expect(duration[key]).toBeCloseTo(expected[key], 9);
    }
  });

  it("exposes the selected aggregate per element, in the requested unit", () => {
    for (const [unit, divisor] of Object.entries(DURATION_UNIT_MS)) {
      const layered = aggregatePerformance(graph, {
        agg: "max",
        flowTime: "idle_time",
        unit: unit as keyof typeof DURATION_UNIT_MS,
      });
      expect(layered.performance.transitions[edgeKey("A", "B")]).toBeCloseTo(
        (3 * MINUTE) / divisor,
        9,
      );
    }
  });

  it("reports the domains a scale needs", () => {
    const layered = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "idle_time",
      unit: "min",
    });
    expect(layered.performance.transitionDomain).toEqual([2, 2]);
    // Atomic events have no execution time of their own, so every activity measures zero.
    expect(layered.performance.activityDomain).toEqual([0, 0]);
  });

  it("echoes the settings it was driven with, so a legend can read them back", () => {
    const layered = aggregatePerformance(graph, {
      agg: "p90",
      flowTime: "inter_start_time",
      unit: "h",
    });
    expect(layered.performance.agg).toBe("p90");
    expect(layered.performance.flowTime).toBe("inter_start_time");
    expect(layered.performance.unit).toBe("h");
  });

  it("does not mutate the graph it was handed", () => {
    const before = structuredClone(graph);
    aggregatePerformance(graph, { agg: "sum", flowTime: "idle_time", unit: "s" });
    expect(graph).toEqual(before);
  });
});

describe("aggregatePerformance flow time", () => {
  it("re-derives waiting time vs cycle time when it is given the log", () => {
    const graph = discoverGraph(interval); // discovered at the default idle_time
    const idle = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "idle_time",
      unit: "ms",
      log: interval,
    });
    const cycle = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "inter_start_time",
      unit: "ms",
      log: interval,
    });
    // A ends at 30s and B starts at 60s → 30s of waiting; A starts at 0 → 60s of cycle.
    expect(idle.performance.transitions[edgeKey("A", "B")]).toBe(30_000);
    expect(cycle.performance.transitions[edgeKey("A", "B")]).toBe(60_000);
  });

  it("accepts an already-normalized log, and answers identically", () => {
    const graph = discoverGraph(interval);
    const fromRaw = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "inter_start_time",
      unit: "s",
      log: interval,
    });
    const fromNormalized = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "inter_start_time",
      unit: "s",
      log: normalizeLog(interval),
    });
    expect(fromNormalized).toEqual(fromRaw);
  });

  it("without a log, carries the graph's own samples through unchanged", () => {
    const graph = discoverGraph(interval);
    const layered = aggregatePerformance(graph, {
      agg: "median",
      flowTime: "inter_start_time",
      unit: "ms",
    });
    // `flowTime` is a declaration here, not an instruction: the graph was discovered at
    // idle_time, so 30s is what it still measures. This is the documented limitation.
    expect(layered.performance.transitions[edgeKey("A", "B")]).toBe(30_000);
  });

  it("keeps a reduced graph's numbers derived from the FULL log", () => {
    // The "sliders never change statistics" rule, one layer up: a performance layer over
    // an abstracted graph must still describe everything that happened.
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "A", timestamp: 0 },
        { caseId: "c1", activity: "B", timestamp: MINUTE },
        { caseId: "c2", activity: "A", timestamp: 0 },
        { caseId: "c2", activity: "B", timestamp: 3 * MINUTE },
        { caseId: "c3", activity: "A", timestamp: 0 },
        { caseId: "c3", activity: "Rare", timestamp: 10 * MINUTE },
      ],
    };
    const full = discoverGraph(log);
    const reduced = {
      ...full,
      activities: full.activities.filter((a) => a.id !== "Rare"),
      transitions: full.transitions.filter((t) => t.target !== "Rare"),
    };
    const layered = aggregatePerformance(reduced, {
      agg: "median",
      flowTime: "idle_time",
      unit: "min",
      log,
    });
    expect(layered.performance.transitions[edgeKey("A", "B")]).toBe(2);
    expect(layered.activities.map((a) => a.id)).not.toContain("Rare");
  });
});
