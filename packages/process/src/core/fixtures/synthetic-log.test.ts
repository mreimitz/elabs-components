import { describe, expect, it } from "vitest";

import { discoverGraph } from "../discover-graph";
import { normalizeLog } from "../event-log";
import { extractVariants } from "../extract-variants";
import { generateSyntheticLog, SYNTHETIC_ACTIVITIES, SYNTHETIC_LOG_EPOCH } from "./synthetic-log";

describe("generateSyntheticLog", () => {
  it("is deterministic — the same seed produces a byte-identical log", () => {
    expect(generateSyntheticLog({ cases: 50, seed: 4 })).toEqual(
      generateSyntheticLog({ cases: 50, seed: 4 }),
    );
  });

  it("produces a different log for a different seed", () => {
    expect(generateSyntheticLog({ cases: 50, seed: 4 })).not.toEqual(
      generateSyntheticLog({ cases: 50, seed: 5 }),
    );
  });

  it("emits exactly the requested number of cases, in order", () => {
    const log = generateSyntheticLog({ cases: 25, seed: 1 });
    const normalized = normalizeLog(log);
    expect(normalized.totals.cases).toBe(25);
    expect(normalized.cases[0]?.caseId).toBe("case-00001");
    expect(normalized.cases[24]?.caseId).toBe("case-00025");
    // Zero-padded so lexical and numeric order agree.
    expect([...normalized.cases.map((c) => c.caseId)].sort()).toEqual(
      normalized.cases.map((c) => c.caseId),
    );
  });

  it("uses only the declared activity vocabulary", () => {
    const vocabulary = new Set<string>(SYNTHETIC_ACTIVITIES);
    for (const event of generateSyntheticLog({ cases: 300, seed: 2 }).events) {
      expect(vocabulary.has(event.activity)).toBe(true);
    }
  });

  it("starts at the fixed epoch and never reads a wall clock", () => {
    const log = generateSyntheticLog({ cases: 3, seed: 1 });
    const first = log.events[0];
    expect(typeof first?.timestamp).toBe("number");
    expect(first?.timestamp as number).toBeGreaterThanOrEqual(SYNTHETIC_LOG_EPOCH);
    // Ten years of headroom: a wall-clock leak would land far outside this.
    expect(first?.timestamp as number).toBeLessThan(SYNTHETIC_LOG_EPOCH + 315_360_000_000);
  });

  it("honours an explicit start time", () => {
    const log = generateSyntheticLog({ cases: 1, seed: 1, startTime: 0 });
    expect(log.events[0]?.startTimestamp as number).toBeLessThan(315_360_000_000);
  });

  it("emits interval events, so activity durations are real", () => {
    const graph = discoverGraph(generateSyntheticLog({ cases: 300, seed: 6 }));
    for (const activity of graph.activities) {
      expect(activity.duration.min).toBeGreaterThan(0);
    }
    expect(graph.transitions.some((edge) => edge.duration.max > 0)).toBe(true);
  });

  it("always starts a case with Create Order and orders events in time", () => {
    for (const kase of normalizeLog(generateSyntheticLog({ cases: 200, seed: 8 })).cases) {
      expect(kase.events[0]?.activity).toBe("Create Order");
      for (let i = 1; i < kase.events.length; i += 1) {
        expect(kase.events[i]?.start).toBeGreaterThanOrEqual(kase.events[i - 1]?.start ?? 0);
      }
    }
  });

  it("contains the shapes a process view has to handle: branching, rework and a self-loop", () => {
    const graph = discoverGraph(generateSyntheticLog({ cases: 1000, seed: 1 }));
    const ids = new Set(graph.activities.map((a) => a.id));
    // Two exception branches, both reachable.
    expect(ids.has("Reject Order")).toBe(true);
    expect(ids.has("Cancel Order")).toBe(true);
    // A rework loop back to an earlier activity.
    expect(
      graph.transitions.some((e) => e.source === "Amend Order" && e.target === "Check Credit"),
    ).toBe(true);
    // And a genuine self-loop.
    expect(graph.transitions.some((e) => e.isSelfLoop)).toBe(true);
    // More than one ending, because not every order completes.
    expect(Object.keys(graph.endActivities).length).toBeGreaterThan(1);
  });

  it("produces a long-tailed variant distribution, not one path repeated", () => {
    const variants = extractVariants(generateSyntheticLog({ cases: 1000, seed: 1 }));
    expect(variants.length).toBeGreaterThan(5);
    // The most common path is dominant but far from the whole log.
    expect(variants[0]?.share).toBeGreaterThan(0.2);
    expect(variants[0]?.share).toBeLessThan(0.8);
  });

  it("attaches case attributes to every case", () => {
    const log = generateSyntheticLog({ cases: 10, seed: 1 });
    expect(Object.keys(log.caseAttributes ?? {})).toHaveLength(10);
    expect(log.caseAttributes?.["case-00001"]).toMatchObject({
      region: expect.any(String),
      segment: expect.any(String),
      orderValue: expect.any(Number),
    });
  });

  it("answers a non-positive case count with an empty log", () => {
    expect(generateSyntheticLog({ cases: 0 }).events).toEqual([]);
    expect(generateSyntheticLog({ cases: -5 }).events).toEqual([]);
  });
});
