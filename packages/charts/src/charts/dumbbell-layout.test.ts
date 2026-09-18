import { describe, expect, it } from "vitest";
import { buildDumbbellRows } from "./dumbbell-chart";
import {
  arrowHeadPath,
  arrowHeadPoints,
  buildDumbbellBands,
  dumbbellDeltaPercent,
  sortDumbbellRowsBy,
} from "./dumbbell-layout";

const data = [
  { region: "North", team: "A", before: 100, after: 120 },
  { region: "South", team: "A", before: 50, after: 40 },
  { region: "East", team: "B", before: 10, after: 30 },
  { region: "West", team: "B", before: 0, after: 5 },
];
const rows = buildDumbbellRows(data, "region", "before", "after");

describe("dumbbellDeltaPercent", () => {
  it("divides delta by start", () => {
    expect(dumbbellDeltaPercent(rows[0]!)).toBeCloseTo(0.2);
    expect(dumbbellDeltaPercent(rows[1]!)).toBeCloseTo(-0.2);
  });

  it("reads a zero start as a signed extreme, not NaN", () => {
    expect(dumbbellDeltaPercent(rows[3]!)).toBe(Number.POSITIVE_INFINITY);
    const flat = buildDumbbellRows(
      [{ region: "Flat", before: 0, after: 0 }],
      "region",
      "before",
      "after",
    );
    expect(dumbbellDeltaPercent(flat[0]!)).toBe(0);
  });
});

describe("sortDumbbellRowsBy", () => {
  it('"none" and "data" both return spreadsheet order, "none" returning the same reference', () => {
    expect(sortDumbbellRowsBy(rows, "none")).toBe(rows);
    expect(sortDumbbellRowsBy(rows, "data").map((r) => r.category)).toEqual([
      "North",
      "South",
      "East",
      "West",
    ]);
  });

  it('"start"/"end" sort ascending on the signed value', () => {
    expect(sortDumbbellRowsBy(rows, "start").map((r) => r.category)).toEqual([
      "West",
      "East",
      "South",
      "North",
    ]);
    expect(sortDumbbellRowsBy(rows, "end").map((r) => r.category)).toEqual([
      "West",
      "East",
      "South",
      "North",
    ]);
  });

  it('"delta" sorts descending by |delta| regardless of sign', () => {
    expect(sortDumbbellRowsBy(rows, "delta").map((r) => r.category)).toEqual([
      "North",
      "East",
      "South",
      "West",
    ]);
  });

  it('"deltaPercent" sorts descending by |delta / start|, a zero start reading as the extreme', () => {
    expect(sortDumbbellRowsBy(rows, "deltaPercent").map((r) => r.category)).toEqual([
      "West",
      "East",
      "North",
      "South",
    ]);
  });

  it('"label" sorts ascending alphabetically', () => {
    expect(sortDumbbellRowsBy(rows, "label").map((r) => r.category)).toEqual([
      "East",
      "North",
      "South",
      "West",
    ]);
  });

  it('reverse flips the resolved order, including for "none"', () => {
    expect(sortDumbbellRowsBy(rows, "none", true).map((r) => r.category)).toEqual([
      "West",
      "East",
      "South",
      "North",
    ]);
    expect(sortDumbbellRowsBy(rows, "label", true).map((r) => r.category)).toEqual([
      "West",
      "South",
      "North",
      "East",
    ]);
  });
});

describe("buildDumbbellBands", () => {
  it("returns one row band per row, no headers, when groupBy is unset", () => {
    const bands = buildDumbbellBands(rows);
    expect(bands).toHaveLength(4);
    expect(bands.every((b) => b.kind === "row")).toBe(true);
  });

  it("groups by the named column, one header band per first-seen group value", () => {
    const bands = buildDumbbellBands(rows, "team");
    expect(bands.map((b) => (b.kind === "header" ? `#${b.label}` : b.row.category))).toEqual([
      "#A",
      "North",
      "South",
      "#B",
      "East",
      "West",
    ]);
  });

  it("keeps each row's relative order within its group", () => {
    const sorted = sortDumbbellRowsBy(rows, "delta");
    const bands = buildDumbbellBands(sorted, "team");
    const categories = bands
      .filter((b) => b.kind === "row")
      .map((b) => (b as { row: (typeof rows)[number] }).row.category);
    // "delta" order is North, East, South, West; grouped by team (A, B in
    // first-seen order) keeps North before South (both team A) and East
    // before West (both team B).
    expect(categories).toEqual(["North", "South", "East", "West"]);
  });
});

describe("arrowHeadPoints / arrowHeadPath", () => {
  it("places the tip at (x2, y2) and the base perpendicular to the line, centred on it", () => {
    const points = arrowHeadPoints(0, 0, 10, 0, 6, 4);
    expect(points.tip).toEqual([10, 0]);
    expect(points.left[0]).toBeCloseTo(4);
    expect(points.left[1]).toBeCloseTo(2);
    expect(points.right[0]).toBeCloseTo(4);
    expect(points.right[1]).toBeCloseTo(-2);
  });

  it("falls back to pointing +x for a zero-length line instead of producing NaN", () => {
    const points = arrowHeadPoints(5, 5, 5, 5, 6, 4);
    expect(points.left.every((n) => Number.isFinite(n))).toBe(true);
    expect(points.right.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("renders a closed 3-point triangle path", () => {
    const path = arrowHeadPath(arrowHeadPoints(0, 0, 10, 0, 6, 4));
    expect(path).toBe("M 10,0 L 4,2 L 4,-2 Z");
  });
});
