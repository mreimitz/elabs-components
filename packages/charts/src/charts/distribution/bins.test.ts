import { bin as d3bin } from "d3-array";
import { afterEach, describe, expect, it, vi } from "vitest";
import { binValues, defaultBinCount, extentOf } from "./bins";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("binValues", () => {
  it("agrees with d3-array's own binning for a count hint", () => {
    const values = Array.from({ length: 100 }, (_v, i) => i);
    const mine = binValues(values, { bins: 10 });
    const theirs = d3bin<number, number>().domain([0, 99]).thresholds(10)(values);
    expect(mine).toHaveLength(theirs.length);
    mine.forEach((entry, index) => {
      expect(entry.x0).toBe(theirs[index]?.x0);
      expect(entry.x1).toBe(theirs[index]?.x1);
      expect(entry.count).toBe(theirs[index]?.length);
    });
  });

  it("keeps every value: the counts sum to n", () => {
    const values = Array.from({ length: 257 }, (_v, i) => (i * 37) % 101);
    const total = binValues(values, { bins: 12 }).reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(values.length);
  });

  it("reads an ARRAY as the full edge list — k+1 edges make k bins", () => {
    const edges = [0, 1, 4, 24, 168];
    const values = [0.5, 0.9, 2, 3, 10, 20, 30, 100, 167];
    const bins = binValues(values, { bins: edges });
    expect(bins).toHaveLength(edges.length - 1);
    expect(bins.map((entry) => [entry.x0, entry.x1])).toEqual([
      [0, 1],
      [1, 4],
      [4, 24],
      [24, 168],
    ]);
    expect(bins.map((entry) => entry.count)).toEqual([2, 2, 2, 3]);
  });

  it("DROPS a value outside an explicit edge list, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A unique label so the module-level warn-once cache cannot swallow it.
    const bins = binValues([1, 2, 900], { bins: [0, 4, 24], label: `drop-${Math.random()}` });
    const total = bins.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("outside the explicit bin edges");
  });

  it("sorts an unordered edge list rather than producing negative-width bins", () => {
    const bins = binValues([1, 5, 9], { bins: [10, 0, 5] });
    expect(bins.map((entry) => [entry.x0, entry.x1])).toEqual([
      [0, 5],
      [5, 10],
    ]);
  });

  it("bins over a SHARED domain so two groups get identical edges", () => {
    const domain: [number, number] = [0, 100];
    const a = binValues([1, 2, 3], { bins: 4, domain });
    const b = binValues([97, 98, 99], { bins: 4, domain });
    expect(a.map((entry) => entry.x0)).toEqual(b.map((entry) => entry.x0));
    expect(a.map((entry) => entry.x1)).toEqual(b.map((entry) => entry.x1));
  });

  it("returns [] for empty or all-non-finite input", () => {
    expect(binValues([])).toEqual([]);
    expect(binValues([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([]);
    expect(binValues([1, 2, 3], { bins: [5] })).toEqual([]);
  });

  it("carries the values, ascending, alongside the count", () => {
    const bins = binValues([9, 1, 5], { bins: [0, 10] });
    expect(bins[0]?.values).toEqual([1, 5, 9]);
  });
});

describe("defaultBinCount", () => {
  it("is the square-root rule, capped at 30", () => {
    expect(defaultBinCount(0)).toBe(1);
    expect(defaultBinCount(100)).toBe(10);
    expect(defaultBinCount(10_000)).toBe(30);
  });
});

describe("extentOf", () => {
  it("widens a zero-width extent so nothing downstream divides by zero", () => {
    expect(extentOf([4, 4, 4])).toEqual([3.5, 4.5]);
  });

  it("falls back to a unit box when nothing is finite", () => {
    expect(extentOf([])).toEqual([0, 1]);
  });
});
