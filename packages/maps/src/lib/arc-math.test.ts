import { describe, expect, it } from "vitest";

import { buildArcCoordinates } from "./arc-math";

describe("buildArcCoordinates", () => {
  it("returns a straight two-point line when curvature is 0", () => {
    expect(buildArcCoordinates([0, 0], [10, 10], 0, 64)).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it("returns a straight line for identical endpoints", () => {
    expect(buildArcCoordinates([5, 5], [5, 5], 0.3, 64)).toEqual([
      [5, 5],
      [5, 5],
    ]);
  });

  it("samples `samples + 1` points for a curved arc, anchored at both ends", () => {
    const points = buildArcCoordinates([0, 0], [20, 0], 0.2, 16);
    expect(points).toHaveLength(17);
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)).toEqual([20, 0]);
    // The midpoint bows away from the straight line.
    const mid = points[8]!;
    expect(Math.abs(mid[1])).toBeGreaterThan(0);
  });

  it("unwraps the destination longitude across the antimeridian (Tokyo → SF)", () => {
    const points = buildArcCoordinates([139.7, 35.7], [-122.4, 37.8], 0, 64);
    // -122.4 unwraps to 237.6 so the arc crosses the Pacific, not the Atlantic.
    expect(points.at(-1)![0]).toBeCloseTo(237.6, 5);
  });

  it("keeps a plan coordinate where it was put when wrapping is off", () => {
    // A 1600-unit-wide hall: x = 900 is a place on the floor, not a longitude.
    // Unwrapping it to 540 would move the arc's end 360 units to the left.
    const wrapped = buildArcCoordinates([100, 50], [900, 50], 0, 8);
    const plan = buildArcCoordinates([100, 50], [900, 50], 0, 8, false);

    expect(wrapped.at(-1)![0]).toBe(540);
    expect(plan.at(-1)![0]).toBe(900);
  });

  it("still curves in plan space, symmetrically about the straight line", () => {
    const points = buildArcCoordinates([0, 0], [800, 0], 0.2, 16, false);

    expect(points).toHaveLength(17);
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)).toEqual([800, 0]);
    expect(Math.abs(points[8]![1])).toBeGreaterThan(0);
  });

  it("bends to the opposite side with negative curvature", () => {
    const up = buildArcCoordinates([0, 0], [20, 0], 0.2, 8);
    const down = buildArcCoordinates([0, 0], [20, 0], -0.2, 8);
    expect(Math.sign(up[4]![1])).toBe(-Math.sign(down[4]![1]));
  });
});
