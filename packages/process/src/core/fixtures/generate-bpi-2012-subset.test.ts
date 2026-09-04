import { describe, expect, it } from "vitest";

import { BPI_2012_ACTIVITIES, generateBpi2012Subset } from "./generate-bpi-2012-subset";

describe("generateBpi2012Subset", () => {
  it("is deterministic — the same seed produces a byte-identical log", () => {
    const a = generateBpi2012Subset({ cases: 50, seed: 42 });
    const b = generateBpi2012Subset({ cases: 50, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("a different seed produces a different log", () => {
    const a = generateBpi2012Subset({ cases: 50, seed: 1 });
    const b = generateBpi2012Subset({ cases: 50, seed: 2 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("every case starts with A_SUBMITTED", () => {
    const log = generateBpi2012Subset({ cases: 30, seed: 3 });
    const firstByCase = new Map<string, string>();
    for (const event of log.events) {
      if (!firstByCase.has(event.caseId)) firstByCase.set(event.caseId, event.activity);
    }
    for (const activity of firstByCase.values()) expect(activity).toBe("A_SUBMITTED");
  });

  it("only emits activities from the declared BPI-2012 vocabulary", () => {
    const log = generateBpi2012Subset({ cases: 100, seed: 5 });
    const allowed = new Set<string>(BPI_2012_ACTIVITIES);
    for (const event of log.events) expect(allowed.has(event.activity)).toBe(true);
  });

  it("cases below 1 yield an empty log", () => {
    expect(generateBpi2012Subset({ cases: 0, seed: 1 })).toEqual({ events: [] });
  });

  it("produces a well-formed 13 000-case log within a reasonable time", () => {
    const started = performance.now();
    const log = generateBpi2012Subset({ cases: 13_000, seed: 1 });
    const elapsed = performance.now() - started;
    expect(log.events.length).toBeGreaterThan(100_000);
    expect(elapsed).toBeLessThan(2000);
  });
});
