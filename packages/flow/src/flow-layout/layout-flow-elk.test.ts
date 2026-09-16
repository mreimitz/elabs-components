import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { layoutFlow } from "./flow-layout";
import { layoutFlowElk } from "./layout-flow-elk";

function chainNodes(): Node[] {
  return ["a", "b", "c"].map((id) => ({
    id,
    type: "brand",
    position: { x: 0, y: 0 },
    data: { title: id.toUpperCase() },
  }));
}

/** RM-044's canonical rework fixture: A → B → C, C loops back to B, and B repeats itself. */
function reworkEdges(): Edge[] {
  return [
    { id: "e-ab", source: "a", target: "b" },
    { id: "e-bc", source: "b", target: "c" },
    { id: "e-cb", source: "c", target: "b" },
    { id: "e-bb", source: "b", target: "b" },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("layoutFlowElk", () => {
  it("lays the rework fixture out with ELK: no NaN, same node order as dagre", async () => {
    const nodes = chainNodes();
    const edges = reworkEdges();
    const elk = await layoutFlowElk(nodes, edges);
    const dagre = layoutFlow(nodes, edges);

    expect(elk.engine).toBe("elk");
    for (const node of elk.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    const order = (list: Node[]) =>
      [...list].sort((p, q) => p.position.y - q.position.y).map((n) => n.id);
    expect(order(elk.nodes)).toEqual(order(dagre.nodes));
    expect(elk.backEdges).toEqual(dagre.backEdges);
    expect(elk.selfLoops).toEqual(["e-bb"]);
    expect(elk.edges).toBe(edges);
  });

  it("classifies the back edge in every direction and moves handles with it", async () => {
    for (const direction of ["TB", "BT", "LR", "RL"] as const) {
      const result = await layoutFlowElk(chainNodes(), reworkEdges(), { direction });
      expect(result.backEdges).toEqual(["e-cb"]);
    }
    const lr = await layoutFlowElk(chainNodes(), reworkEdges(), { direction: "LR" });
    expect(lr.nodes[0]!.sourcePosition).toBe("right");
    expect(lr.nodes[0]!.targetPosition).toBe("left");
  });

  it("round-trips groups to parentId + relative positions, sizing the group", async () => {
    const nodes: Node[] = [
      { id: "g", type: "group", position: { x: 0, y: 0 }, data: {} },
      ...chainNodes(),
    ];
    const result = await layoutFlowElk(nodes, reworkEdges(), {
      edgeRouting: "orthogonal",
      groups: [{ id: "g", children: ["b", "c"] }],
    });
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get("b")!.parentId).toBe("g");
    expect(byId.get("c")!.parentId).toBe("g");
    expect(byId.get("a")!.parentId).toBeUndefined();
    expect(byId.get("g")!.width).toBeGreaterThan(172);
    expect(byId.get("b")!.position.x).toBeGreaterThanOrEqual(0);
  });

  it("falls back to dagre with a warning when the engine cannot load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const nodes = chainNodes();
    const edges = reworkEdges();
    const result = await layoutFlowElk(nodes, edges, {
      loadEngine: () => Promise.reject(new Error("Cannot find module 'elkjs'")),
    });
    expect(result.engine).toBe("dagre");
    expect(result.nodes).toEqual(layoutFlow(nodes, edges).nodes);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to dagre when ELK itself throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await layoutFlowElk(chainNodes(), reworkEdges(), {
      loadEngine: async () => ({ layout: () => Promise.reject(new Error("bad graph")) }),
    });
    expect(result.engine).toBe("dagre");
  });
});

describe("elkjs lazy boundary (RM-067)", () => {
  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  /** Every non-test, non-story source file statically reachable from the package barrel. */
  function staticGraph(entry: string): Set<string> {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      const re = /^\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["'](\.[^"']*)["']/gm;
      for (const match of source.matchAll(re)) {
        const base = join(dirname(file), match[1]!);
        const hit = [
          `${base}.ts`,
          `${base}.tsx`,
          join(base, "index.ts"),
          join(base, "index.tsx"),
        ].find((candidate) => {
          try {
            return statSync(candidate).isFile();
          } catch {
            return false;
          }
        });
        if (hit) queue.push(hit);
      }
    }
    return seen;
  }

  it("never imports elkjs statically from anything the barrel reaches", () => {
    const reachable = staticGraph(join(srcDir, "index.ts"));
    expect(reachable.has(join(srcDir, "flow-layout", "layout-flow-elk.ts"))).toBe(true);
    const offenders = [...reachable].filter((file) =>
      /^\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?["']elkjs(?:\/[^"']*)?["']/m.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the worker entry out of the barrel's static graph", () => {
    const reachable = staticGraph(join(srcDir, "index.ts"));
    expect(reachable.has(join(srcDir, "flow-layout", "elk-worker.ts"))).toBe(false);
    expect(readdirSync(join(srcDir, "flow-layout"))).toContain("elk-worker.ts");
  });
});
