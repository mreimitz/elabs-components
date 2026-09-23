import { describe, expect, it } from "vitest";
import { createSpatialGrid } from "../canvas-layer/hit-test";
import {
  type ChartMarkGeometry,
  hitsInBand,
  hitsInPolygon,
  hitsInRect,
  pointInPolygon,
  visibleOnly,
} from "./hit-test";

function mark(
  id: string,
  shape: ChartMarkGeometry["shape"],
  extra: Partial<ChartMarkGeometry> = {},
): ChartMarkGeometry {
  return { id, category: id, datum: {}, index: 0, shape, visible: true, ...extra };
}

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("hitsInRect", () => {
  // Bar spanning x 80..120 — half inside a 0..100 rectangle.
  const halfBar = mark("half", { kind: "rect", x: 80, y: 20, w: 40, h: 60 });
  const inside = mark("in", { kind: "rect", x: 10, y: 10, w: 20, h: 20 });
  const outside = mark("out", { kind: "rect", x: 150, y: 10, w: 20, h: 20 });
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it("a bar half inside is hit with overlap, not with contain", () => {
    expect(
      hitsInRect([halfBar, inside, outside], rect, { rule: "overlap" }).map((m) => m.id),
    ).toEqual(["half", "in"]);
    expect(
      hitsInRect([halfBar, inside, outside], rect, { rule: "contain" }).map((m) => m.id),
    ).toEqual(["in"]);
  });

  it("overlap is the default rule", () => {
    expect(hitsInRect([halfBar], rect)).toHaveLength(1);
  });

  it("points hit when inside; circles overlap by radius", () => {
    const p = mark("p", { kind: "point", x: 50, y: 50 });
    const c = mark("c", { kind: "circle", cx: 104, cy: 50, r: 5 });
    expect(hitsInRect([p, c], rect).map((m) => m.id)).toEqual(["p", "c"]);
    expect(hitsInRect([p, c], rect, { rule: "contain" }).map((m) => m.id)).toEqual(["p"]);
  });

  it("hidden marks are never hit by a rectangle", () => {
    const hidden = mark("h", { kind: "point", x: 50, y: 50 }, { visible: false });
    expect(hitsInRect([hidden], rect)).toEqual([]);
  });
});

describe("hitsInPolygon (lasso)", () => {
  it("a hidden point inside a lasso is not hit", () => {
    const visible = mark("v", { kind: "point", x: 50, y: 50 });
    const hidden = mark("h", { kind: "point", x: 60, y: 60 }, { visible: false });
    expect(hitsInPolygon([visible, hidden], square).map((m) => m.id)).toEqual(["v"]);
  });

  it("tests a point / circle on its centre", () => {
    const c = mark("c", { kind: "circle", cx: 102, cy: 50, r: 10 });
    expect(hitsInPolygon([c], square)).toEqual([]);
  });

  it("rects: any corner for overlap, all corners for contain", () => {
    const half = mark("half", { kind: "rect", x: 80, y: 20, w: 40, h: 40 });
    expect(hitsInPolygon([half], square, { rule: "overlap" })).toHaveLength(1);
    expect(hitsInPolygon([half], square, { rule: "contain" })).toHaveLength(0);
  });

  it("a small lasso wholly inside a big bar still overlaps it", () => {
    const big = mark("big", { kind: "rect", x: 0, y: 0, w: 500, h: 500 });
    const tiny = [
      { x: 200, y: 200 },
      { x: 210, y: 200 },
      { x: 205, y: 210 },
    ];
    expect(hitsInPolygon([big], tiny)).toHaveLength(1);
  });

  it("a polygon of fewer than 3 vertices contains nothing", () => {
    expect(pointInPolygon(1, 1, square.slice(0, 2))).toBe(false);
  });
});

describe("hitsInBand (axis range)", () => {
  const bars = ["A", "B", "C", "D", "E", "F"].map((c, i) =>
    mark(c, { kind: "rect", x: i * 100 + 10, y: 0, w: 80, h: 50 }, { index: i }),
  );
  it("a band range [B, D] over A…F yields B, C, D", () => {
    expect(hitsInBand(bars, "x", [110, 390]).map((m) => m.id)).toEqual(["B", "C", "D"]);
  });
  it("hidden marks are excluded unless includeHidden (a time-axis range)", () => {
    const withHidden = [...bars, mark("H", { kind: "point", x: 150, y: 10 }, { visible: false })];
    expect(hitsInBand(withHidden, "x", [110, 190]).map((m) => m.id)).toEqual(["B"]);
    expect(
      hitsInBand(withHidden, "x", [110, 190], { includeHidden: true }).map((m) => m.id),
    ).toEqual(["B", "H"]);
  });
  it("a y band reads the vertical extent", () => {
    const p = mark("p", { kind: "point", x: 0, y: 70 });
    expect(hitsInBand([p], "y", [60, 80])).toHaveLength(1);
    expect(hitsInBand([p], "y", [0, 50])).toHaveLength(0);
  });
});

it("visibleOnly drops visible:false", () => {
  expect(visibleOnly([{ visible: true }, { visible: false }])).toHaveLength(1);
});

describe("canvas SpatialGrid containment reuses the selection predicates", () => {
  const grid = createSpatialGrid<string>(8);
  grid.insert(10, 10, "a");
  grid.insert(40, 40, "b");
  grid.insert(90, 20, "c");
  grid.insert(200, 200, "far");

  it("queryRect", () => {
    expect(grid.queryRect({ x: 0, y: 0, w: 60, h: 60 })).toEqual(["a", "b"]);
  });
  it("queryPolygon matches pointInPolygon", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(grid.queryPolygon(triangle)).toEqual(["a", "b"]);
    expect(grid.queryPolygon(triangle.slice(0, 2))).toEqual([]);
  });
});
