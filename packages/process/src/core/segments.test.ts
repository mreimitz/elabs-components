import { describe, expect, it } from "vitest";

import { discoverGraph } from "./discover-graph";
import { extractVariants } from "./extract-variants";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import {
  durationQuartile,
  durationQuartileThresholds,
  quartileOf,
  segmentKey,
  segmentOrderByFrequency,
  segmentOrderForVariant,
  segmentsFor,
  type SegmentDefinition,
} from "./segments";
import type { EventLog, EventRow } from "./types";

const H = 3_600_000;

/**
 * Four cases through A → B → C → D. Waits (in hours) per segment:
 *
 * | case | A→B | B→C | C→D |
 * | ---- | --- | --- | --- |
 * | c1   | 1   | 8   | 2   |
 * | c2   | 2   | 6   | 2   |
 * | c3   | 3   | 4   | 2   |
 * | c4   | 4   | 2   | 6   |
 */
function hourlyCase(caseId: string, offset: number, waits: [number, number, number]): EventRow[] {
  const [ab, bc, cd] = waits;
  const t0 = offset * H;
  return [
    { caseId, activity: "A", timestamp: t0 },
    { caseId, activity: "B", timestamp: t0 + ab * H },
    { caseId, activity: "C", timestamp: t0 + (ab + bc) * H },
    { caseId, activity: "D", timestamp: t0 + (ab + bc + cd) * H },
  ];
}

const LOG: EventLog = {
  events: [
    ...hourlyCase("c1", 0, [1, 8, 2]),
    ...hourlyCase("c2", 1, [2, 6, 2]),
    ...hourlyCase("c3", 2, [3, 4, 2]),
    ...hourlyCase("c4", 3, [4, 2, 6]),
  ],
};

const ORDER: SegmentDefinition[] = [
  { from: "A", to: "B" },
  { from: "B", to: "C" },
  { from: "C", to: "D" },
];

describe("segmentsFor", () => {
  const occurrences = segmentsFor(LOG, ORDER);

  it("emits one occurrence per case per segment, in log then trace order", () => {
    expect(occurrences).toHaveLength(12);
    expect(occurrences.slice(0, 3).map((o) => [o.caseId, o.segment])).toEqual([
      ["c1", segmentKey("A", "B")],
      ["c1", segmentKey("B", "C")],
      ["c1", segmentKey("C", "D")],
    ]);
    expect(occurrences[4]).toEqual({
      segment: segmentKey("B", "C"),
      caseId: "c2",
      start: 3 * H,
      end: 9 * H,
      duration: 6 * H,
    });
  });

  it("reproduces the hand-computed duration and quartile table", () => {
    const table = ORDER.map((def) => {
      const key = segmentKey(def.from, def.to);
      const own = occurrences.filter((o) => o.segment === key);
      const durations = own.map((o) => o.duration);
      return own.map((o) => [o.caseId, o.duration / H, durationQuartile(o, durations)]);
    });
    expect(table).toEqual([
      // A→B: 1,2,3,4 h → cuts 1.75 / 2.5 / 3.25
      [
        ["c1", 1, 1],
        ["c2", 2, 2],
        ["c3", 3, 3],
        ["c4", 4, 4],
      ],
      // B→C: 8,6,4,2 h → cuts 3.5 / 5 / 6.5
      [
        ["c1", 8, 4],
        ["c2", 6, 3],
        ["c3", 4, 2],
        ["c4", 2, 1],
      ],
      // C→D: 2,2,2,6 h → cuts 2 / 2 / 3 — ties land in the lowest quartile they reach
      [
        ["c1", 2, 1],
        ["c2", 2, 1],
        ["c3", 2, 1],
        ["c4", 6, 4],
      ],
    ]);
  });

  it("skips pairs that are not in the order", () => {
    const only = segmentsFor(LOG, [{ from: "B", to: "C" }]);
    expect(only).toHaveLength(4);
    expect(new Set(only.map((o) => o.segment))).toEqual(new Set([segmentKey("B", "C")]));
    expect(segmentsFor(LOG, [{ from: "A", to: "C" }])).toEqual([]);
    expect(segmentsFor(LOG, [])).toEqual([]);
  });

  it("ignores duplicate definitions and clamps an overlapping pair to zero duration", () => {
    const overlapping: EventLog = {
      events: [
        { caseId: "x", activity: "A", startTimestamp: 0, timestamp: 10 },
        { caseId: "x", activity: "B", startTimestamp: 5, timestamp: 20 },
      ],
    };
    const out = segmentsFor(overlapping, [
      { from: "A", to: "B" },
      { from: "A", to: "B" },
    ]);
    expect(out).toEqual([
      { segment: segmentKey("A", "B"), caseId: "x", start: 10, end: 10, duration: 0 },
    ]);
  });

  it("is deterministic", () => {
    const log = generateSyntheticLog({ cases: 50, seed: 3 });
    const order = segmentOrderByFrequency(discoverGraph(log), 5);
    expect(segmentsFor(log, order)).toEqual(segmentsFor(log, order));
  });
});

describe("segmentOrderByFrequency", () => {
  it("matches discoverGraph's own top-N transition ranking, order-stable", () => {
    const log = generateSyntheticLog({ cases: 300, seed: 11 });
    const graph = discoverGraph(log);
    const top = segmentOrderByFrequency(graph, 6);
    expect(top).toEqual(
      graph.transitions.slice(0, 6).map((t) => ({ from: t.source, to: t.target })),
    );
    expect(segmentOrderByFrequency(discoverGraph(log), 6)).toEqual(top);
  });

  it("returns every transition without a limit, and none for a non-positive one", () => {
    const graph = discoverGraph(LOG);
    expect(segmentOrderByFrequency(graph)).toHaveLength(graph.transitions.length);
    expect(segmentOrderByFrequency(graph, 0)).toEqual([]);
  });
});

describe("segmentOrderForVariant", () => {
  it("derives consecutive pairs from the variant sequence", () => {
    const [variant] = extractVariants(LOG);
    expect(segmentOrderForVariant(variant!)).toEqual(ORDER);
  });

  it("keeps a looped pair once, at its first position", () => {
    const variant = { ...extractVariants(LOG)[0]!, sequence: ["A", "B", "A", "B", "C"] };
    expect(segmentOrderForVariant(variant)).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "A" },
      { from: "B", to: "C" },
    ]);
  });
});

describe("durationQuartileThresholds / quartileOf", () => {
  it("answers zeros for an empty or all-non-finite sample", () => {
    expect(durationQuartileThresholds([])).toEqual([0, 0, 0]);
    expect(durationQuartileThresholds([Number.NaN])).toEqual([0, 0, 0]);
  });

  it("buckets with inclusive upper bounds", () => {
    const cuts = durationQuartileThresholds([10, 20, 30, 40]);
    expect(cuts).toEqual([17.5, 25, 32.5]);
    expect([10, 17.5, 20, 25, 30, 32.5, 40].map((d) => quartileOf(d, cuts))).toEqual([
      1, 1, 2, 2, 3, 3, 4,
    ]);
  });
});
