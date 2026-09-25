import { describe, expect, it } from "vitest";
import { pivotData } from "./pivot";

const sales = [
  { region: "EU", product: "A", quarter: "Q1", revenue: 10 },
  { region: "EU", product: "A", quarter: "Q2", revenue: 20 },
  { region: "EU", product: "B", quarter: "Q1", revenue: 5 },
  { region: "US", product: "A", quarter: "Q1", revenue: 7 },
  { region: "US", product: "A", quarter: "Q1", revenue: 3 },
];

describe("pivotData", () => {
  it("makes one row per key combination and one column per pivot value, plus totals", () => {
    const { rows, columns, columnValues } = pivotData(sales, {
      rows: ["region"],
      columns: "quarter",
      values: [{ field: "revenue", aggregate: "sum" }],
    });
    expect(columnValues).toEqual(["Q1", "Q2"]);
    expect(columns.map((c) => c.id)).toEqual(["region", "p:Q1", "p:Q2", "p:\u0000total"]);
    const eu = rows.find((r) => r.region === "EU")!;
    expect([eu["p:Q1"], eu["p:Q2"], eu["p:\u0000total"]]).toEqual([15, 20, 35]);
    const us = rows.find((r) => r.region === "US")!;
    expect(us["p:Q2"]).toBeNull();
    expect(columns[1]!.meta).toMatchObject({ numeric: true, aggregate: "sum" });
  });

  it("groups headers when there are several values, and counts / averages", () => {
    const { rows, columns } = pivotData(sales, {
      rows: ["region", "product"],
      columns: "quarter",
      values: [
        { field: "revenue", aggregate: "mean", label: "Avg" },
        { field: "revenue", aggregate: "count" },
      ],
      rowTotals: false,
    });
    expect(columns).toHaveLength(4);
    expect((columns[2] as unknown as { columns: unknown[] }).columns).toHaveLength(2);
    const usA = rows.find((r) => r.region === "US" && r.product === "A")!;
    expect(usA["p:Q1:0"]).toBe(5);
    expect(usA["p:Q1:1"]).toBe(2);
    expect(usA["p:Q2:1"]).toBe(0);
    // A mean does not total by summing.
    expect(
      (columns[2] as unknown as { columns: Array<{ meta: { aggregate?: string } }> }).columns[0]!
        .meta.aggregate,
    ).toBeUndefined();
  });

  it("summarises without a pivot field", () => {
    const { rows, columns } = pivotData(sales, {
      rows: ["product"],
      values: [{ field: "revenue", aggregate: "max" }],
    });
    expect(columns.map((c) => c.header)).toEqual(["product", "revenue"]);
    expect(rows.find((r) => r.product === "A")!["p:\u0000total"]).toBe(20);
  });
});
