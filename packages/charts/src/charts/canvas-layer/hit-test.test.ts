/**
 * hit-test.test.ts — RM-046 acceptance: the hover lookup stays sub-linear.
 *
 * The load-bearing assertion here is the CANDIDATE COUNT, not the clock: a
 * wall-time budget on CI hardware is a flake generator, while "the grid
 * measured 36 distances where a scan would have measured 50,176" is the same
 * number on every machine and is the property that actually has to hold. The
 * timing assertion is kept as a loose sanity bound on top of it.
 */

import { describe, expect, it } from "vitest";
import { createSpatialGrid } from "./hit-test";

interface Point {
  id: number;
  x: number;
  y: number;
}

/** 224 × 224 = 50,176 points on a 4px lattice — the RM-046 scale target. */
function lattice(): Point[] {
  const points: Point[] = [];
  let id = 0;
  for (let ix = 0; ix < 224; ix++) {
    for (let iy = 0; iy < 224; iy++) {
      points.push({ id: id++, x: ix * 4, y: iy * 4 });
    }
  }
  return points;
}

/** The baseline the grid has to beat: every point, every query. */
function bruteForceNearest(points: Point[], x: number, y: number, radius: number): Point | null {
  let best: Point | null = null;
  let bestDistanceSq = radius * radius;
  for (const point of points) {
    const dx = point.x - x;
    const dy = point.y - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq <= bestDistanceSq && (best === null || distanceSq < bestDistanceSq)) {
      bestDistanceSq = distanceSq;
      best = point;
    }
  }
  return best;
}

describe("createSpatialGrid", () => {
  it("rejects a non-positive cell size instead of degenerating into a linear scan", () => {
    expect(() => createSpatialGrid(0)).toThrow(RangeError);
    expect(() => createSpatialGrid(-4)).toThrow(RangeError);
    expect(() => createSpatialGrid(Number.NaN)).toThrow(RangeError);
  });

  it("returns the nearest datum inside the radius and null outside it", () => {
    const grid = createSpatialGrid<string>(10);
    grid.insert(10, 10, "a");
    grid.insert(40, 40, "b");

    expect(grid.query(12, 12, 8)).toBe("a");
    expect(grid.query(38, 41, 8)).toBe("b");
    expect(grid.query(25, 25, 8)).toBeNull();
  });

  it("prefers the nearer of two points in the same cell, and is stable on a tie", () => {
    const grid = createSpatialGrid<string>(20);
    grid.insert(10, 10, "near");
    grid.insert(18, 10, "far");
    expect(grid.query(11, 10, 12)).toBe("near");

    const tied = createSpatialGrid<string>(20);
    tied.insert(10, 10, "first");
    tied.insert(10, 10, "second");
    expect(tied.query(10, 10, 4)).toBe("first");
    expect(tied.query(10, 10, 4)).toBe("first");
  });

  it("finds a point in a NEIGHBOURING cell (the off-by-one a naive grid gets wrong)", () => {
    const grid = createSpatialGrid<string>(10);
    // Sits at the top-left corner of cell (2,2); the query is in cell (1,1).
    grid.insert(20, 20, "corner");
    expect(grid.query(19, 19, 4)).toBe("corner");
  });

  it("ignores non-finite coordinates rather than poisoning a cell", () => {
    const grid = createSpatialGrid<string>(10);
    grid.insert(Number.NaN, 10, "bad");
    grid.insert(10, Number.POSITIVE_INFINITY, "worse");
    expect(grid.size).toBe(0);
    expect(grid.query(10, 10, 8)).toBeNull();
  });

  it("clear() empties it and keeps it usable", () => {
    const grid = createSpatialGrid<string>(10);
    grid.insert(5, 5, "a");
    grid.clear();
    expect(grid.size).toBe(0);
    expect(grid.query(5, 5, 8)).toBeNull();
    grid.insert(5, 5, "b");
    expect(grid.query(5, 5, 8)).toBe("b");
  });

  it("stays sub-linear at 50k points and agrees with the brute-force baseline", () => {
    const points = lattice();
    const grid = createSpatialGrid<Point>(8);
    for (const point of points) {
      grid.insert(point.x, point.y, point);
    }
    expect(grid.size).toBe(50_176);

    // Deterministic sweep of probe positions across the whole lattice.
    const probes: { x: number; y: number }[] = [];
    for (let i = 0; i < 200; i++) {
      probes.push({ x: (i * 37) % 896, y: (i * 53) % 896 });
    }

    let maxCandidates = 0;
    for (const probe of probes) {
      const hit = grid.query(probe.x, probe.y, 8);
      const expected = bruteForceNearest(points, probe.x, probe.y, 8);
      expect(hit?.id ?? null).toBe(expected?.id ?? null);
      maxCandidates = Math.max(maxCandidates, grid.lastQueryCandidates);
    }

    // A brute-force scan examines `size` candidates on EVERY query. The grid
    // reads a 3×3 block of 8px cells over a 4px lattice — bounded by local
    // density, not by the dataset size.
    expect(maxCandidates).toBeLessThan(100);
    expect(maxCandidates).toBeLessThan(grid.size / 100);

    // Loose wall-time sanity bound (the acceptance target is 2ms per hover).
    const start = performance.now();
    for (const probe of probes) {
      grid.query(probe.x, probe.y, 8);
    }
    const perQueryMs = (performance.now() - start) / probes.length;
    expect(perQueryMs).toBeLessThan(2);
  });
});
