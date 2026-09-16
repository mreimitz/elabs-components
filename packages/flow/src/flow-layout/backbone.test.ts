import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { pinBackbone } from "./backbone";
import { layoutFlowElk } from "./layout-flow-elk";

/**
 * A 3-variant process: the top variant runs start → register → check → approve → pay → end;
 * a second skips `check`; a third reworks `check` via `request info`.
 */
function threeVariantGraph(): { nodes: Node[]; edges: Edge[] } {
  const ids = ["start", "register", "check", "info", "approve", "reject", "pay", "end"];
  const nodes: Node[] = ids.map((id) => ({ id, position: { x: 0, y: 0 }, data: {} }));
  const pairs: [string, string][] = [
    ["start", "register"],
    ["register", "check"],
    ["check", "approve"],
    ["approve", "pay"],
    ["pay", "end"],
    ["register", "approve"],
    ["check", "info"],
    ["info", "check"],
    ["check", "reject"],
    ["reject", "end"],
  ];
  const edges: Edge[] = pairs.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
  }));
  return { nodes, edges };
}

const TOP_VARIANT = ["register", "check", "approve", "pay"];

describe("pinBackbone", () => {
  it("pins the variant's nodes and the edges that join them, in order", () => {
    const { nodes, edges } = threeVariantGraph();
    const backbone = pinBackbone(nodes, edges, [...TOP_VARIANT, "missing", "check"]);
    expect(backbone.nodeIds).toEqual(TOP_VARIANT);
    expect(backbone.edgeIds).toEqual(["register-check", "check-approve", "approve-pay"]);
  });

  it("lays the top variant's four activities on one straight row (LR)", async () => {
    const { nodes, edges } = threeVariantGraph();
    const backbone = pinBackbone(nodes, edges, TOP_VARIANT);
    const result = await layoutFlowElk(nodes, edges, { direction: "LR", backbone });
    expect(result.engine).toBe("elk");

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    const rows = TOP_VARIANT.map((id) => byId.get(id)!.position.y);
    expect(new Set(rows).size).toBe(1);
    const columns = TOP_VARIANT.map((id) => byId.get(id)!.position.x);
    expect(columns).toEqual([...columns].sort((p, q) => p - q));
  });

  it("lays it on one straight column (TB) and every node still connects start to end", async () => {
    const { nodes, edges } = threeVariantGraph();
    const backbone = pinBackbone(nodes, edges, TOP_VARIANT);
    const result = await layoutFlowElk(nodes, edges, { direction: "TB", backbone });

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(new Set(TOP_VARIANT.map((id) => byId.get(id)!.position.x)).size).toBe(1);

    // Connectivity invariant: every node is reachable from start and reaches end.
    const reach = (from: string, forward: boolean): Set<string> => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length > 0) {
        const id = queue.pop()!;
        for (const edge of result.edges) {
          const [a, b] = forward ? [edge.source, edge.target] : [edge.target, edge.source];
          if (a === id && !seen.has(b)) {
            seen.add(b);
            queue.push(b);
          }
        }
      }
      return seen;
    };
    const fromStart = reach("start", true);
    const toEnd = reach("end", false);
    for (const node of result.nodes) {
      expect(fromStart.has(node.id)).toBe(true);
      expect(toEnd.has(node.id)).toBe(true);
      expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
    }
  });
});
