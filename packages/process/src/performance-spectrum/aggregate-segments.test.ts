import { describe, expect, it } from "vitest";

import { segmentKey, type SegmentOccurrence } from "../core/segments";
import {
  aggregateSegmentBins,
  buildSpectrumRows,
  casesInRange,
  spectrumDomain,
  spectrumTicks,
} from "./aggregate-segments";

const AB = segmentKey("A", "B");
const BC = segmentKey("B", "C");

const occ = (segment: string, caseId: string, start: number, end: number): SegmentOccurrence => ({
  segment,
  caseId,
  start,
  end,
  duration: end - start,
});

const OCCURRENCES: SegmentOccurrence[] = [
  occ(AB, "c2", 20, 40),
  occ(AB, "c1", 0, 10),
  occ(AB, "c3", 30, 60),
  occ(AB, "c4", 35, 75),
  occ(BC, "c1", 10, 100),
  occ(BC, "c2", 40, 50),
];

describe("buildSpectrumRows", () => {
  const rows = buildSpectrumRows(
    [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "A", to: "B" },
      { from: "C", to: "D" },
    ],
    OCCURRENCES,
  );

  it("keeps one row per distinct definition, in order, including empty ones", () => {
    expect(rows.map((r) => r.key)).toEqual([AB, BC, segmentKey("C", "D")]);
    expect(rows[2]?.lines).toEqual([]);
    expect(rows[2]?.caseCount).toBe(0);
  });

  it("sorts lines by start and reads quartiles against the row's own distribution", () => {
    const ab = rows[0]!;
    expect(ab.lines.map((l) => [l.caseId, l.duration, l.quartile])).toEqual([
      ["c1", 10, 1],
      ["c2", 20, 2],
      ["c3", 30, 3],
      ["c4", 40, 4],
    ]);
    // B→C has only two samples: 90 is slow FOR B→C even though A→B never saw it.
    expect(rows[1]!.lines.map((l) => [l.caseId, l.quartile])).toEqual([
      ["c1", 4],
      ["c2", 1],
    ]);
  });

  it("computes case count, median and p90 per row", () => {
    expect(rows[0]).toMatchObject({ caseCount: 4, medianDuration: 25, p90Duration: 37 });
  });
});

describe("aggregateSegmentBins", () => {
  const [ab] = buildSpectrumRows([{ from: "A", to: "B" }], OCCURRENCES);

  it("buckets by entry time, returns only non-empty bins, with a median quartile", () => {
    expect(aggregateSegmentBins(ab!, 25, 0)).toEqual([
      { segment: AB, start: 0, end: 25, count: 2, medianDuration: 15, quartile: 2 },
      { segment: AB, start: 25, end: 50, count: 2, medianDuration: 35, quartile: 4 },
    ]);
  });

  it("treats a non-positive bin size as 1 ms rather than looping forever", () => {
    expect(aggregateSegmentBins(ab!, 0, 0)).toHaveLength(4);
  });
});

describe("spectrumDomain / spectrumTicks / casesInRange", () => {
  const rows = buildSpectrumRows(
    [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ],
    OCCURRENCES,
  );

  it("spans every row's first start to last end, widening a degenerate domain", () => {
    expect(spectrumDomain(rows)).toEqual([0, 100]);
    expect(spectrumDomain([])).toEqual([0, 1000]);
  });

  it("spaces ticks evenly, ends included", () => {
    expect(spectrumTicks([0, 100], 5)).toEqual([0, 25, 50, 75, 100]);
  });

  it("finds cases whose occurrences overlap the range, in row then time order", () => {
    expect(casesInRange(rows, 45, 55)).toEqual(["c3", "c4", "c1", "c2"]);
    expect(casesInRange(rows, 12, 18)).toEqual(["c1"]);
    expect(casesInRange(rows, 101, 200)).toEqual([]);
  });
});
