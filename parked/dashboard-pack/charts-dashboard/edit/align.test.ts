import { describe, expect, it } from "vitest";

import type { TileLayout } from "../core/spec";
import { alignTiles, distributeTiles } from "./align";

const LAYOUT: TileLayout[] = [
  { id: "a", x: 0, y: 0, w: 4, h: 2 },
  { id: "b", x: 8, y: 4, w: 6, h: 3 },
  { id: "c", x: 20, y: 10, w: 2, h: 2 },
];

describe("alignTiles", () => {
  it("left sets every id's x to the minimum, leaving y/w/h and other tiles untouched", () => {
    const out = alignTiles(LAYOUT, ["a", "b", "c"], "left");
    expect(out.map((i) => i.x)).toEqual([0, 0, 0]);
    expect(out.map((i) => i.y)).toEqual([0, 4, 10]);
    expect(out.map((i) => i.w)).toEqual([4, 6, 2]);
  });

  it("right aligns the right edges (x + w)", () => {
    const out = alignTiles(LAYOUT, ["a", "b", "c"], "right");
    const rightEdges = out.map((i) => i.x + i.w);
    expect(
      new Set(["a", "b", "c"].map((id) => rightEdges[out.findIndex((i) => i.id === id)])).size,
    ).toBe(1);
  });

  it("top and bottom mirror left/right on the y axis", () => {
    const top = alignTiles(LAYOUT, ["a", "b", "c"], "top");
    expect(top.map((i) => i.y)).toEqual([0, 0, 0]);
    const bottom = alignTiles(LAYOUT, ["a", "b", "c"], "bottom");
    const bottoms = bottom.map((i) => i.y + i.h);
    expect(new Set(bottoms).size).toBe(1);
  });

  it("center-h/center-v align to the selection's bounding-box centre", () => {
    const out = alignTiles(LAYOUT, ["a", "b", "c"], "center-h");
    const centers = out.map((i) => i.x + i.w / 2);
    expect(Math.abs(centers[0]! - centers[1]!)).toBeLessThanOrEqual(1);
    expect(Math.abs(centers[1]! - centers[2]!)).toBeLessThanOrEqual(1);
  });

  it("is a no-op with fewer than two matching ids", () => {
    expect(alignTiles(LAYOUT, ["a"], "left")).toEqual(LAYOUT);
    expect(alignTiles(LAYOUT, [], "left")).toEqual(LAYOUT);
  });

  it("never mutates the input array or its items", () => {
    const input = structuredClone(LAYOUT);
    alignTiles(input, ["a", "b", "c"], "left");
    expect(input).toEqual(LAYOUT);
  });
});

describe("distributeTiles", () => {
  const ROW: TileLayout[] = [
    { id: "a", x: 0, y: 0, w: 4, h: 2 },
    { id: "b", x: 9, y: 0, w: 4, h: 2 },
    { id: "c", x: 20, y: 0, w: 4, h: 2 },
  ];

  it("keeps the first and last fixed and spaces the middle evenly (h)", () => {
    const out = distributeTiles(ROW, ["a", "b", "c"], "h");
    const byId = new Map(out.map((i) => [i.id, i]));
    expect(byId.get("a")!.x).toBe(0);
    expect(byId.get("c")!.x).toBe(20);
    const gapAB = byId.get("b")!.x - (byId.get("a")!.x + byId.get("a")!.w);
    const gapBC = byId.get("c")!.x - (byId.get("b")!.x + byId.get("b")!.w);
    expect(gapAB).toBeCloseTo(gapBC, 5);
  });

  it("distributes along v the same way", () => {
    const col: TileLayout[] = ROW.map((item) => ({ ...item, x: 0, y: item.x }));
    const out = distributeTiles(col, ["a", "b", "c"], "v");
    const byId = new Map(out.map((i) => [i.id, i]));
    expect(byId.get("a")!.y).toBe(0);
    expect(byId.get("c")!.y).toBe(20);
  });

  it("is a no-op with fewer than three matching ids", () => {
    expect(distributeTiles(ROW, ["a", "b"], "h")).toEqual(ROW);
  });

  it("sorts by position first, independent of the ids' input order", () => {
    const shuffled = distributeTiles(ROW, ["c", "a", "b"], "h");
    const ordered = distributeTiles(ROW, ["a", "b", "c"], "h");
    expect(shuffled).toEqual(ordered);
  });
});
