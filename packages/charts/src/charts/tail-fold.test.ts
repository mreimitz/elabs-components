/**
 * tail-fold.test.ts — the partition/sum bookkeeping Pie's "Other" wedge and
 * Treemap's long-tail merge share (RM-204 fix round, P2 item 7: this had no
 * unit test of its own, only indirect coverage through those two families).
 */
import { describe, expect, it } from "vitest";
import { foldTail } from "./tail-fold";

describe("foldTail", () => {
  const items = ["a", "b", "c", "d"];
  const valueOf = (item: string) => ({ a: 1, b: 2, c: 3, d: 4 })[item as "a" | "b" | "c" | "d"];

  it("splits kept vs folded by index, each in original relative order", () => {
    const result = foldTail(items, new Set([1, 3]), valueOf);
    expect(result.kept).toEqual(["a", "c"]);
    expect(result.folded).toEqual(["b", "d"]);
  });

  it("sums valueOf across only the folded members", () => {
    const result = foldTail(items, new Set([1, 3]), valueOf);
    expect(result.foldedValue).toBe(2 + 4);
  });

  it("folds nothing when the index set is empty — foldedValue is 0, not NaN", () => {
    const result = foldTail(items, new Set(), valueOf);
    expect(result.kept).toEqual(items);
    expect(result.folded).toEqual([]);
    expect(result.foldedValue).toBe(0);
  });

  it("folds everything when every index is in the set", () => {
    const result = foldTail(items, new Set([0, 1, 2, 3]), valueOf);
    expect(result.kept).toEqual([]);
    expect(result.folded).toEqual(items);
    expect(result.foldedValue).toBe(10);
  });

  it("ignores an out-of-range index — it never matches a real item", () => {
    const result = foldTail(items, new Set([99]), valueOf);
    expect(result.kept).toEqual(items);
    expect(result.folded).toEqual([]);
  });

  it("handles an empty item list", () => {
    const result = foldTail([], new Set([0]), valueOf);
    expect(result).toEqual({ kept: [], folded: [], foldedValue: 0 });
  });
});
