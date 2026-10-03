// density-scatter-glyphs.test.ts — `shapeBy`: the glyph bytes, the deal-out
// order, and the signed distances the WebGL shader and the Canvas-2D stamps share.

import { describe, expect, it } from "vitest";
import { densityShapeDistance } from "./points-renderer";
import { dealShapes, resolveShapeClasses, shapeIndex } from "./shapes";
import { densityShapePath } from "./density-shape-glyph";
import { DENSITY_SHAPES, DENSITY_SHAPE_CYCLE, type DensityPoints } from "./types";

function points(codes: number[], labels: string[]): DensityPoints {
  return {
    x: new Float32Array(codes.length),
    y: new Float32Array(codes.length),
    n: codes.length,
    values: {},
    categories: { airline: { codes: Uint16Array.from(codes), labels } },
  };
}

describe("dealShapes", () => {
  it("deals the cycle in first-seen order and keeps named values out of it", () => {
    const entries = dealShapes(["A", "B", "C", "D"], { shapes: { B: "star" } });
    expect(entries.map((e) => e.shape)).toEqual([
      DENSITY_SHAPE_CYCLE[0],
      "star",
      DENSITY_SHAPE_CYCLE[1],
      DENSITY_SHAPE_CYCLE[2],
    ]);
  });

  it("falls back to the cycle for a name it does not know", () => {
    const entries = dealShapes(["A"], { shapes: { A: "blob" as never } });
    expect(entries[0]!.shape).toBe(DENSITY_SHAPE_CYCLE[0]);
  });

  it("honours a custom cycle and wraps it", () => {
    const entries = dealShapes(["A", "B", "C"], { cycle: ["plus", "minus"] });
    expect(entries.map((e) => e.shape)).toEqual(["plus", "minus", "plus"]);
  });
});

describe("resolveShapeClasses", () => {
  it("writes one glyph byte per point, by the point's code", () => {
    const pts = points([0, 1, 1, 2, 0], ["A", "B", "C"]);
    const r = resolveShapeClasses(pts, {
      kind: "category",
      key: "airline",
      shapes: { C: "triangle-down" },
    });
    expect(r).not.toBeNull();
    expect(Array.from(r!.shapes)).toEqual([
      shapeIndex("circle"),
      shapeIndex("square"),
      shapeIndex("square"),
      shapeIndex("triangle-down"),
      shapeIndex("circle"),
    ]);
    expect(r!.entries.map((e) => e.label)).toEqual(["A", "B", "C"]);
  });

  it("is null without a shapeBy or without the column", () => {
    const pts = points([0], ["A"]);
    expect(resolveShapeClasses(pts, undefined)).toBeNull();
    expect(resolveShapeClasses(pts, { kind: "category", key: "nope" })).toBeNull();
  });
});

describe("densityShapeDistance", () => {
  const r = 4;
  it("is negative at the centre and positive well outside for every glyph", () => {
    DENSITY_SHAPES.forEach((_, k) => {
      expect(densityShapeDistance(k, 0, 0, r)).toBeLessThan(0);
      expect(densityShapeDistance(k, 3 * r, 3 * r, r)).toBeGreaterThan(0);
    });
  });
  it("keeps the circle byte-identical to the old formula", () => {
    expect(densityShapeDistance(0, 3, 4, r)).toBeCloseTo(5 - r);
  });
  it("points the triangle up and the down triangle down (screen y grows downward)", () => {
    const up = shapeIndex("triangle");
    const down = shapeIndex("triangle-down");
    // Just above the centre lies inside the up triangle, outside the down one; and vice versa.
    expect(densityShapeDistance(up, 0, -0.9 * r, r)).toBeLessThan(0);
    expect(densityShapeDistance(down, 0, -0.9 * r, r)).toBeGreaterThan(0);
    expect(densityShapeDistance(down, 0, 0.9 * r, r)).toBeLessThan(0);
    expect(densityShapeDistance(up, 0, 0.9 * r, r)).toBeGreaterThan(0);
  });
  it("gives the minus a horizontal bar only, and the plus both bars", () => {
    const plus = shapeIndex("plus");
    const minus = shapeIndex("minus");
    expect(densityShapeDistance(minus, 0.8 * r, 0, r)).toBeLessThan(0);
    expect(densityShapeDistance(minus, 0, 0.8 * r, r)).toBeGreaterThan(0);
    expect(densityShapeDistance(plus, 0, 0.8 * r, r)).toBeLessThan(0);
  });
  it("never reaches past the sprite extent used by the renderers", () => {
    DENSITY_SHAPES.forEach((_, k) => {
      // Every point on a ring at 1.35 r is outside every glyph.
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        expect(
          densityShapeDistance(k, Math.cos(a) * 1.35 * r, Math.sin(a) * 1.35 * r, r),
        ).toBeGreaterThan(0);
      }
    });
  });
});

describe("densityShapePath", () => {
  it("builds a closed path for every glyph", () => {
    for (const shape of DENSITY_SHAPES) {
      const d = densityShapePath(shape, 10);
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
    }
  });
});
