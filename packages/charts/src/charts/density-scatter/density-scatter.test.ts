/**
 * The framework-free core of `DensityScatterChart`: zones, bins, selection,
 * columns. The bin test asserts a TIME BUDGET at 500k points, not a picture —
 * the picture is the stories' job.
 */

import { describe, expect, it } from "vitest";
import { binPoints, cellAt, createBinGrid, densityLevels, dominantClass, smoothField } from "./bin";
import { columnExtent, toDensityColumns } from "./columns";
import { buildLateralTraffic, LATERAL_ZONES } from "./fixtures";
import {
  hasSelection,
  pointInPolygon,
  resolveSelection,
  toggleZoneConstraint,
  withConstraint,
} from "./selection";
import { DENSITY_OUTSIDE_ID, type DensityZone } from "./types";
import { classifyZones, countClasses, evalPolyline, zoneOutline } from "./zones";

const BOX = { left: 0, top: 0, width: 1000, height: 400 };

describe("columns", () => {
  it("passes columnar input through and encodes categories", () => {
    const points = toDensityColumns({
      x: [1, 2, 3],
      y: [4, 5, 6],
      categories: { k: ["a", "b", "a"] },
    });
    expect(points.n).toBe(3);
    expect(Array.from(points.x)).toEqual([1, 2, 3]);
    expect(points.categories.k?.labels).toEqual(["a", "b"]);
    expect(Array.from(points.categories.k!.codes)).toEqual([0, 1, 0]);
  });

  it("converts rows, lifting value/category keys, NaN for non-numeric", () => {
    const points = toDensityColumns(
      [
        { x: 1, y: 2, v: 10, c: "p" },
        { x: "bad", y: 3, v: null, c: "q" },
      ],
      { valueKeys: ["v"], categoryKeys: ["c"] },
    );
    expect(points.x[0]).toBe(1);
    expect(Number.isNaN(points.x[1])).toBe(true);
    expect(Number.isNaN(points.values.v![1])).toBe(true);
    expect(points.categories.c?.labels).toEqual(["p", "q"]);
  });

  it("warns once above the row threshold", () => {
    const rows = Array.from({ length: 50_001 }, (_, i) => ({ x: i, y: i }));
    const warnings: string[] = [];
    toDensityColumns(rows, { warn: (m) => warnings.push(m) });
    expect(warnings).toHaveLength(1);
  });

  it("columnExtent skips NaN", () => {
    expect(columnExtent(new Float32Array([Number.NaN, 3, -1, Number.NaN]))).toEqual([-1, 3]);
    expect(columnExtent(new Float32Array([Number.NaN]))).toBeNull();
  });
});

describe("zones", () => {
  const rect: DensityZone = {
    id: "r",
    label: "R",
    color: "--chart-1",
    bounds: { x: [0, 10], y: [-1, 1] },
  };
  const funnel: DensityZone = {
    id: "f",
    label: "F",
    color: "--chart-2",
    bounds: {
      upper: [
        [0, 10],
        [10, 2],
      ],
      lower: [
        [0, -10],
        [10, -2],
      ],
    },
  };

  it("interpolates a polyline", () => {
    expect(
      evalPolyline(
        [
          [0, 0],
          [10, 10],
        ],
        5,
      ),
    ).toBe(5);
    expect(
      evalPolyline(
        [
          [0, 0],
          [10, 10],
          [20, 0],
        ],
        15,
      ),
    ).toBe(5);
  });

  it("classifies inner zone first, then outer, else outside", () => {
    const points = toDensityColumns({ x: [5, 5, 5, 20], y: [0.5, 3, 30, 0] });
    const cls = classifyZones(points, [rect, funnel]);
    expect(Array.from(cls)).toEqual([0, 1, 2, 2]);
    expect(Array.from(countClasses(cls, 3))).toEqual([1, 1, 2]);
  });

  it("treats a rectangle as the two-vertex envelope", () => {
    const outline = zoneOutline(rect);
    expect(outline[0]).toEqual([
      [0, 1],
      [10, 1],
    ]);
    expect(outline).toHaveLength(4);
  });

  it("classifies the lateral fixture with a plausible core share", () => {
    const points = toDensityColumns(buildLateralTraffic(20_000));
    const counts = countClasses(classifyZones(points, LATERAL_ZONES), 3);
    const core = counts[0]! / points.n;
    expect(core).toBeGreaterThan(0.6);
    expect(core).toBeLessThan(0.9);
  });
});

describe("bin", () => {
  it("counts visible points into screen cells and finds the dominant class", () => {
    const points = toDensityColumns({ x: [0, 0.1, 0.2, 100, 500], y: [0, 0, 0, 0, 0] });
    const cls = new Uint8Array([0, 0, 1, 0, 0]);
    const grid = createBinGrid(BOX, 10, 2);
    const view = { x0: 0, x1: 200, y0: -1, y1: 1 };
    const input = {
      x: points.x,
      y: points.y,
      n: points.n,
      cls,
      hidden: [false, false],
      selected: null,
      view,
      box: BOX,
    };
    binPoints(grid, input);
    expect(grid.visible).toBe(4); // x=500 is off-window
    const idx = cellAt(grid, BOX, 1, 200);
    expect(grid.counts[idx]).toBe(3);
    expect(dominantClass(grid, idx)).toBe(0);
    expect(grid.firstIndex[idx]).toBe(0);
  });

  it("hidden classes and the selection flag are honoured", () => {
    const points = toDensityColumns({ x: [1, 2, 3], y: [0, 0, 0] });
    const grid = createBinGrid(BOX, 10, 2);
    const view = { x0: 0, x1: 10, y0: -1, y1: 1 };
    const selected = new Uint8Array([255, 0, 255]);
    binPoints(grid, {
      x: points.x,
      y: points.y,
      n: 3,
      cls: new Uint8Array([0, 0, 1]),
      hidden: [false, true],
      selected,
      view,
      box: BOX,
    });
    expect(grid.visible).toBe(2);
    expect(grid.selected).toBe(1);
  });

  it("writes one density byte per visible point after smoothing", () => {
    const points = toDensityColumns(buildLateralTraffic(5_000));
    const cls = classifyZones(points, LATERAL_ZONES);
    const grid = createBinGrid(BOX, 5, 3);
    const view = { x0: -2300, x1: 3600, y0: -240, y1: 240 };
    const input = {
      x: points.x,
      y: points.y,
      n: points.n,
      cls,
      hidden: [false, false, false],
      selected: null,
      view,
      box: BOX,
    };
    binPoints(grid, input);
    smoothField(grid);
    expect(grid.smoothMax).toBeGreaterThan(0);
    expect(grid.smoothMax).toBeLessThanOrEqual(grid.max);
    const levels = new Uint8Array(points.n);
    densityLevels(grid, input, levels);
    let max = 0;
    for (const l of levels) if (l > max) max = l;
    expect(max).toBeGreaterThan(100);
  });

  it("stays inside the frame budget at 500k points", () => {
    const points = toDensityColumns(buildLateralTraffic(500_000));
    const cls = classifyZones(points, LATERAL_ZONES);
    const grid = createBinGrid(BOX, 5, 3);
    const view = { x0: -2300, x1: 3600, y0: -240, y1: 240 };
    const input = {
      x: points.x,
      y: points.y,
      n: points.n,
      cls,
      hidden: [false, false, false],
      selected: null,
      view,
      box: BOX,
    };
    const levels = new Uint8Array(points.n);
    // warm-up
    binPoints(grid, input);
    smoothField(grid);
    densityLevels(grid, input, levels);
    const t0 = performance.now();
    binPoints(createBinGrid(BOX, 5, 3, grid), input);
    smoothField(grid);
    densityLevels(grid, input, levels);
    const ms = performance.now() - t0;
    // 500k points through all three passes; generous for a CI runner, tight
    // enough that an accidental O(n log n) or per-point allocation reds.
    expect(ms).toBeLessThan(250);
    expect(grid.visible).toBeGreaterThan(490_000);
  });
});

describe("selection", () => {
  const points = toDensityColumns({ x: [0, 5, 10, 15], y: [0, 5, 10, 15] });
  const cls = new Uint8Array([0, 0, 1, 2]);
  const out = new Uint8Array(4);

  it("no constraint selects everything and reports false", () => {
    expect(resolveSelection(points, cls, ["a", "b"], undefined, out)).toBe(false);
    expect(Array.from(out)).toEqual([255, 255, 255, 255]);
    expect(
      hasSelection({
        lasso: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).toBe(false); // < 3 vertices
  });

  it("intersects x, y, lasso and zone", () => {
    resolveSelection(points, cls, ["a", "b"], { x: [4, 16] }, out);
    expect(Array.from(out)).toEqual([0, 255, 255, 255]);
    resolveSelection(points, cls, ["a", "b"], { x: [4, 16], y: [0, 12] }, out);
    expect(Array.from(out)).toEqual([0, 255, 255, 0]);
    resolveSelection(points, cls, ["a", "b"], { x: [4, 16], y: [0, 12], zones: ["b"] }, out);
    expect(Array.from(out)).toEqual([0, 0, 255, 0]);
    resolveSelection(points, cls, ["a", "b"], { zones: [DENSITY_OUTSIDE_ID] }, out);
    expect(Array.from(out)).toEqual([0, 0, 0, 255]);
    resolveSelection(
      points,
      cls,
      ["a", "b"],
      {
        lasso: [
          [-1, -1],
          [6, -1],
          [6, 6],
          [-1, 6],
        ],
      },
      out,
    );
    expect(Array.from(out)).toEqual([255, 255, 0, 0]);
  });

  it("point-in-polygon handles a concave shape", () => {
    const u: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [7, 10],
      [7, 3],
      [3, 3],
      [3, 10],
      [0, 10],
    ];
    expect(pointInPolygon(u, 5, 8)).toBe(false);
    expect(pointInPolygon(u, 5, 1)).toBe(true);
  });

  it("edits one constraint at a time and drops empties", () => {
    const s1 = withConstraint(undefined, { x: [0, 1] });
    const s2 = withConstraint(s1, { y: [2, 3] });
    expect(s2).toEqual({ x: [0, 1], y: [2, 3] });
    expect(withConstraint(s2, { x: undefined })).toEqual({ y: [2, 3] });
    expect(toggleZoneConstraint(s2, "a")).toEqual({ x: [0, 1], y: [2, 3], zones: ["a"] });
    expect(toggleZoneConstraint({ zones: ["a"] }, "a")).toEqual({});
  });
});
