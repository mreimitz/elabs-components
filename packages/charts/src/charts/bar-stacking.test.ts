import { describe, expect, it } from "vitest";
import {
  computeBarStackLayout,
  groupBarRows,
  orderBarRows,
  resolveStackDomain,
  resolveStackMode,
} from "./bar-stacking";

const LIKERT_KEYS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const likertRow = {
  q: "Q1",
  "Strongly disagree": 10,
  Disagree: 20,
  Neutral: 30,
  Agree: 25,
  "Strongly agree": 15,
};

describe("resolveStackMode", () => {
  it("maps the stacked prop onto a layout mode", () => {
    expect(resolveStackMode(undefined)).toBeNull();
    expect(resolveStackMode(false)).toBeNull();
    expect(resolveStackMode(true)).toBe("stacked");
    expect(resolveStackMode("percent")).toBe("percent");
    expect(resolveStackMode("diverging")).toBe("diverging");
  });
});

describe("computeBarStackLayout", () => {
  it("stacked: positives grow up from 0 and negatives down, never cancelling", () => {
    const layout = computeBarStackLayout({
      data: [{ a: 3, b: -2, c: 4 }],
      keys: ["a", "b", "c"],
      mode: "stacked",
    });
    const row = layout.extents.get(0);
    expect(row?.get("a")).toEqual([0, 3]);
    expect(row?.get("b")).toEqual([-2, 0]);
    expect(row?.get("c")).toEqual([3, 7]);
    expect(layout.min).toBe(-2);
    expect(layout.max).toBe(7);
    expect(layout.totals.get(0)).toEqual({ total: 5, end: 7 });
  });

  it("percent: every row ends at exactly 1 and the domain is [0, 1]", () => {
    const layout = computeBarStackLayout({
      data: [
        { a: 1, b: 3 },
        { a: 50, b: 50 },
        { a: 7, b: 0 },
      ],
      keys: ["a", "b"],
      mode: "percent",
    });
    for (const index of [0, 1, 2]) {
      expect(layout.totals.get(index)?.end).toBeCloseTo(1, 10);
    }
    expect(layout.extents.get(0)?.get("a")).toEqual([0, 0.25]);
    expect(layout.extents.get(0)?.get("b")?.[1]).toBeCloseTo(1, 10);
    expect(layout.min).toBe(0);
    expect(resolveStackDomain(layout)).toEqual([0, 1]);
    // Raw totals survive for a totals label.
    expect(layout.totals.get(1)?.total).toBe(100);
  });

  it("diverging: the centre series straddles zero, the rest grow outward from it", () => {
    const layout = computeBarStackLayout({
      data: [likertRow],
      keys: LIKERT_KEYS,
      mode: "diverging",
      divergingCenter: "Neutral",
    });
    const row = layout.extents.get(0);
    expect(row?.get("Neutral")).toEqual([-15, 15]);
    // Nearest-the-centre answer sits against it; the extreme one ends the bar.
    expect(row?.get("Disagree")).toEqual([-35, -15]);
    expect(row?.get("Strongly disagree")).toEqual([-45, -35]);
    expect(row?.get("Agree")).toEqual([15, 40]);
    expect(row?.get("Strongly agree")).toEqual([40, 55]);
    expect(layout.min).toBe(-45);
    expect(layout.max).toBe(55);
    expect(resolveStackDomain(layout)).toBeNull();
  });

  it("diverging with no centre splits the series in half (even-point scale)", () => {
    const layout = computeBarStackLayout({
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      keys: ["a", "b", "c", "d"],
      mode: "diverging",
    });
    const row = layout.extents.get(0);
    expect(row?.get("b")).toEqual([-2, 0]);
    expect(row?.get("a")).toEqual([-3, -2]);
    expect(row?.get("c")).toEqual([0, 3]);
    expect(row?.get("d")).toEqual([3, 7]);
  });

  it("stackOrder asc/desc reorders segments per row, data keeps declaration order", () => {
    const data = [{ a: 5, b: 1, c: 3 }];
    const keys = ["a", "b", "c"];
    const asc = computeBarStackLayout({ data, keys, mode: "stacked", stackOrder: "asc" });
    expect(asc.extents.get(0)?.get("b")).toEqual([0, 1]);
    expect(asc.extents.get(0)?.get("c")).toEqual([1, 4]);
    expect(asc.extents.get(0)?.get("a")).toEqual([4, 9]);
    const desc = computeBarStackLayout({ data, keys, mode: "stacked", stackOrder: "desc" });
    expect(desc.extents.get(0)?.get("a")).toEqual([0, 5]);
    expect(desc.extents.get(0)?.get("b")).toEqual([8, 9]);
    const plain = computeBarStackLayout({ data, keys, mode: "stacked" });
    expect(plain.extents.get(0)?.get("b")).toEqual([5, 6]);
  });

  it("skips rows with no numeric value (e.g. a group header row)", () => {
    const layout = computeBarStackLayout({
      data: [{ name: "header" }, { a: 2 }],
      keys: ["a"],
      mode: "stacked",
    });
    expect(layout.extents.has(0)).toBe(false);
    expect(layout.extents.get(1)?.get("a")).toEqual([0, 2]);
  });
});

describe("orderBarRows", () => {
  const rows = [
    { name: "a", v: 2, w: 9 },
    { name: "b", v: 5, w: 1 },
    { name: "c", v: null, w: 4 },
    { name: "d", v: 3, w: 4 },
  ];

  it("returns the same array when neither sort nor reverse is set", () => {
    expect(orderBarRows(rows, { keys: ["v"] })).toBe(rows);
  });

  it("sorts by the first series, missing values last, stable on ties", () => {
    expect(orderBarRows(rows, { sort: "desc", keys: ["v"] }).map((r) => r.name)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
    expect(orderBarRows(rows, { sort: "asc", keys: ["v"] }).map((r) => r.name)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("sorts by any column with { by, dir } and reverses after sorting", () => {
    expect(
      orderBarRows(rows, { sort: { by: "w", dir: "asc" }, keys: ["v"] }).map((r) => r.name),
    ).toEqual(["b", "c", "d", "a"]);
    expect(orderBarRows(rows, { reverse: true, keys: ["v"] }).map((r) => r.name)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts stacked rows by their total", () => {
    const stackedRows = [
      { name: "x", a: 1, b: 1 },
      { name: "y", a: 0, b: 5 },
    ];
    expect(
      orderBarRows(stackedRows, { sort: "desc", keys: ["a", "b"], stacked: true }).map(
        (r) => r.name,
      ),
    ).toEqual(["y", "x"]);
  });
});

describe("groupBarRows", () => {
  it("groups in order of first appearance, rows keeping their order", () => {
    const groups = groupBarRows(
      [
        { n: 1, g: "B" },
        { n: 2, g: "A" },
        { n: 3, g: "B" },
      ],
      "g",
    );
    expect(groups.map((g) => g.name)).toEqual(["B", "A"]);
    expect(groups[0]?.rows.map((r) => r.n)).toEqual([1, 3]);
  });
});
