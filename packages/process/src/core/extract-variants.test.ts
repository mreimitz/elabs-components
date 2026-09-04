import { describe, expect, it } from "vitest";

import { discoverGraph } from "./discover-graph";
import { extractVariants, variantId, variantKey, VARIANT_KEY_SEPARATOR } from "./extract-variants";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import fixture from "./fixtures/order-to-cash-small.json";
import type { EventLog } from "./types";

const orderToCash = fixture as EventLog;

describe("variantKey / variantId", () => {
  it("joins on a C0 control character no activity name can contain", () => {
    expect(VARIANT_KEY_SEPARATOR).toHaveLength(1);
    expect(VARIANT_KEY_SEPARATOR.charCodeAt(0)).toBe(1);
    expect(variantKey(["A", "B"]).split(VARIANT_KEY_SEPARATOR)).toEqual(["A", "B"]);
  });

  it("does not collide for sequences a printable separator would merge", () => {
    // "A, B" as one activity vs "A" then "B" — a comma separator would key both "A, B".
    expect(variantId(["A, B"])).not.toBe(variantId(["A", " B"]));
  });

  it("is stable across calls and sensitive to order", () => {
    expect(variantId(["A", "B", "C"])).toBe(variantId(["A", "B", "C"]));
    expect(variantId(["A", "B", "C"])).not.toBe(variantId(["C", "B", "A"]));
  });
});

describe("extractVariants on the 5-case order-to-cash fixture", () => {
  const variants = extractVariants(orderToCash);

  it("groups the five cases into the four hand-counted variants", () => {
    expect(variants.map((v) => [v.count, v.caseIds])).toEqual([
      [2, ["case-1", "case-2"]],
      [1, ["case-4"]],
      [1, ["case-5"]],
      [1, ["case-3"]],
    ]);
    expect(variants[0]?.sequence).toEqual([
      "Create Order",
      "Check Credit",
      "Approve Order",
      "Ship Order",
      "Send Invoice",
      "Receive Payment",
    ]);
  });

  it("agrees with discoverGraph on the variant count", () => {
    expect(variants).toHaveLength(discoverGraph(orderToCash).totals.variants);
  });

  it("sums share to 1", () => {
    const total = variants.reduce((sum, variant) => sum + variant.share, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(variants.map((v) => v.share)).toEqual([0.4, 0.2, 0.2, 0.2]);
  });

  it("keeps cumulativeShare monotonically non-decreasing, ending exactly at 1", () => {
    let previous = 0;
    for (const variant of variants) {
      expect(variant.cumulativeShare).toBeGreaterThanOrEqual(previous);
      previous = variant.cumulativeShare;
    }
    expect(variants.map((v) => v.cumulativeShare)).toEqual([0.4, 0.6, 0.8, 1]);
    expect(variants[variants.length - 1]?.cumulativeShare).toBe(1);
  });

  it("summarizes END-TO-END case durations, not step durations", () => {
    // case-1 and case-2 each run 09:00 to 14:00 — five hours.
    expect(variants[0]?.duration).toEqual({
      min: 18_000_000,
      max: 18_000_000,
      mean: 18_000_000,
      median: 18_000_000,
      p90: 18_000_000,
      sum: 36_000_000,
      trimmedMean: 18_000_000,
    });
    // case-3 is rejected after two hours; case-5 runs ten.
    expect(variants[3]?.duration.sum).toBe(7_200_000);
    expect(variants[2]?.duration.sum).toBe(36_000_000);
  });

  it("gives every variant a distinct, reproducible id", () => {
    const ids = variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(extractVariants(orderToCash).map((v) => v.id));
    expect(variants[0]?.id).toBe(variantId(variants[0]?.sequence ?? []));
  });
});

describe("extractVariants ordering and edge cases", () => {
  it("ranks by count descending and breaks ties by key, so the order is total", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "B", timestamp: 0 },
        { caseId: "c2", activity: "A", timestamp: 0 },
        { caseId: "c3", activity: "C", timestamp: 0 },
        { caseId: "c4", activity: "C", timestamp: 1 },
      ],
    };
    expect(extractVariants(log).map((v) => [v.sequence, v.count])).toEqual([
      [["C"], 2],
      [["A"], 1],
      [["B"], 1],
    ]);
  });

  it("answers an empty log with an empty array, not a zero-count variant", () => {
    expect(extractVariants({ events: [] })).toEqual([]);
  });

  it("holds the two invariants on a large synthetic log too", () => {
    const variants = extractVariants(generateSyntheticLog({ cases: 500, seed: 7 }));
    expect(variants.length).toBeGreaterThan(1);
    expect(variants.reduce((sum, v) => sum + v.share, 0)).toBeCloseTo(1, 10);
    let previous = 0;
    for (const variant of variants) {
      expect(variant.cumulativeShare).toBeGreaterThanOrEqual(previous);
      previous = variant.cumulativeShare;
    }
    expect(previous).toBe(1);
    expect(variants.reduce((sum, v) => sum + v.count, 0)).toBe(500);
  });
});
