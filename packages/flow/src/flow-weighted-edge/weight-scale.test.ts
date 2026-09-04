import { describe, expect, it } from "vitest";
import {
  computeEdgeWeightScale,
  DEFAULT_EDGE_WIDTH_RANGE,
  type WeightedEdgeLike,
} from "./weight-scale";

describe("computeEdgeWeightScale", () => {
  it("spans exactly the default [1.5, 8] range, linearly, for weights 1..10", () => {
    const edges: WeightedEdgeLike[] = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i + 1}`,
      data: { weight: i + 1 },
    }));
    const scale = computeEdgeWeightScale(edges);
    expect(scale.get("e1")).toBeCloseTo(1.5);
    expect(scale.get("e10")).toBeCloseTo(8);
    // Linear: the midpoint weight (5.5) lands at the midpoint width.
    const mid = (1.5 + 8) / 2;
    const w5 = scale.get("e5")!;
    const w6 = scale.get("e6")!;
    expect((w5 + w6) / 2).toBeCloseTo(mid, 1);
  });

  it("gives an edge with no data.weight the range floor (matches the existing fixed 1.5px edge)", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "unweighted" },
      { id: "weighted", data: { weight: 4 } },
    ];
    const scale = computeEdgeWeightScale(edges);
    expect(scale.get("unweighted")).toBe(DEFAULT_EDGE_WIDTH_RANGE[0]);
  });

  it("scales edges sharing a scaleGroup against one domain, independent of other groups", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "a1", data: { weight: 1, scaleGroup: "a" } },
      { id: "a2", data: { weight: 2, scaleGroup: "a" } },
      { id: "b1", data: { weight: 100, scaleGroup: "b" } },
      { id: "b2", data: { weight: 200, scaleGroup: "b" } },
    ];
    const scale = computeEdgeWeightScale(edges);
    expect(scale.get("a1")).toBeCloseTo(1.5);
    expect(scale.get("a2")).toBeCloseTo(8);
    expect(scale.get("b1")).toBeCloseTo(1.5);
    expect(scale.get("b2")).toBeCloseTo(8);
  });

  it("groups edges with no scaleGroup into one shared default domain", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "x", data: { weight: 0 } },
      { id: "y", data: { weight: 10 } },
    ];
    const scale = computeEdgeWeightScale(edges);
    expect(scale.get("x")).toBeCloseTo(1.5);
    expect(scale.get("y")).toBeCloseTo(8);
  });

  it("gives the sole member of a group (no variance) the midpoint of the range", () => {
    const edges: WeightedEdgeLike[] = [{ id: "solo", data: { weight: 42, scaleGroup: "only" } }];
    const scale = computeEdgeWeightScale(edges);
    expect(scale.get("solo")).toBeCloseTo((1.5 + 8) / 2);
  });

  it("honours a custom widthRange", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "a", data: { weight: 0 } },
      { id: "b", data: { weight: 10 } },
    ];
    const scale = computeEdgeWeightScale(edges, { widthRange: [2, 20] });
    expect(scale.get("a")).toBeCloseTo(2);
    expect(scale.get("b")).toBeCloseTo(20);
  });

  it("restricting to a scaleGroup excludes edges from other groups from the result", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "a1", data: { weight: 1, scaleGroup: "a" } },
      { id: "b1", data: { weight: 100, scaleGroup: "b" } },
    ];
    const scale = computeEdgeWeightScale(edges, { scaleGroup: "a" });
    expect(scale.has("a1")).toBe(true);
    expect(scale.has("b1")).toBe(false);
  });

  it("is pure — the same input always produces equal output", () => {
    const edges: WeightedEdgeLike[] = [
      { id: "a", data: { weight: 3 } },
      { id: "b", data: { weight: 7 } },
    ];
    const first = computeEdgeWeightScale(edges);
    const second = computeEdgeWeightScale(edges);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});
