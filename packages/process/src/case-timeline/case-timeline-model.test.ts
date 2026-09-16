import { describe, expect, it } from "vitest";
import { buildCaseTimelineInstances } from "./case-timeline-model";
import type { EventRow } from "../core/types";

const CASE_ID = "case-1";

// A (0 – 30min), 30min wait, B (1h – 1.5h), 30min wait, C (2h – 3h) overlapping D
// (2.5h – 3.5h) by 30min — the fixture the RM-055 acceptance criterion asks for: "two
// waiting periods" and "one pair of instances flagged parallel".
const EVENTS: EventRow[] = [
  { caseId: CASE_ID, activity: "A", startTimestamp: 0, timestamp: 1_800_000 },
  { caseId: CASE_ID, activity: "B", startTimestamp: 3_600_000, timestamp: 5_400_000 },
  { caseId: CASE_ID, activity: "C", startTimestamp: 7_200_000, timestamp: 10_800_000 },
  { caseId: CASE_ID, activity: "D", startTimestamp: 9_000_000, timestamp: 12_600_000 },
];

describe("buildCaseTimelineInstances", () => {
  it("answers an empty array for a case with no resolvable rows", () => {
    expect(buildCaseTimelineInstances([])).toEqual([]);
  });

  it("builds one instance per activity execution, in chronological order", () => {
    const instances = buildCaseTimelineInstances(EVENTS);
    expect(instances.map((i) => i.activity)).toEqual(["A", "B", "C", "D"]);
    expect(instances.map((i) => [i.start, i.end])).toEqual([
      [0, 1_800_000],
      [3_600_000, 5_400_000],
      [7_200_000, 10_800_000],
      [9_000_000, 12_600_000],
    ]);
  });

  it("renders exactly two waiting-time gaps for the fixture", () => {
    const instances = buildCaseTimelineInstances(EVENTS);
    const gaps = instances.map((i) => i.gap);
    expect(gaps[0]).toBeUndefined(); // A — nothing preceded it
    expect(gaps[1]).toEqual({ start: 1_800_000, end: 3_600_000, durationMs: 1_800_000 }); // before B
    expect(gaps[2]).toEqual({ start: 5_400_000, end: 7_200_000, durationMs: 1_800_000 }); // before C
    expect(gaps[3]).toBeUndefined(); // D starts DURING C — no waiting time, they overlap
  });

  it("flags exactly the one overlapping pair (C, D) as parallel by default", () => {
    const instances = buildCaseTimelineInstances(EVENTS);
    const flagged = instances.filter((i) => i.isParallel).map((i) => i.activity);
    expect(flagged.sort()).toEqual(["C", "D"]);
  });

  it("does not flag an overlap at or below parallelismThreshold", () => {
    // C/D overlap by exactly 1_800_000ms — a threshold equal to the overlap must NOT flag it
    // ("below which two instances are NOT flagged parallel" — the boundary itself doesn't flag).
    const instances = buildCaseTimelineInstances(EVENTS, { parallelismThreshold: 1_800_000 });
    expect(instances.every((i) => !i.isParallel)).toBe(true);
  });

  it("flags an overlap above the threshold", () => {
    const instances = buildCaseTimelineInstances(EVENTS, { parallelismThreshold: 1_000_000 });
    expect(
      instances
        .filter((i) => i.isParallel)
        .map((i) => i.activity)
        .sort(),
    ).toEqual(["C", "D"]);
  });

  it("marks an unterminated lifecycle:start instance as open", () => {
    const instances = buildCaseTimelineInstances([
      { caseId: CASE_ID, activity: "A", timestamp: 0, lifecycle: "start" },
    ]);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.isOpen).toBe(true);
  });
});
