import { describe, expect, it } from "vitest";
import { seededRnd } from "../../marks/seeded-rnd";
import { condenseOverview } from "./condense-overview";

describe("condenseOverview", () => {
  it("keeps a one-row spike in its bucket's max (10 000 rows → 200 buckets)", () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => ({
      value: 40 + seededRnd(i, 140) * 20,
      i,
    }));
    rows[3141] = { value: 999, i: 3141 };
    const buckets = condenseOverview(rows, ["value"], 200);
    expect(buckets).toHaveLength(200);
    const bucket = buckets[Math.floor(3141 / (10_000 / 200))]!;
    expect(bucket.max).toBe(999);
    expect(bucket.x0).toBeLessThanOrEqual(3141);
    expect(bucket.x1).toBeGreaterThanOrEqual(3141);
    // …and it is the only bucket that sees it.
    expect(buckets.filter((b) => b.max === 999)).toHaveLength(1);
  });

  it("keeps a one-row dip in its bucket's min", () => {
    const rows = Array.from({ length: 1000 }, () => ({ v: 10 }));
    rows[777] = { v: -5 };
    const buckets = condenseOverview(rows, ["v"], 50);
    expect(buckets[Math.floor(777 / 20)]!.min).toBe(-5);
  });

  it("returns every row as its own bucket when rows <= bucketCount", () => {
    const rows = [
      { a: 1, b: 5 },
      { a: 3, b: 2 },
      { a: null, b: null },
    ];
    expect(condenseOverview(rows, ["a", "b"], 10)).toEqual([
      { x: 0, x0: 0, x1: 0, min: 1, max: 5 },
      { x: 1, x0: 1, x1: 1, min: 2, max: 3 },
      { x: 2, x0: 2, x1: 2, min: Number.NaN, max: Number.NaN },
    ]);
  });

  it("pools stack totals when stacked", () => {
    const rows = [
      { a: 1, b: 5 },
      { a: 3, b: 2 },
      { a: 10, b: 10 },
      { a: 0, b: 1 },
    ];
    const buckets = condenseOverview(rows, ["a", "b"], 2, { stacked: true });
    expect(buckets.map((b) => [b.min, b.max])).toEqual([
      [5, 6],
      [1, 20],
    ]);
  });

  it("uses the xAccessor for bucket positions", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ t: 1000 + i * 10, v: i }));
    const buckets = condenseOverview(rows, ["v"], 2, { xAccessor: (row) => row.t as number });
    expect(buckets.map((b) => [b.x0, b.x1, b.x])).toEqual([
      [1000, 1010, 1005],
      [1020, 1030, 1025],
    ]);
  });

  /**
   * What keeps a 50 000-row overview cheap is that condensing is ONE linear
   * pass: every value is read exactly once, however many buckets it lands in,
   * and no bucket re-scans its neighbours. That is counted here, not timed — a
   * wall-clock ceiling measured the machine's load instead (116 ms against a
   * 100 ms limit in a full-suite run, a few ms on its own).
   */
  it("condenses 50 000 rows in one pass — every value read exactly once", () => {
    let reads = 0;
    const rows = Array.from({ length: 50_000 }, (_, i) => {
      const a = seededRnd(i, 7);
      const b = seededRnd(i, 8);
      return {
        get a() {
          reads += 1;
          return a;
        },
        get b() {
          reads += 1;
          return b;
        },
      };
    });

    for (const bucketCount of [400, 4_000]) {
      reads = 0;
      const buckets = condenseOverview(rows, ["a", "b"], bucketCount);
      expect(buckets).toHaveLength(bucketCount);
      // 50 000 rows × 2 keys, independent of the bucket count: linear in the
      // rows, never rows × buckets.
      expect(reads).toBe(50_000 * 2);
    }
  });
});
