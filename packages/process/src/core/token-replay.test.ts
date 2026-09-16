import { describe, expect, it } from "vitest";

import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import { liftHappyPath, type HappyPath } from "./reference-model";
import {
  DEVIATION_TYPES,
  replayActivities,
  replayTrace,
  tokenReplay,
  type Deviation,
} from "./token-replay";
import type { EventLog, EventRow } from "./types";

/** A → B (optional) → C (repeatable) → D → E. */
const HAPPY: HappyPath = {
  id: "o2c",
  label: "Order to cash",
  steps: [
    { activity: "A" },
    { activity: "B", optional: true },
    { activity: "C", repeatable: true },
    { activity: "D" },
    { activity: "E" },
  ],
};
const model = liftHappyPath(HAPPY);

const T0 = Date.UTC(2026, 0, 5);

function rows(caseId: string, trace: string[], start = T0): EventRow[] {
  return trace.map((activity, i) => ({ caseId, activity, timestamp: start + i * 60_000 }));
}

/**
 * Hand-computed. `produced` counts the initial token plus one per output of every fired
 * transition (skip arcs included); `consumed` counts one per input of every fired
 * transition plus the final token.
 */
const TABLE: {
  name: string;
  trace: string[];
  counts: { produced: number; consumed: number; missing: number; remaining: number };
  fitness: number;
  deviations: Deviation[];
}[] = [
  {
    name: "perfect match",
    trace: ["A", "B", "C", "D", "E"],
    counts: { produced: 6, consumed: 6, missing: 0, remaining: 0 },
    fitness: 1,
    deviations: [],
  },
  {
    name: "skips the optional step",
    trace: ["A", "C", "D", "E"],
    // The silent skip arc fires: +1 produced, +1 consumed, no penalty.
    counts: { produced: 6, consumed: 6, missing: 0, remaining: 0 },
    fitness: 1,
    deviations: [],
  },
  {
    name: "repeats the repeatable step",
    trace: ["A", "B", "C", "C", "D", "E"],
    counts: { produced: 7, consumed: 7, missing: 0, remaining: 0 },
    fitness: 1,
    deviations: [],
  },
  {
    name: "skips a required step",
    trace: ["A", "B", "C", "E"],
    // E forces a token into p4; the token left in p3 remains. ½(1−1/5) + ½(1−1/5).
    counts: { produced: 5, consumed: 5, missing: 1, remaining: 1 },
    fitness: 0.8,
    deviations: [{ type: "skipped", activity: "D", expected: "D", at: 3 }],
  },
  {
    name: "wrong order",
    trace: ["A", "B", "D", "C", "E"],
    // D forces p3 (C is observed later, so it is not "skipped"); C then leaves p3 over.
    // ½(1−1/6) + ½(1−1/6).
    counts: { produced: 6, consumed: 6, missing: 1, remaining: 1 },
    fitness: 5 / 6,
    deviations: [{ type: "wrongOrder", activity: "D", expected: "C", at: 2 }],
  },
  {
    name: "undesired activity",
    trace: ["A", "B", "X", "C", "D", "E"],
    // X is a phantom firing consuming one forced token. ½(1−1/7) + ½(1−0/6).
    counts: { produced: 6, consumed: 7, missing: 1, remaining: 0 },
    fitness: 13 / 14,
    deviations: [{ type: "undesired", activity: "X", expected: "C", at: 2 }],
  },
  {
    name: "incomplete",
    trace: ["A", "B", "C"],
    // Final place p5 never marked; p3 left over. ½(1−1/4) + ½(1−1/4).
    counts: { produced: 4, consumed: 4, missing: 1, remaining: 1 },
    fitness: 0.75,
    deviations: [{ type: "incomplete", activity: "C", expected: "D", at: 3 }],
  },
  {
    name: "wrong start",
    trace: ["B", "C", "D", "E"],
    // B forces p1; the initial token in p0 remains. ½(1−1/5) + ½(1−1/5).
    counts: { produced: 5, consumed: 5, missing: 1, remaining: 1 },
    fitness: 0.8,
    deviations: [{ type: "wrongStart", activity: "B", expected: "A", at: 0 }],
  },
];

describe("replayTrace — hand-verified table", () => {
  it.each(TABLE)("$name", ({ trace, counts, fitness, deviations }) => {
    const result = replayTrace(rows("c", trace), model);
    expect(result.caseId).toBe("c");
    expect({
      produced: result.produced,
      consumed: result.consumed,
      missing: result.missing,
      remaining: result.remaining,
    }).toEqual(counts);
    expect(result.fitness).toBeCloseTo(fitness, 12);
    expect(result.deviations).toEqual(deviations);
  });
});

describe("replayTrace — input handling", () => {
  it("orders rows in time and merges lifecycle pairs before replaying", () => {
    const events: EventRow[] = [
      { caseId: "c", activity: "E", timestamp: T0 + 9 },
      { caseId: "c", activity: "B", timestamp: T0 + 3, lifecycle: "complete" },
      { caseId: "c", activity: "A", timestamp: T0 + 1 },
      { caseId: "c", activity: "B", timestamp: T0 + 2, lifecycle: "start" },
      { caseId: "c", activity: "D", timestamp: T0 + 8 },
      { caseId: "c", activity: "C", timestamp: T0 + 5 },
    ];
    const result = replayTrace(events, model);
    expect(result.fitness).toBe(1);
    expect(result.deviations).toEqual([]);
  });

  it("scores an empty trace as incomplete, never NaN", () => {
    const result = replayActivities("empty", [], model);
    expect(result.deviations).toEqual([{ type: "incomplete", expected: "A", at: 0 }]);
    expect(result.fitness).toBe(0);
  });

  it("does not report an optional tail step as incomplete", () => {
    const tail = liftHappyPath({
      id: "t",
      label: "Tail",
      steps: [{ activity: "A" }, { activity: "Z", optional: true }],
    });
    const result = replayActivities("c", ["A"], tail);
    expect(result.deviations).toEqual([]);
    expect(result.fitness).toBe(1);
  });
});

describe("tokenReplay", () => {
  const log: EventLog = {
    events: TABLE.flatMap(({ trace }, i) => rows(`case-${i}`, trace, T0 + i * 86_400_000)),
  };
  const result = tokenReplay(log, model);
  const allDeviations = result.traces.flatMap((t) => t.deviations);

  it("replays every case in log order", () => {
    expect(result.traces.map((t) => t.caseId)).toEqual(TABLE.map((_, i) => `case-${i}`));
    TABLE.forEach((row, i) => {
      expect(result.traces[i]?.fitness).toBeCloseTo(row.fitness, 12);
    });
  });

  it("reports overall fitness as the mean trace fitness", () => {
    const mean = TABLE.reduce((sum, row) => sum + row.fitness, 0) / TABLE.length;
    expect(result.overallFitness).toBeCloseTo(mean, 12);
  });

  it("keeps tallies non-negative and consistent with deviationCounts", () => {
    expect(Object.keys(result.deviationCounts).sort()).toEqual([...DEVIATION_TYPES].sort());
    expect(result.deviationCounts).toEqual({
      undesired: 1,
      skipped: 1,
      wrongOrder: 1,
      wrongStart: 1,
      incomplete: 1,
    });
    const total = Object.values(result.deviationCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(allDeviations.length);

    const perActivity = Object.values(result.perActivity).map((v) => v.deviations);
    const perEdge = Object.values(result.perEdge).map((v) => v.deviations);
    for (const n of [...perActivity, ...perEdge]) expect(n).toBeGreaterThan(0);
    expect(perActivity.reduce((a, b) => a + b, 0)).toBe(total);
    expect(perEdge.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(total);
  });

  it("charges a deviation to the observed edge into the deviating event", () => {
    const edge = (from: string, to: string) => `${from}${EDGE_KEY_SEPARATOR}${to}`;
    expect({ ...result.perEdge }).toEqual({
      [edge("C", "E")]: { deviations: 1 },
      [edge("B", "D")]: { deviations: 1 },
      [edge("B", "X")]: { deviations: 1 },
    });
    expect({ ...result.perActivity }).toEqual({
      D: { deviations: 2 },
      X: { deviations: 1 },
      C: { deviations: 1 },
      B: { deviations: 1 },
    });
  });

  it("returns zero fitness and zeroed counts for an empty log", () => {
    const empty = tokenReplay({ events: [] }, model);
    expect(empty.overallFitness).toBe(0);
    expect(empty.traces).toEqual([]);
    expect(Object.values(empty.deviationCounts).every((n) => n === 0)).toBe(true);
  });
});
