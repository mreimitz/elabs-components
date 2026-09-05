import { describe, expect, it } from "vitest";

import { detectRework } from "./detect-rework";
import { normalizeLog } from "./event-log";
import fixture from "./fixtures/order-to-cash-small.json";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import type { EventLog } from "./types";

const orderToCash = fixture as EventLog;

/**
 * The five traces in `order-to-cash-small.json`, restated so the numbers below can be
 * read against them without opening the fixture:
 *
 *   case-1  Create Order · Check Credit · Approve Order · Ship Order · Send Invoice · Receive Payment
 *   case-2  Create Order · Check Credit · Approve Order · Ship Order · Send Invoice · Receive Payment
 *   case-3  Create Order · Check Credit · Reject Order
 *   case-4  Create Order · Check Credit · Amend Order · Check Credit · Approve Order · Ship Order ·
 *           Send Invoice · Receive Payment
 *   case-5  Create Order · Check Credit · Approve Order · Send Invoice · Ship Order · Receive Payment
 *
 * Exactly one repeat in the whole fixture: case-4's second Check Credit, with Amend Order
 * in between — a LOOP, not a self-loop. Counted by hand, not read off the implementation.
 */
describe("detectRework on the 5-case order-to-cash fixture", () => {
  it("finds the one non-adjacent repeat and no adjacent ones", () => {
    const rework = detectRework(orderToCash);
    expect(rework.selfLoops).toBe(0);
    expect(rework.loops).toBe(1);
    expect(rework.caseReworkRate).toBe(1 / 5);
  });

  it("attributes the loop to Check Credit and lists every other activity at zero", () => {
    expect(detectRework(orderToCash).perActivity).toEqual({
      "Amend Order": { selfLoops: 0, loops: 0 },
      "Approve Order": { selfLoops: 0, loops: 0 },
      "Check Credit": { selfLoops: 0, loops: 1 },
      "Create Order": { selfLoops: 0, loops: 0 },
      "Receive Payment": { selfLoops: 0, loops: 0 },
      "Reject Order": { selfLoops: 0, loops: 0 },
      "Send Invoice": { selfLoops: 0, loops: 0 },
      "Ship Order": { selfLoops: 0, loops: 0 },
    });
  });

  it("answers identically from an already-normalized log", () => {
    expect(detectRework(normalizeLog(orderToCash))).toEqual(detectRework(orderToCash));
  });
});

describe("detectRework classification", () => {
  const traceLog = (activities: readonly string[][]): EventLog => ({
    events: activities.flatMap((trace, caseIndex) =>
      trace.map((activity, step) => ({
        caseId: `case-${caseIndex}`,
        activity,
        timestamp: step * 1000,
      })),
    ),
  });

  it("counts an adjacent repeat as a self-loop", () => {
    const rework = detectRework(traceLog([["A", "A", "B"]]));
    expect(rework.selfLoops).toBe(1);
    expect(rework.loops).toBe(0);
    expect(rework.perActivity["A"]).toEqual({ selfLoops: 1, loops: 0 });
  });

  it("counts a return after another activity as a loop", () => {
    const rework = detectRework(traceLog([["A", "B", "A"]]));
    expect(rework.selfLoops).toBe(0);
    expect(rework.loops).toBe(1);
  });

  it("splits a trace that does both, and never double-counts an occurrence", () => {
    // A B A A B — occurrences beyond the first: the third A (loop), the fourth A
    // (self-loop), the fifth B (loop). Three repeats, three tallies, no more.
    const rework = detectRework(traceLog([["A", "B", "A", "A", "B"]]));
    expect(rework.selfLoops).toBe(1);
    expect(rework.loops).toBe(2);
    expect(rework.perActivity["A"]).toEqual({ selfLoops: 1, loops: 1 });
    expect(rework.perActivity["B"]).toEqual({ selfLoops: 0, loops: 1 });
  });

  it("counts a case once however much rework it carries", () => {
    const rework = detectRework(
      traceLog([
        ["A", "A", "A", "A"],
        ["B", "C"],
      ]),
    );
    expect(rework.selfLoops).toBe(3);
    expect(rework.caseReworkRate).toBe(1 / 2);
  });

  it("answers zeros for an empty log rather than dividing by zero", () => {
    expect(detectRework({ events: [] })).toEqual({
      selfLoops: 0,
      loops: 0,
      caseReworkRate: 0,
      perActivity: {},
    });
  });

  it("lists activities in ascending name order", () => {
    const rework = detectRework(traceLog([["Zeta", "Alpha", "Mu"]]));
    expect(Object.keys(rework.perActivity)).toEqual(["Alpha", "Mu", "Zeta"]);
  });
});

describe("detectRework on the synthetic log", () => {
  it("adds up: every repeat is exactly one of the two kinds", () => {
    const log = generateSyntheticLog({ cases: 200, seed: 11 });
    const normalized = normalizeLog(log);
    const rework = detectRework(normalized);

    // Counted independently: total executions minus distinct activities per case.
    let repeats = 0;
    for (const kase of normalized.cases) {
      const distinct = new Set(kase.events.map((event) => event.activity));
      repeats += kase.events.length - distinct.size;
    }
    expect(rework.selfLoops + rework.loops).toBe(repeats);
    expect(repeats).toBeGreaterThan(0);
    expect(rework.caseReworkRate).toBeGreaterThan(0);
    expect(rework.caseReworkRate).toBeLessThanOrEqual(1);
  });

  it("is deterministic for a given seed", () => {
    const first = detectRework(generateSyntheticLog({ cases: 50, seed: 3 }));
    const second = detectRework(generateSyntheticLog({ cases: 50, seed: 3 }));
    expect(second).toEqual(first);
  });
});
