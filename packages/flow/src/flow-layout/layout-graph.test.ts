import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { layoutGraph } from "./layout-graph";

function node(id: string): Node {
  return { id, type: "brand", position: { x: 0, y: 0 }, data: { title: id } };
}

function edge(source: string, target: string): Edge {
  return { id: `e-${source}-${target}`, source, target };
}

/** 1 center + 6 neighbors, all one hop away. */
function starGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = ["center", "n1", "n2", "n3", "n4", "n5", "n6"].map(node);
  const edges = ["n1", "n2", "n3", "n4", "n5", "n6"].map((id) => edge("center", id));
  return { nodes, edges };
}

/** A straight 3-node chain: a (center) -> b (hop 1) -> c (hop 2). */
function chainGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: ["a", "b", "c"].map(node),
    edges: [edge("a", "b"), edge("b", "c")],
  };
}

function positionOf(nodes: Node[], id: string) {
  return nodes.find((n) => n.id === id)!.position;
}

function distance(p: { x: number; y: number }, q: { x: number; y: number } = { x: 0, y: 0 }) {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

describe("layoutGraph", () => {
  describe("empty / disconnected input", () => {
    it("returns [] for an empty graph, for every algorithm", () => {
      for (const algorithm of [
        "concentric",
        "force",
        "layered-lr",
        "layered-tb",
        "grid",
      ] as const) {
        expect(layoutGraph([], [], { algorithm })).toEqual([]);
      }
    });

    it("never produces NaN positions for a disconnected graph", () => {
      const nodes = ["a", "b", "c", "isolated1", "isolated2"].map(node);
      const edges = [edge("a", "b"), edge("b", "c")];

      for (const algorithm of [
        "concentric",
        "force",
        "layered-lr",
        "layered-tb",
        "grid",
      ] as const) {
        const laidOut = layoutGraph(nodes, edges, { algorithm, iterations: 20 });
        for (const n of laidOut) {
          expect(Number.isFinite(n.position.x)).toBe(true);
          expect(Number.isFinite(n.position.y)).toBe(true);
        }
      }
    });

    it("places fully-isolated (edgeless) nodes without NaN under concentric", () => {
      const nodes = ["a", "b", "c"].map(node);
      const laidOut = layoutGraph(nodes, [], { algorithm: "concentric", centerId: "a" });
      for (const n of laidOut) {
        expect(Number.isFinite(n.position.x)).toBe(true);
        expect(Number.isFinite(n.position.y)).toBe(true);
      }
      // b and c are disconnected from the center — they still land on ring 1.
      expect(distance(positionOf(laidOut, "b"))).toBeCloseTo(180, 5);
      expect(distance(positionOf(laidOut, "c"))).toBeCloseTo(180, 5);
    });
  });

  describe("concentric", () => {
    it("preserves node identity and data — only position changes", () => {
      const { nodes, edges } = starGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "concentric" });
      laidOut.forEach((n, i) => {
        expect(n.id).toBe(nodes[i]!.id);
        expect(n.data).toBe(nodes[i]!.data);
      });
    });

    it("puts a star graph's 6 neighbors on ring 1 at unique angles, distance ringRadius", () => {
      const { nodes, edges } = starGraph();
      const ringRadius = 180;
      const laidOut = layoutGraph(nodes, edges, {
        algorithm: "concentric",
        centerId: "center",
        ringRadius,
      });

      const center = positionOf(laidOut, "center");
      expect(center).toEqual({ x: 0, y: 0 });

      const neighborIds = ["n1", "n2", "n3", "n4", "n5", "n6"];
      const angles = neighborIds.map((id) => {
        const p = positionOf(laidOut, id);
        expect(distance(p)).toBeCloseTo(ringRadius, 5);
        return Math.atan2(p.y, p.x);
      });

      // All six angles are distinct (rounded to guard float noise).
      const rounded = angles.map((a) => Math.round(a * 1e6));
      expect(new Set(rounded).size).toBe(6);
    });

    it("defaults centerId to the highest-degree node when omitted", () => {
      const { nodes, edges } = starGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "concentric" });
      // "center" has degree 6 — every other node has degree 1 — so it must be
      // the one left at the origin.
      expect(positionOf(laidOut, "center")).toEqual({ x: 0, y: 0 });
    });

    it("puts the second hop of a chain at 2 × ringRadius from the center", () => {
      const { nodes, edges } = chainGraph();
      const ringRadius = 180;
      const laidOut = layoutGraph(nodes, edges, {
        algorithm: "concentric",
        centerId: "a",
        ringRadius,
      });

      expect(distance(positionOf(laidOut, "a"))).toBe(0);
      expect(distance(positionOf(laidOut, "b"))).toBeCloseTo(ringRadius, 5);
      expect(distance(positionOf(laidOut, "c"))).toBeCloseTo(2 * ringRadius, 5);
    });

    it("is deterministic — two runs on the same input produce identical positions", () => {
      const { nodes, edges } = starGraph();
      const first = layoutGraph(nodes, edges, { algorithm: "concentric", centerId: "center" });
      const second = layoutGraph(nodes, edges, { algorithm: "concentric", centerId: "center" });
      expect(first.map((n) => n.position)).toEqual(second.map((n) => n.position));
    });
  });

  describe("force", () => {
    it("separates two initially-coincident nodes", () => {
      const nodes: Node[] = [
        { id: "a", type: "brand", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "brand", position: { x: 0, y: 0 }, data: {} },
      ];
      const laidOut = layoutGraph(nodes, [], { algorithm: "force", iterations: 50 });
      const a = positionOf(laidOut, "a");
      const b = positionOf(laidOut, "b");
      expect(distance(a, b)).toBeGreaterThan(0);
    });

    it("terminates in bounded time for a fixed iteration count", () => {
      const { nodes, edges } = starGraph();
      const start = Date.now();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "force", iterations: 300 });
      expect(Date.now() - start).toBeLessThan(5000);
      expect(laidOut).toHaveLength(nodes.length);
    });

    it("never produces NaN positions", () => {
      const { nodes, edges } = starGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "force", iterations: 50 });
      for (const n of laidOut) {
        expect(Number.isFinite(n.position.x)).toBe(true);
        expect(Number.isFinite(n.position.y)).toBe(true);
      }
    });

    it("is deterministic — two runs on the same input produce byte-identical positions", () => {
      const { nodes, edges } = starGraph();
      const first = layoutGraph(nodes, edges, { algorithm: "force", iterations: 100 });
      const second = layoutGraph(nodes, edges, { algorithm: "force", iterations: 100 });
      expect(first.map((n) => n.position)).toEqual(second.map((n) => n.position));
    });

    it("preserves node identity and data — only position changes", () => {
      const { nodes, edges } = starGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "force", iterations: 30 });
      laidOut.forEach((n, i) => {
        expect(n.id).toBe(nodes[i]!.id);
        expect(n.data).toBe(nodes[i]!.data);
      });
    });
  });

  describe("layered-lr", () => {
    it("delegates to layoutFlow direction=LR, ordering a chain left-to-right", () => {
      const { nodes, edges } = chainGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "layered-lr" });
      const [a, b, c] = laidOut as [Node, Node, Node];
      expect(a.position.x).toBeLessThan(b.position.x);
      expect(b.position.x).toBeLessThan(c.position.x);
    });

    it("stamps right-out / left-in handle sides (not just position)", () => {
      const { nodes, edges } = chainGraph();
      const [a] = layoutGraph(nodes, edges, { algorithm: "layered-lr" }) as [Node];
      expect(a.sourcePosition).toBe("right");
      expect(a.targetPosition).toBe("left");
    });

    it("maps spacing.x/y onto rank/node spacing", () => {
      const { nodes, edges } = chainGraph();
      const tight = layoutGraph(nodes, edges, {
        algorithm: "layered-lr",
        spacing: { x: 10, y: 10 },
      });
      const wide = layoutGraph(nodes, edges, {
        algorithm: "layered-lr",
        spacing: { x: 500, y: 10 },
      });
      const tightGap = (tight[1]!.position.x as number) - (tight[0]!.position.x as number);
      const wideGap = (wide[1]!.position.x as number) - (wide[0]!.position.x as number);
      expect(wideGap).toBeGreaterThan(tightGap);
    });

    it("respects a custom nodeSize", () => {
      const nodes: Node[] = [
        { id: "a", type: "brand", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "brand", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [edge("a", "b")];
      const laidOut = layoutGraph(nodes, edges, {
        algorithm: "layered-lr",
        nodeSize: () => ({ width: 400, height: 200 }),
      });
      const gap = (laidOut[1]!.position.x as number) - (laidOut[0]!.position.x as number);
      expect(gap).toBeGreaterThanOrEqual(400 + 72 - 1);
      // The returned nodes are not permanently resized — only `position` changed.
      expect(laidOut[0]).not.toHaveProperty("measured");
    });
  });

  describe("grid", () => {
    it("lays nodes out row-major using spacing", () => {
      const nodes = ["a", "b", "c", "d"].map(node);
      const laidOut = layoutGraph(nodes, [], {
        algorithm: "grid",
        spacing: { x: 200, y: 120 },
      });
      // ceil(sqrt(4)) = 2 columns.
      expect(positionOf(laidOut, "a")).toEqual({ x: 0, y: 0 });
      expect(positionOf(laidOut, "b")).toEqual({ x: 200, y: 0 });
      expect(positionOf(laidOut, "c")).toEqual({ x: 0, y: 120 });
      expect(positionOf(laidOut, "d")).toEqual({ x: 200, y: 120 });
    });

    it("stamps bottom-out / top-in handle sides", () => {
      const [a] = layoutGraph(["a", "b"].map(node), [edge("a", "b")], {
        algorithm: "grid",
      }) as [Node];
      expect(a.sourcePosition).toBe("bottom");
      expect(a.targetPosition).toBe("top");
    });

    it("is deterministic", () => {
      const nodes = ["a", "b", "c"].map(node);
      const first = layoutGraph(nodes, [], { algorithm: "grid" });
      const second = layoutGraph(nodes, [], { algorithm: "grid" });
      expect(first.map((n) => n.position)).toEqual(second.map((n) => n.position));
    });
  });
  describe("layered-tb", () => {
    it("delegates to layoutFlow direction=TB, ordering a chain top-to-bottom", () => {
      const { nodes, edges } = chainGraph();
      const laidOut = layoutGraph(nodes, edges, { algorithm: "layered-tb" });
      const [a, b, c] = laidOut as [Node, Node, Node];
      expect(a.position.y).toBeLessThan(b.position.y);
      expect(b.position.y).toBeLessThan(c.position.y);
    });

    it("stamps bottom-out / top-in handle sides (not just position)", () => {
      const { nodes, edges } = chainGraph();
      const [a] = layoutGraph(nodes, edges, { algorithm: "layered-tb" }) as [Node];
      expect(a.sourcePosition).toBe("bottom");
      expect(a.targetPosition).toBe("top");
    });

    it("maps spacing.y onto rank spacing (the axis TB ranks along)", () => {
      const { nodes, edges } = chainGraph();
      const tight = layoutGraph(nodes, edges, {
        algorithm: "layered-tb",
        spacing: { x: 10, y: 10 },
      });
      const wide = layoutGraph(nodes, edges, {
        algorithm: "layered-tb",
        spacing: { x: 10, y: 500 },
      });
      const tightGap = tight[1]!.position.y - tight[0]!.position.y;
      const wideGap = wide[1]!.position.y - wide[0]!.position.y;
      expect(wideGap).toBeGreaterThan(tightGap);
    });

    it("respects a custom nodeSize without permanently resizing the nodes", () => {
      const nodes: Node[] = [
        { id: "a", type: "brand", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "brand", position: { x: 0, y: 0 }, data: {} },
      ];
      const laidOut = layoutGraph(nodes, [edge("a", "b")], {
        algorithm: "layered-tb",
        nodeSize: () => ({ width: 200, height: 400 }),
      });
      expect(laidOut[1]!.position.y - laidOut[0]!.position.y).toBeGreaterThanOrEqual(400 + 72 - 1);
      expect(laidOut[0]).not.toHaveProperty("measured");
    });

    it("is the same layout as layered-lr with the axes swapped", () => {
      // A fork exercises BOTH axes: a rank progression and a within-rank stack.
      // Square nodes + isotropic spacing make the two layouts exact mirrors, so
      // the assertion is "x and y trade places", not "the numbers look similar".
      const nodes = ["a", "b", "c"].map(node);
      const edges = [edge("a", "b"), edge("a", "c")];
      const options = {
        spacing: { x: 150, y: 150 },
        nodeSize: () => ({ width: 100, height: 100 }),
      };
      const lr = layoutGraph(nodes, edges, { ...options, algorithm: "layered-lr" });
      const tb = layoutGraph(nodes, edges, { ...options, algorithm: "layered-tb" });

      expect(tb.map((n) => n.position)).toEqual(
        lr.map((n) => ({ x: n.position.y, y: n.position.x })),
      );
    });

    it("is deterministic", () => {
      const { nodes, edges } = chainGraph();
      const first = layoutGraph(nodes, edges, { algorithm: "layered-tb" });
      const second = layoutGraph(nodes, edges, { algorithm: "layered-tb" });
      expect(first.map((n) => n.position)).toEqual(second.map((n) => n.position));
    });
  });
});
