/**
 * Zone shapes beyond the rectangle and the closed envelope: polygons, line
 * (half-plane) zones, open ends (`extend`) and inverted ("outside the shape")
 * zones — classification and outline geometry.
 */

import { describe, expect, it } from "vitest";
import { toDensityColumns } from "./columns";
import { resolveSelection } from "./selection";
import { DENSITY_OUTSIDE_ID, type DensityZone } from "./types";
import { classifyZones, clipPolyline, zoneOutline } from "./zones";

const pts = (xy: [number, number][]) =>
  toDensityColumns({ x: xy.map((p) => p[0]), y: xy.map((p) => p[1]) });

describe("polygon zones", () => {
  const tri: DensityZone = {
    id: "tri",
    label: "Triangle",
    color: "var(--chart-1)",
    bounds: {
      polygon: [
        [0, 0],
        [10, 0],
        [5, 10],
      ],
    },
  };
  it("classifies inside / outside a concave-safe ring", () => {
    const p = pts([
      [5, 2],
      [1, 8],
      [5, 11],
      [20, 1],
    ]);
    expect(Array.from(classifyZones(p, [tri]))).toEqual([0, 1, 1, 1]);
  });
  it("a polygon under 3 vertices classifies nothing and has no outline", () => {
    const bad: DensityZone = {
      ...tri,
      bounds: {
        polygon: [
          [0, 0],
          [1, 1],
        ],
      },
    };
    expect(Array.from(classifyZones(pts([[0.5, 0.5]]), [bad]))).toEqual([1]);
    expect(zoneOutline(bad)).toEqual([]);
  });
  it("outlines as one closed ring", () => {
    const [ring] = zoneOutline(tri);
    expect(ring).toHaveLength(4);
    expect(ring![0]).toEqual(ring![3]);
  });
});

describe("line zones", () => {
  const floor: DensityZone = {
    id: "floor",
    label: "Floor",
    color: "var(--chart-2)",
    bounds: {
      line: [
        [0, 0],
        [10, 10],
      ],
      side: "above",
    },
  };
  it("covers the chosen side between its end vertices (closed ends)", () => {
    const p = pts([
      [5, 6],
      [5, 4],
      [-5, 100],
      [15, 100],
    ]);
    expect(Array.from(classifyZones(p, [floor]))).toEqual([0, 1, 1, 1]);
  });
  it("below", () => {
    const below: DensityZone = {
      ...floor,
      bounds: {
        line: [
          [0, 0],
          [10, 10],
        ],
        side: "below",
      },
    };
    expect(
      Array.from(
        classifyZones(
          pts([
            [5, 4],
            [5, 6],
          ]),
          [below],
        ),
      ),
    ).toEqual([0, 1]);
  });
  it("open ends continue holding the end value", () => {
    const open: DensityZone = {
      ...floor,
      bounds: {
        line: [
          [0, 0],
          [10, 10],
        ],
        side: "above",
        extend: { start: true, end: true },
      },
    };
    // left of x=0 the line holds y=0; right of x=10 it holds y=10
    const p = pts([
      [-50, 1],
      [-50, -1],
      [50, 11],
      [50, 9],
    ]);
    expect(Array.from(classifyZones(p, [open]))).toEqual([0, 1, 0, 1]);
  });
  it("outlines the line plus a vertical at each closed end, none at an open end", () => {
    const closed = zoneOutline(floor);
    expect(closed).toHaveLength(3);
    expect(closed[1]![1]).toEqual([0, Infinity]);
    const open = zoneOutline({
      ...floor,
      bounds: {
        line: [
          [0, 0],
          [10, 10],
        ],
        side: "above",
        extend: { end: true },
      },
    });
    expect(open).toHaveLength(2);
    expect(open[0]![open[0]!.length - 1]).toEqual([Infinity, 10]);
  });
});

describe("open envelope ends", () => {
  const tube: DensityZone = {
    id: "tube",
    label: "Tube",
    color: "var(--chart-3)",
    bounds: {
      upper: [
        [0, 2],
        [10, 1],
      ],
      lower: [
        [0, -2],
        [10, -1],
      ],
    },
  };
  it("a closed envelope stops at its vertices", () => {
    expect(
      Array.from(
        classifyZones(
          pts([
            [20, 0],
            [5, 0],
          ]),
          [tube],
        ),
      ),
    ).toEqual([1, 0]);
  });
  it("an open end holds the last width without end", () => {
    const open: DensityZone = {
      ...tube,
      bounds: { ...tube.bounds, extend: { end: true } } as DensityZone["bounds"],
    };
    expect(
      Array.from(
        classifyZones(
          pts([
            [1e6, 0.9],
            [1e6, 1.1],
            [-1, 0],
          ]),
          [open],
        ),
      ),
    ).toEqual([0, 1, 1]);
    // no closing edge at the open end
    expect(zoneOutline(open)).toHaveLength(3);
  });
  it("an open start keeps the full height when the edges share their end vertex", () => {
    // drawn as one ring: the lower edge starts at the shared corner, then drops
    const shared: DensityZone = {
      id: "shared",
      label: "Shared",
      color: "var(--chart-3)",
      bounds: {
        upper: [
          [-1e6, 640000],
          [7e5, 600000],
          [3e6, 680000],
        ],
        lower: [
          [-1e6, 640000],
          [-1e6, 460000],
          [7e5, 510000],
          [3e6, 355000],
        ],
        extend: { start: true },
      },
    };
    expect(
      Array.from(
        classifyZones(
          pts([
            [-2e6, 550000],
            [-2e6, 470000],
            [-2e6, 630000],
            [-2e6, 700000],
            [-2e6, 400000],
            [0, 550000],
          ]),
          [shared],
        ),
      ),
    ).toEqual([0, 0, 0, 1, 1, 0]); // class 0 = the zone, 1 = outside
  });
});

describe("inverted zones", () => {
  const band: DensityZone = {
    id: "ok",
    label: "Within limits",
    color: "var(--chart-1)",
    bounds: { y: [-1, 1] },
  };
  const beyond: DensityZone = { ...band, id: "beyond", label: "Beyond", invert: true };
  it("an inverted zone owns everything outside its shape", () => {
    expect(
      Array.from(
        classifyZones(
          pts([
            [0, 0],
            [0, 5],
            [0, -5],
          ]),
          [beyond],
        ),
      ),
    ).toEqual([1, 0, 0]);
  });
  it("first match wins across normal and inverted zones", () => {
    const inner: DensityZone = {
      id: "spike",
      label: "Spike",
      color: "var(--chart-2)",
      bounds: { x: [0, 1], y: [4, 6] },
    };
    expect(
      Array.from(
        classifyZones(
          pts([
            [0.5, 5],
            [3, 5],
            [0, 0],
          ]),
          [inner, beyond],
        ),
      ),
    ).toEqual([0, 1, 2]);
  });
  it("a zone pick on an inverted zone selects its outside", () => {
    const p = pts([
      [0, 0],
      [0, 5],
    ]);
    const cls = classifyZones(p, [beyond]);
    const out = new Uint8Array(2);
    resolveSelection(p, cls, ["beyond"], { zones: ["beyond"] }, out);
    expect(Array.from(out)).toEqual([0, 255]);
    resolveSelection(p, cls, ["beyond"], { zones: [DENSITY_OUTSIDE_ID] }, out);
    expect(Array.from(out)).toEqual([255, 0]);
  });
});

describe("zone outlines under zoom", () => {
  const slope = (p: ReadonlyArray<readonly [number, number]>) =>
    (p[p.length - 1]![1] - p[0]![1]) / (p[p.length - 1]![0] - p[0]![0]);

  it("cutting a slanted edge to a zoomed window keeps its slope", () => {
    // y = 400k − 0.05·x — the edge runs far past a window zoomed onto its middle.
    const edge: Array<[number, number]> = [
      [0, 400_000],
      [4_000_000, 200_000],
    ];
    for (const win of [
      { x0: 1_000_000, x1: 3_000_000, y0: 250_000, y1: 350_000 },
      { x0: 1_800_000, x1: 2_400_000, y0: 280_000, y1: 320_000 },
      { x0: 1_990_000, x1: 2_010_000, y0: 299_000, y1: 301_000 },
    ]) {
      const pieces = clipPolyline(edge, win);
      expect(pieces).toHaveLength(1);
      expect(slope(pieces[0]!)).toBeCloseTo(-0.05, 9);
      for (const [x, y] of pieces[0]!) {
        expect(x).toBeGreaterThanOrEqual(win.x0 - 1e-6);
        expect(x).toBeLessThanOrEqual(win.x1 + 1e-6);
        expect(y).toBeCloseTo(400_000 - 0.05 * x, 3);
      }
    }
  });

  it("an open end stays horizontal and a window that misses the edge draws nothing", () => {
    const zone: DensityZone = {
      id: "l",
      label: "L",
      color: "#000",
      bounds: {
        line: [
          [0, 10],
          [10, 0],
        ],
        side: "above",
        extend: { start: true, end: true },
      },
    };
    const [run] = zoneOutline(zone);
    const pieces = clipPolyline(run!, { x0: -100, x1: 100, y0: -50, y1: 50 });
    expect(pieces).toHaveLength(1);
    expect(pieces[0]![0]).toEqual([-100, 10]);
    expect(pieces[0]![pieces[0]!.length - 1]).toEqual([100, 0]);
    expect(clipPolyline(run!, { x0: -100, x1: 100, y0: 500, y1: 600 })).toEqual([]);
  });
});
