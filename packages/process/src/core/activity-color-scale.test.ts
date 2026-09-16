import { describe, expect, it } from "vitest";

import {
  ACTIVITY_COLOR_SLOTS,
  ACTIVITY_OTHER_TOKEN,
  activityColorScale,
} from "./activity-color-scale";
import { discoverGraph } from "./discover-graph";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import type { ActivityStats, ProcessGraph } from "./types";

const ZERO = { min: 0, max: 0, mean: 0, median: 0, p90: 0, sum: 0, trimmedMean: 0 };

function graphOf(entries: [id: string, cases: number][]): ProcessGraph {
  const activities: ActivityStats[] = entries.map(([id, cases]) => ({
    id,
    label: id,
    instances: cases,
    cases,
    isStart: false,
    isEnd: false,
    duration: ZERO,
  }));
  return {
    activities,
    transitions: [],
    startActivities: {},
    endActivities: {},
    totals: { cases: 0, events: 0, variants: 0 },
  };
}

describe("activityColorScale", () => {
  it("ranks by cases descending and assigns --chart-1.. in rank order", () => {
    const scale = activityColorScale(
      graphOf([
        ["Low", 1],
        ["High", 9],
        ["Mid", 5],
      ]),
    );
    expect(scale.legend.map((e) => [e.activityId, e.token])).toEqual([
      ["High", "--chart-1"],
      ["Mid", "--chart-2"],
      ["Low", "--chart-3"],
    ]);
    expect(scale.colorFor("Mid")).toEqual({ token: "--chart-2" });
  });

  it("breaks ties by id, independent of input order", () => {
    const a = activityColorScale(
      graphOf([
        ["B", 3],
        ["A", 3],
        ["C", 3],
      ]),
    );
    const b = activityColorScale(
      graphOf([
        ["C", 3],
        ["B", 3],
        ["A", 3],
      ]),
    );
    expect(a.legend).toEqual(b.legend);
    expect(a.legend.map((e) => e.activityId)).toEqual(["A", "B", "C"]);
  });

  it("gives the top eleven distinct tokens and everything else the hatched other bucket", () => {
    const entries = Array.from(
      { length: 15 },
      (_, i) => [`Activity ${String(i).padStart(2, "0")}`, 100 - i] as [string, number],
    );
    const scale = activityColorScale(graphOf(entries));
    const tokens = scale.legend.slice(0, ACTIVITY_COLOR_SLOTS).map((e) => e.token);
    expect(new Set(tokens).size).toBe(ACTIVITY_COLOR_SLOTS);
    expect(tokens).not.toContain(ACTIVITY_OTHER_TOKEN);
    for (const entry of scale.legend.slice(ACTIVITY_COLOR_SLOTS)) {
      expect(entry.token).toBe(ACTIVITY_OTHER_TOKEN);
      expect(entry.pattern).toBe("other");
    }
    expect(scale.colorFor("never seen")).toEqual({ token: ACTIVITY_OTHER_TOKEN, pattern: "other" });
  });

  it("derives two-character codes unique within the scale", () => {
    const scale = activityColorScale(
      graphOf([
        ["Create Order", 5],
        ["Cancel Order", 4],
        ["Approve", 3],
        ["Approve Credit", 2],
      ]),
    );
    const codes = scale.legend.map((e) => e.code);
    expect(codes[0]).toBe("CO");
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toHaveLength(2);
    expect(scale.codeFor("Approve")).toBe(scale.legend[2]?.code);
  });

  it("is deterministic on a real discovered graph", () => {
    const log = generateSyntheticLog({ cases: 120, seed: 7 });
    expect(activityColorScale(discoverGraph(log)).legend).toEqual(
      activityColorScale(discoverGraph(log)).legend,
    );
  });
});
