import { scaleBand, scaleLinear, scaleTime } from "d3-scale";
import { describe, expect, it } from "vitest";
import {
  bandCategoriesInRange,
  bandCategoryAt,
  LASSO_SNAP_DISTANCE,
  normalizeRect,
  pathToSvgD,
  pixelRangeToData,
  pixelToData,
  radialToPolygon,
  simplifyPath,
  snapToClose,
} from "./geometry";

const band = scaleBand<string>()
  .domain(["A", "B", "C", "D", "E", "F"])
  .range([0, 600])
  .padding(0.2);

describe("band axis", () => {
  it("a range [B, D] over A…F yields B, C, D", () => {
    const b = band("B") as number;
    const d = (band("D") as number) + band.bandwidth();
    expect(bandCategoriesInRange(band, [b, d])).toEqual(["B", "C", "D"]);
  });
  it("a range that clips a band's edge takes it (overlap)", () => {
    const cEnd = (band("C") as number) + band.bandwidth();
    expect(bandCategoriesInRange(band, [cEnd - 1, band("D") as number])).toEqual(["C", "D"]);
  });
  it("a range falling in the padding between bands takes nothing", () => {
    const aEnd = (band("A") as number) + band.bandwidth();
    expect(bandCategoriesInRange(band, [aEnd + 1, (band("B") as number) - 1])).toEqual([]);
  });
  it("either order", () => {
    expect(bandCategoriesInRange(band, [590, 0])).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
  it("nearest category at a pixel", () => {
    expect(bandCategoryAt(band, (band("E") as number) + 2)).toBe("E");
    expect(pixelToData({ kind: "band", scale: band }, 1)).toBe("A");
  });
  it("pixelRangeToData on a band returns the first and last overlapped category", () => {
    expect(pixelRangeToData({ kind: "band", scale: band }, [150, 350])).toEqual(["B", "D"]);
  });
});

describe("continuous axes", () => {
  it("time inverts through the scale and orders ascending", () => {
    const t = scaleTime()
      .domain([new Date(2024, 0, 1), new Date(2024, 0, 11)])
      .range([0, 100]);
    const range = pixelRangeToData({ kind: "time", scale: t }, [50, 10]);
    expect(range?.[0]).toEqual(new Date(2024, 0, 2));
    expect(range?.[1]).toEqual(new Date(2024, 0, 6));
  });
  it("linear inverts, including an inverted (y) range", () => {
    const y = scaleLinear().domain([0, 100]).range([200, 0]);
    expect(pixelToData({ kind: "linear", scale: y }, 100)).toBe(50);
    expect(pixelRangeToData({ kind: "linear", scale: y }, [0, 100])).toEqual([50, 100]);
  });
});

describe("rect + path maths", () => {
  it("normalizeRect never yields negative sizes", () => {
    expect(normalizeRect({ x: 50, y: 40 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0, w: 40, h: 40 });
  });

  it("Douglas–Peucker drops collinear / sub-ε points, keeps corners", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 5, y: 0.5 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(simplifyPath(path, 1.5)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it("a lasso whose last point is 10 px from the start closes", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 6, y: 8 }, // 10 px from the start
    ];
    const snapped = snapToClose(path, LASSO_SNAP_DISTANCE);
    expect(snapped.closed).toBe(true);
    expect(snapped.path[snapped.path.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it("a lasso ending 20 px away stays open", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 12, y: 16 },
    ];
    expect(snapToClose(path).closed).toBe(false);
  });

  it("radialToPolygon has 24 vertices on the circle", () => {
    const poly = radialToPolygon({ x: 50, y: 50 }, 10);
    expect(poly).toHaveLength(24);
    for (const p of poly) expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(10, 6);
  });

  it("pathToSvgD", () => {
    expect(
      pathToSvgD(
        [
          { x: 0, y: 0 },
          { x: 1.234, y: 2 },
        ],
        true,
      ),
    ).toBe("M0,0L1.23,2Z");
  });
});
