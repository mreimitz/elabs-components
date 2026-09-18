import { describe, expect, it } from "vitest";
import { groupSmallSlices, pieLegendItems } from "./pie-grouping";

const eightSlices = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
  { label: "Social", value: 140 },
  { label: "Email", value: 70 },
  { label: "Affiliate", value: 20 },
  { label: "Paid", value: 12 },
  { label: "Other channel", value: 8 },
];

describe("groupSmallSlices", () => {
  it("is a no-op when options is unset", () => {
    const result = groupSmallSlices(eightSlices, undefined);
    expect(result.data).toEqual(eightSlices);
    expect(result.foldedCount).toBe(0);
  });

  it("is a no-op when neither threshold nor max is set", () => {
    const result = groupSmallSlices(eightSlices, { label: "Other" });
    expect(result.data).toEqual(eightSlices);
    expect(result.foldedCount).toBe(0);
  });

  it("folds the smallest slices beyond `max`, keeping the largest individually", () => {
    const result = groupSmallSlices(eightSlices, { max: 5 });
    expect(result.data).toHaveLength(6); // 5 kept + 1 "Other"
    expect(result.data.slice(0, 5).map((d) => d.label)).toEqual([
      "Direct",
      "Organic",
      "Referral",
      "Social",
      "Email",
    ]);
    const other = result.data[5]!;
    expect(other.label).toBe("Other");
    expect(other.value).toBe(20 + 12 + 8);
    expect(other.categories).toEqual(["Affiliate", "Paid", "Other channel"]);
    expect(result.foldedCount).toBe(3);
  });

  it("folds slices below a fraction `threshold` of the total", () => {
    // total = 1040; 8/1040 ≈ 0.0077, 12/1040 ≈ 0.0115, 20/1040 ≈ 0.0192, 70/1040 ≈ 0.0673
    const result = groupSmallSlices(eightSlices, { threshold: 0.02 });
    const other = result.data.find((d) => d.label === "Other");
    expect(other?.categories).toEqual(["Affiliate", "Paid", "Other channel"]);
  });

  it("applies threshold and max together (either gate folds a slice)", () => {
    const result = groupSmallSlices(eightSlices, { threshold: 0.1, max: 6 });
    // threshold 0.1 (10% of 1040 = 104) folds Email(70)/Affiliate(20)/Paid(12)/Other channel(8);
    // max=6 alone would only need to fold 2 of the smallest (already covered above).
    const other = result.data.find((d) => d.label === "Other");
    expect(other?.categories?.sort()).toEqual(
      ["Email", "Affiliate", "Paid", "Other channel"].sort(),
    );
  });

  it("uses a custom label", () => {
    const result = groupSmallSlices(eightSlices, { max: 5, label: "Rest" });
    expect(result.data.at(-1)?.label).toBe("Rest");
  });

  it("never folds every slice away — the single largest stays out", () => {
    const tiny = [
      { label: "A", value: 1 },
      { label: "B", value: 1 },
      { label: "C", value: 2 },
    ];
    const result = groupSmallSlices(tiny, { threshold: 1 }); // every slice is < 100% of the total
    expect(result.data.some((d) => d.label === "C")).toBe(true); // largest kept
    expect(result.foldedCount).toBe(2);
  });

  it("no-ops on an empty array", () => {
    expect(groupSmallSlices([], { max: 5 })).toEqual({ data: [], foldedCount: 0 });
  });

  it("no-ops when the total is zero or negative", () => {
    const zeroed = [
      { label: "A", value: 0 },
      { label: "B", value: 0 },
    ];
    expect(groupSmallSlices(zeroed, { max: 1 }).foldedCount).toBe(0);
  });
});

describe("pieLegendItems", () => {
  const getColor = (i: number) => `color-${i}`;

  it("mirrors groupSmallSlices' fold and carries percent-ready maxValue", () => {
    const items = pieLegendItems(eightSlices, { groupSmall: { max: 5 }, getColor, sort: "none" });
    expect(items).toHaveLength(6);
    const total = eightSlices.reduce((s, d) => s + d.value, 0);
    for (const item of items) {
      expect(item.maxValue).toBe(total);
    }
    expect(items.at(-1)?.label).toBe("Other");
  });

  it("sorts descending by value by default", () => {
    const unsorted = [
      { label: "A", value: 10 },
      { label: "B", value: 50 },
      { label: "C", value: 30 },
    ];
    const items = pieLegendItems(unsorted, { getColor });
    expect(items.map((i) => i.label)).toEqual(["B", "C", "A"]);
  });

  it("`sort: 'none'` keeps input order", () => {
    const unsorted = [
      { label: "A", value: 10 },
      { label: "B", value: 50 },
      { label: "C", value: 30 },
    ];
    const items = pieLegendItems(unsorted, { getColor, sort: "none" });
    expect(items.map((i) => i.label)).toEqual(["A", "B", "C"]);
  });

  it("colors resolve against the GROUPED index, not the original", () => {
    const items = pieLegendItems(eightSlices, {
      groupSmall: { max: 5 },
      getColor,
      sort: "none",
    });
    expect(items.map((i) => i.color)).toEqual([
      "color-0",
      "color-1",
      "color-2",
      "color-3",
      "color-4",
      "color-5",
    ]);
  });
});
