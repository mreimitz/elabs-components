/**
 * Zone shapes beyond the rectangle and the closed envelope: polygons, line
 * (half-plane) zones, open ends (`extend`) and inverted ("outside the shape")
 * zones — classification and outline geometry.
 */

import { describe, expect, it } from "vitest";
import { toDensityColumns } from "./columns";
import { resolveSelection } from "./selection";
import { DENSITY_OUTSIDE_ID, type DensityZone } from "./types";
import { classifyZones, zoneOutline } from "./zones";

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
