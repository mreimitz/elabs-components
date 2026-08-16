import { describe, expect, it } from "vitest";
import {
  DEFAULT_SKELETON_CATEGORY_COUNT,
  DEFAULT_SKELETON_CATEGORY_KEY,
  DEFAULT_SKELETON_CATEGORY_LABEL,
  generateCategoricalSkeletonData,
  generateChartSkeletonData,
  generateChartSkeletonFromTarget,
} from "./generate-chart-skeleton-data";

describe("generateChartSkeletonData", () => {
  it("returns pointCount rows keyed by dataKey with a date field", () => {
    const rows = generateChartSkeletonData({ dataKey: "revenue", pointCount: 4 });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.date).toBeInstanceOf(Date);
      expect(typeof row.revenue).toBe("number");
    }
  });
});

describe("generateChartSkeletonFromTarget", () => {
  it("keeps the target row shape but overrides the numeric key", () => {
    const target = [
      { date: new Date("2025-01-01"), value: 999, label: "kept" },
      { date: new Date("2025-01-02"), value: 999, label: "kept" },
    ];
    const rows = generateChartSkeletonFromTarget(target, "value");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.label).toBe("kept");
    expect(rows[0]?.value).not.toBe(999);
  });
});

describe("generateCategoricalSkeletonData", () => {
  it("defaults to 6 rows keyed by 'name'/'value'", () => {
    const rows = generateCategoricalSkeletonData();
    expect(rows).toHaveLength(DEFAULT_SKELETON_CATEGORY_COUNT);
    for (const row of rows) {
      expect(typeof row[DEFAULT_SKELETON_CATEGORY_KEY]).toBe("string");
      expect(typeof row.value).toBe("number");
    }
  });

  it("respects categoryCount and categoryKey", () => {
    const rows = generateCategoricalSkeletonData({ categoryCount: 3, categoryKey: "month" });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toHaveProperty("month");
    }
  });

  it("renders every category as the placeholder em dash visually", () => {
    const rows = generateCategoricalSkeletonData({ categoryCount: 5 });
    for (const row of rows) {
      expect(String(row[DEFAULT_SKELETON_CATEGORY_KEY])).toMatch(
        new RegExp(`^${DEFAULT_SKELETON_CATEGORY_LABEL}`),
      );
    }
  });

  it("keeps every category value unique so scaleBand doesn't collapse positions", () => {
    const rows = generateCategoricalSkeletonData({ categoryCount: 8 });
    const values = rows.map((row) => row[DEFAULT_SKELETON_CATEGORY_KEY]);
    expect(new Set(values).size).toBe(8);
  });

  it("seeds every requested dataKey with a distinct numeric series", () => {
    const rows = generateCategoricalSkeletonData({ dataKeys: ["revenue", "profit"] });
    for (const row of rows) {
      expect(typeof row.revenue).toBe("number");
      expect(typeof row.profit).toBe("number");
    }
    // Different series shouldn't be numerically identical across the board.
    const revenues = rows.map((r) => r.revenue);
    const profits = rows.map((r) => r.profit);
    expect(revenues).not.toEqual(profits);
  });

  it("falls back to a single 'value' key when dataKeys is omitted", () => {
    const rows = generateCategoricalSkeletonData({ dataKey: "revenue" });
    for (const row of rows) {
      expect(row).toHaveProperty("revenue");
      expect(Object.keys(row)).toHaveLength(2); // categoryKey + dataKey
    }
  });
});
