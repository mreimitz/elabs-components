import { describe, expect, it } from "vitest";
import { createEdgePathSampler, flattenEdgePath } from "./edge-path-sampler";

function expectPoint(actual: { x: number; y: number }, x: number, y: number, digits = 3) {
  expect(actual.x).toBeCloseTo(x, digits);
  expect(actual.y).toBeCloseTo(y, digits);
}

describe("createEdgePathSampler", () => {
  it("returns null for a string that describes no geometry", () => {
    expect(createEdgePathSampler("")).toBeNull();
    expect(createEdgePathSampler("not a path")).toBeNull();
  });

  it("measures and samples a straight line by arc length", () => {
    const s = createEdgePathSampler("M0,0 L100,0")!;
    expect(s.length).toBe(100);
    expectPoint(s.pointAt(0), 0, 0);
    expectPoint(s.pointAt(0.25), 25, 0);
    expectPoint(s.pointAt(1), 100, 0);
  });

  it("clamps out-of-range progress and pins non-finite progress to the start", () => {
    const s = createEdgePathSampler("M0,0 L100,0")!;
    expectPoint(s.pointAt(-1), 0, 0);
    expectPoint(s.pointAt(2), 100, 0);
    expectPoint(s.pointAt(Number.NaN), 0, 0);
  });

  it("walks a polyline at an even speed across corners", () => {
    // 100 across, then 100 down: halfway along is the corner itself.
    const s = createEdgePathSampler("M 0 0 H 100 V 100")!;
    expect(s.length).toBe(200);
    expectPoint(s.pointAt(0.5), 100, 0);
    expectPoint(s.pointAt(0.75), 100, 50);
  });

  it("resolves relative commands and implicit line-tos after M", () => {
    const s = createEdgePathSampler("m10 10 20 0 l0 20")!;
    expect(s.length).toBe(40);
    expectPoint(s.pointAt(1), 30, 30);
  });

  it("parses React Flow's compact bezier spelling and lands on the curve midpoint", () => {
    // Symmetric cubic: its t=0.5 point is also its arc-length midpoint.
    // B(0.5) = (P0 + 3·C1 + 3·C2 + P3) / 8
    const s = createEdgePathSampler("M0,0 C0,50 100,50 100,0")!;
    expectPoint(s.pointAt(0.5), 50, 37.5, 1);
    expectPoint(s.pointAt(1), 100, 0);
  });

  it("parses React Flow's smoothstep spelling (`L` glued to the previous pair, `Q` bends)", () => {
    const d = "M 0,0L 0,40Q 0,50 10,50L 90,50Q 100,50 100,60L 100,100";
    const s = createEdgePathSampler(d)!;
    expectPoint(s.pointAt(0), 0, 0);
    expectPoint(s.pointAt(1), 100, 100);
    // Symmetric route: the midpoint is the middle of the horizontal run.
    expectPoint(s.pointAt(0.5), 50, 50, 1);
  });

  it("follows an elliptical arc (a half circle of radius 50)", () => {
    const s = createEdgePathSampler("M0,0 A50,50 0 0 1 100,0")!;
    // Half circumference, within the polyline's chord error.
    expect(s.length).toBeCloseTo(Math.PI * 50, 0);
    // Sweep flag 1 runs clockwise in SVG's y-down space: over the top (negative y).
    expectPoint(s.pointAt(0.5), 50, -50, 0);
  });

  it("reads compact arc flags (`0 01`)", () => {
    const a = createEdgePathSampler("M0,0 A50,50 0 0 1 100,0")!;
    const b = createEdgePathSampler("M0,0 A50,50 0 01100,0")!;
    expectPoint(b.pointAt(0.5), a.pointAt(0.5).x, a.pointAt(0.5).y);
  });

  it("reflects the control point for S and T", () => {
    const viaS = createEdgePathSampler("M0,0 C0,50 50,50 50,0 S100,-50 100,0")!;
    const viaC = createEdgePathSampler("M0,0 C0,50 50,50 50,0 C50,-50 100,-50 100,0")!;
    expectPoint(viaS.pointAt(0.8), viaC.pointAt(0.8).x, viaC.pointAt(0.8).y);
    const viaT = createEdgePathSampler("M0,0 Q25,50 50,0 T100,0")!;
    const viaQ = createEdgePathSampler("M0,0 Q25,50 50,0 Q75,-50 100,0")!;
    expectPoint(viaT.pointAt(0.8), viaQ.pointAt(0.8).x, viaQ.pointAt(0.8).y);
  });

  it("closes a subpath with Z and never counts the jump to the next M", () => {
    const s = createEdgePathSampler("M0,0 L10,0 L10,10 Z M100,100 L110,100")!;
    // 10 + 10 + √200 for the triangle, + 10 for the second subpath; the M jump is free.
    expect(s.length).toBeCloseTo(30 + Math.sqrt(200), 6);
  });

  it("keeps everything before a malformed argument and never throws", () => {
    // The shape the edge unit tests' path mocks produce: a C with one coordinate pair.
    expect(() => createEdgePathSampler("M0,0 C100,100")).not.toThrow();
    const s = createEdgePathSampler("M0,0 L10,0 C100,100")!;
    expect(s.length).toBe(10);
  });

  it("samples a single point to that point", () => {
    const s = createEdgePathSampler("M5,7")!;
    expect(s.length).toBe(0);
    expectPoint(s.pointAt(0.6), 5, 7);
  });
});

describe("flattenEdgePath", () => {
  it("splits subpaths at each M", () => {
    expect(flattenEdgePath("M0,0 L1,0 M5,5 L6,5")).toHaveLength(2);
  });
});
