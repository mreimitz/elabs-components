import { describe, expect, it } from "vitest";

import { conformanceRateSeries } from "./conformance";
import * as core from "./index";
import { liftHappyPath } from "./reference-model";
import type { EventLog, EventRow } from "./types";

const model = liftHappyPath({
  id: "p",
  label: "Path",
  steps: [{ activity: "A" }, { activity: "B" }, { activity: "C" }],
});

function caseRows(caseId: string, start: number, trace: string[]): EventRow[] {
  return trace.map((activity, i) => ({ caseId, activity, timestamp: start + i * 3_600_000 }));
}

// Three months: January all conforming, February one of two, March one incomplete case.
const log: EventLog = {
  events: [
    ...caseRows("jan-1", Date.UTC(2026, 0, 3), ["A", "B", "C"]),
    ...caseRows("jan-2", Date.UTC(2026, 0, 20), ["A", "B", "C"]),
    ...caseRows("feb-1", Date.UTC(2026, 1, 2), ["A", "B", "C"]),
    ...caseRows("feb-2", Date.UTC(2026, 1, 14), ["A", "B"]),
    ...caseRows("mar-1", Date.UTC(2026, 2, 30), ["A", "B"]),
  ],
};

describe("conformanceRateSeries", () => {
  it("returns one bucket per month whose case counts sum to the log total", () => {
    const series = conformanceRateSeries(log, model, "month");
    expect(series.map((p) => p.bucket)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series.map((p) => p.caseCount)).toEqual([2, 2, 1]);
    expect(series.reduce((sum, p) => sum + p.caseCount, 0)).toBe(5);
    // A, B then stop: p=3, c=3, m=1, r=1 → ½(1−1/3) + ½(1−1/3) = 2/3.
    expect(series[0]?.fitness).toBe(1);
    expect(series[1]?.fitness).toBeCloseTo((1 + 2 / 3) / 2, 12);
    expect(series[2]?.fitness).toBeCloseTo(2 / 3, 12);
  });

  it("buckets by UTC day and by the UTC Monday of the week", () => {
    expect(conformanceRateSeries(log, model, "day").map((p) => p.bucket)).toEqual([
      "2026-01-03",
      "2026-01-20",
      "2026-02-02",
      "2026-02-14",
      "2026-03-30",
    ]);
    // 2026-01-03 is a Saturday → week of Monday 2025-12-29; 2026-03-30 is itself a Monday.
    expect(conformanceRateSeries(log, model, "week").map((p) => p.bucket)).toEqual([
      "2025-12-29",
      "2026-01-19",
      "2026-02-02",
      "2026-02-09",
      "2026-03-30",
    ]);
  });

  it("leaves out a case with no resolvable start instead of inventing a bucket", () => {
    const withBad: EventLog = {
      events: [...log.events, { caseId: "bad", activity: "A", timestamp: "garbage" }],
    };
    const total = conformanceRateSeries(withBad, model, "month").reduce(
      (sum, p) => sum + p.caseCount,
      0,
    );
    expect(total).toBe(5);
  });
});

describe("core scope boundary (analysis §9 risk 2)", () => {
  it("exports the replay API and no alignment search or BPMN import", () => {
    expect(typeof core.liftHappyPath).toBe("function");
    expect(typeof core.replayTrace).toBe("function");
    expect(typeof core.tokenReplay).toBe("function");
    expect(typeof core.conformanceRateSeries).toBe("function");
    const forbidden = Object.keys(core).filter((name) => /align|bpmn|petri/i.test(name));
    expect(forbidden).toEqual([]);
  });
});
