import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { layoutFlow } from "./flow-layout";

function chainNodes(): Node[] {
  return [
    { id: "a", type: "brand", position: { x: 0, y: 0 }, data: { title: "A" } },
    { id: "b", type: "brand", position: { x: 0, y: 0 }, data: { title: "B" } },
    { id: "c", type: "brand", position: { x: 0, y: 0 }, data: { title: "C" } },
  ];
}

function chainEdges(): Edge[] {
  return [
    { id: "e-ab", source: "a", target: "b" },
    { id: "e-bc", source: "b", target: "c" },
  ];
}

describe("layoutFlow", () => {
  it("orders a 3-node chain top-to-bottom for direction=TB (default)", () => {
    const { nodes } = layoutFlow(chainNodes(), chainEdges());
    const [a, b, c] = nodes as [Node, Node, Node];

    // Ranks increase down the y axis; x stays roughly aligned per rank.
    expect(a.position.y).toBeLessThan(b.position.y);
    expect(b.position.y).toBeLessThan(c.position.y);
  });

  it("orders a 3-node chain left-to-right for direction=LR", () => {
    const { nodes } = layoutFlow(chainNodes(), chainEdges(), { direction: "LR" });
    const [a, b, c] = nodes as [Node, Node, Node];

    expect(a.position.x).toBeLessThan(b.position.x);
    expect(b.position.x).toBeLessThan(c.position.x);
  });

  it("moves the handle sides with the direction (TB → bottom/top, LR → right/left)", () => {
    const tb = layoutFlow(chainNodes(), chainEdges(), { direction: "TB" }).nodes[0]!;
    expect(tb.sourcePosition).toBe("bottom");
    expect(tb.targetPosition).toBe("top");

    const lr = layoutFlow(chainNodes(), chainEdges(), { direction: "LR" }).nodes[0]!;
    expect(lr.sourcePosition).toBe("right");
    expect(lr.targetPosition).toBe("left");

    const rl = layoutFlow(chainNodes(), chainEdges(), { direction: "RL" }).nodes[0]!;
    expect(rl.sourcePosition).toBe("left");
    expect(rl.targetPosition).toBe("right");
  });

  it("reverses rank order for direction=BT relative to TB", () => {
    const { nodes: tb } = layoutFlow(chainNodes(), chainEdges(), { direction: "TB" });
    const { nodes: bt } = layoutFlow(chainNodes(), chainEdges(), { direction: "BT" });
    const [tbA, tbB] = tb as [Node, Node];
    const [btA, btB] = bt as [Node, Node];

    // TB: a above b above c. BT: a below b below c.
    expect(tbA.position.y).toBeLessThan(tbB.position.y);
    expect(btA.position.y).toBeGreaterThan(btB.position.y);
  });

  it("preserves node identity and data — only position changes", () => {
    const original = chainNodes();
    const { nodes } = layoutFlow(original, chainEdges());

    nodes.forEach((node, i) => {
      expect(node.id).toBe(original[i]!.id);
      expect(node.data).toBe(original[i]!.data);
      expect(node.type).toBe(original[i]!.type);
    });
  });

  it("preserves edges unchanged (same reference, same array)", () => {
    const edges = chainEdges();
    const { edges: outEdges } = layoutFlow(chainNodes(), edges);
    expect(outEdges).toBe(edges);
  });

  it("honors measured size over a stale width/height", () => {
    const nodes: Node[] = [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: {},
        width: 50,
        height: 20,
        measured: { width: 400, height: 200 },
      },
      {
        id: "b",
        position: { x: 0, y: 0 },
        data: {},
        width: 50,
        height: 20,
        measured: { width: 400, height: 200 },
      },
    ];
    const edges: Edge[] = [{ id: "e-ab", source: "a", target: "b" }];

    const { nodes: layouted } = layoutFlow(nodes, edges, { direction: "LR" });
    const [a, b] = layouted;

    // With a 400-wide measured size and default 72px ranksep, b must start at
    // least a.x + measured.width + ranksep away — a value only reachable if
    // the (much larger) measured size, not the stale width, drove the layout.
    expect(b!.position.x - a!.position.x).toBeGreaterThanOrEqual(400 + 72 - 1);
  });

  it("falls back to a sensible default size when neither measured nor width/height are set", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e-ab", source: "a", target: "b" }];

    expect(() => layoutFlow(nodes, edges)).not.toThrow();
    const { nodes: layouted } = layoutFlow(nodes, edges);
    expect(Number.isFinite(layouted[0]!.position.x)).toBe(true);
    expect(Number.isFinite(layouted[0]!.position.y)).toBe(true);
  });

  it("respects custom nodeSpacing/rankSpacing", () => {
    const nodes = chainNodes();
    const edges = chainEdges();
    const tight = layoutFlow(nodes, edges, { rankSpacing: 10 });
    const wide = layoutFlow(nodes, edges, { rankSpacing: 500 });

    const tightGap = tight.nodes[1]!.position.y - tight.nodes[0]!.position.y;
    const wideGap = wide.nodes[1]!.position.y - wide.nodes[0]!.position.y;
    expect(wideGap).toBeGreaterThan(tightGap);
  });
  describe("back edges and self-loops (RM-044)", () => {
    /** The canonical rework fixture: A → B → C, C loops back to B, and B repeats itself. */
    function reworkGraph(): { nodes: Node[]; edges: Edge[] } {
      return {
        nodes: chainNodes(),
        edges: [
          { id: "e-ab", source: "a", target: "b" },
          { id: "e-bc", source: "b", target: "c" },
          { id: "e-cb", source: "c", target: "b" },
          { id: "e-bb", source: "b", target: "b" },
        ],
      };
    }

    it("reports the reversed edge in backEdges and the self-loop in selfLoops", () => {
      const { nodes, edges } = reworkGraph();
      const result = layoutFlow(nodes, edges);

      expect(result.backEdges).toEqual(["e-cb"]);
      expect(result.selfLoops).toEqual(["e-bb"]);
      // Both classifications are disjoint — a self-loop is never a back edge.
      expect(result.backEdges).not.toContain("e-bb");
    });

    it("keeps the self-loop out of the rank computation", () => {
      const { nodes, edges } = reworkGraph();
      const withLoop = layoutFlow(nodes, edges);
      const withoutLoop = layoutFlow(
        nodes,
        edges.filter((e) => e.id !== "e-bb"),
      );

      // Identical positions: the loop contributed nothing to the layout.
      expect(withLoop.nodes.map((n) => n.position)).toEqual(
        withoutLoop.nodes.map((n) => n.position),
      );
    });

    it("returns every edge untouched, self-loops included", () => {
      const { nodes, edges } = reworkGraph();
      const result = layoutFlow(nodes, edges);
      expect(result.edges).toBe(edges);
      expect(result.edges.map((e) => e.id)).toContain("e-bb");
    });

    it("produces no NaN position on the rework fixture", () => {
      const { nodes, edges } = reworkGraph();
      for (const n of layoutFlow(nodes, edges).nodes) {
        expect(Number.isFinite(n.position.x)).toBe(true);
        expect(Number.isFinite(n.position.y)).toBe(true);
      }
    });

    it("classifies the same edge as a back edge in every direction", () => {
      const { nodes, edges } = reworkGraph();
      for (const direction of ["TB", "BT", "LR", "RL"] as const) {
        expect(layoutFlow(nodes, edges, { direction }).backEdges).toEqual(["e-cb"]);
      }
    });

    it("reports nothing for an acyclic, loop-free graph", () => {
      const result = layoutFlow(chainNodes(), chainEdges());
      expect(result.backEdges).toEqual([]);
      expect(result.selfLoops).toEqual([]);
    });

    it("counts a same-rank edge as a back edge — it does not advance the process", () => {
      const nodes: Node[] = [
        { id: "a", position: { x: 0, y: 0 }, data: {} },
        { id: "b", position: { x: 0, y: 0 }, data: {} },
      ];
      // Two mutually-referencing nodes: dagre has to break the cycle somewhere.
      const result = layoutFlow(nodes, [
        { id: "e-ab", source: "a", target: "b" },
        { id: "e-ba", source: "b", target: "a" },
      ]);
      expect(result.backEdges).toEqual(["e-ba"]);
    });

    it("pins node positions on the rework fixture (regression snapshot)", () => {
      const { nodes, edges } = reworkGraph();
      const positions = Object.fromEntries(
        layoutFlow(nodes, edges).nodes.map((n) => [n.id, n.position]),
      );
      expect(positions).toEqual({
        a: { x: 0, y: 0 },
        b: { x: 0, y: 112 },
        c: { x: 0, y: 224 },
      });
    });
  });
});
