import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "./highlight";
import { localizeRanges, toMarkRanges } from "./highlight-marks";

const resolved = (
  id: string,
  range: [number, number],
  extra: Partial<ResolvedHighlight> = {},
): ResolvedHighlight => ({
  id,
  source: "citation",
  status: "resolved",
  address: { kind: "range", start: range[0], end: range[1] },
  active: false,
  range,
  ...extra,
});

describe("toMarkRanges", () => {
  it("is empty for no highlights at all", () => {
    expect(toMarkRanges(undefined, 10)).toEqual({ ranges: [], activeIndex: -1 });
    expect(toMarkRanges([], 10)).toEqual({ ranges: [], activeIndex: -1 });
  });

  it("keeps only the entries that actually located", () => {
    const misses: ResolvedHighlight[] = [
      { ...resolved("a", [0, 2]), status: "not-found", range: undefined, reason: "absent" },
      { ...resolved("b", [0, 2]), status: "unsupported", range: undefined },
      { ...resolved("c", [0, 2]), status: "pending", range: undefined },
    ];
    expect(toMarkRanges(misses, 10).ranges).toEqual([]);
    expect(toMarkRanges([...misses, resolved("d", [4, 6])], 10).ranges).toEqual([[4, 6]]);
  });

  it("sorts and merges, so out-of-order citations still paint one run", () => {
    const marks = toMarkRanges(
      [resolved("b", [6, 9]), resolved("a", [0, 3]), resolved("c", [3, 5])],
      10,
    );
    expect(marks.ranges).toEqual([
      [0, 5],
      [6, 9],
    ]);
  });

  it("points activeIndex at the MERGED mark containing the active range", () => {
    // Three requests, two marks: the active one is the second REQUEST but sits
    // inside the first mark. Counting against the unmerged list would be wrong.
    const marks = toMarkRanges(
      [resolved("a", [0, 3]), resolved("b", [3, 5], { active: true }), resolved("c", [7, 9])],
      10,
    );
    expect(marks.ranges).toEqual([
      [0, 5],
      [7, 9],
    ]);
    expect(marks.activeIndex).toBe(0);
  });

  it("reports no active mark when nothing is active", () => {
    expect(toMarkRanges([resolved("a", [0, 3])], 10).activeIndex).toBe(-1);
  });

  it("clamps to the text it will actually be painted on", () => {
    expect(toMarkRanges([resolved("a", [8, 40])], 10).ranges).toEqual([[8, 10]]);
  });
});

describe("localizeRanges", () => {
  const marks = toMarkRanges(
    [resolved("a", [2, 6]), resolved("b", [10, 14], { active: true })],
    20,
  );

  it("rebases a range onto the slice that contains it", () => {
    expect(localizeRanges(marks, 0, 8)).toEqual({ ranges: [[2, 6]], activeIndex: -1 });
  });

  it("carries the active flag only into the slice the active range touches", () => {
    expect(localizeRanges(marks, 8, 16)).toEqual({ ranges: [[2, 6]], activeIndex: 0 });
  });

  it("clips a range that straddles the slice boundary, so it survives in both", () => {
    // A citation crossing a line break must still read as one continuous run.
    const straddling = toMarkRanges([resolved("a", [3, 9], { active: true })], 20);
    expect(localizeRanges(straddling, 0, 6)).toEqual({ ranges: [[3, 6]], activeIndex: 0 });
    expect(localizeRanges(straddling, 6, 12)).toEqual({ ranges: [[0, 3]], activeIndex: 0 });
  });

  it("is empty for a slice no range reaches", () => {
    expect(localizeRanges(marks, 16, 20)).toEqual({ ranges: [], activeIndex: -1 });
    expect(localizeRanges(marks, 5, 5)).toEqual({ ranges: [], activeIndex: -1 });
  });
});
