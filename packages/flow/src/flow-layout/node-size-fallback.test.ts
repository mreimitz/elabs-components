import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { FLOW_DEFAULT_NODE_SIZE } from "../flow-geometry";
import { layoutFlow } from "./flow-layout";
import { layoutFlowElk } from "./layout-flow-elk";
import { layoutGraph, type LayoutAlgorithm } from "./layout-graph";

/**
 * All three layout engines size a node the same way, through the one shared helper:
 * `measured`, else `width`/`height`, else React Flow's own 172×40 default box. These
 * cases pin the LAST step — an unsized node lays out exactly like one that declares the
 * default box — so the dedupe onto `flowNodeSize` cannot drift from the old behaviour.
 */

/** A → B → C, every node unsized unless `size` is given. */
function chain(size?: { width: number; height: number }): Node[] {
  return ["a", "b", "c"].map((id) => ({
    id,
    position: { x: 0, y: 0 },
    data: {},
    ...(size ? { width: size.width, height: size.height } : {}),
  }));
}

const edges: Edge[] = [
  { id: "e-ab", source: "a", target: "b" },
  { id: "e-bc", source: "b", target: "c" },
];

const positions = (nodes: Node[]) => nodes.map((node) => node.position);

describe("layout node-size fallback", () => {
  it("is React Flow's 172×40 default node box", () => {
    expect(FLOW_DEFAULT_NODE_SIZE).toEqual({ width: 172, height: 40 });
  });

  describe("layoutFlow (dagre)", () => {
    it("lays an unsized node out exactly like one declaring the default box", () => {
      for (const direction of ["TB", "LR"] as const) {
        expect(positions(layoutFlow(chain(), edges, { direction }).nodes)).toEqual(
          positions(layoutFlow(chain(FLOW_DEFAULT_NODE_SIZE), edges, { direction }).nodes),
        );
      }
    });

    it("spaces unsized ranks by the default box plus the rank gap", () => {
      const tb = layoutFlow(chain(), edges, { direction: "TB", rankSpacing: 72 }).nodes;
      expect(tb[1]!.position.y - tb[0]!.position.y).toBe(40 + 72);
      const lr = layoutFlow(chain(), edges, { direction: "LR", rankSpacing: 72 }).nodes;
      expect(lr[1]!.position.x - lr[0]!.position.x).toBe(172 + 72);
    });
  });

  describe("layoutGraph", () => {
    // The algorithms that read a node's size (`concentric` and `grid` place by index).
    const algorithms: LayoutAlgorithm[] = ["layered-tb", "layered-lr", "force"];

    it.each(algorithms)(
      "%s: an unsized node matches one declaring the default box",
      (algorithm) => {
        expect(positions(layoutGraph(chain(), edges, { algorithm, iterations: 50 }))).toEqual(
          positions(
            layoutGraph(chain(FLOW_DEFAULT_NODE_SIZE), edges, { algorithm, iterations: 50 }),
          ),
        );
      },
    );

    it("force: the default box is what keeps unsized nodes apart (not a vacuous match)", () => {
      // A much larger declared box collides differently, so the equality above is only
      // true because the unsized nodes really were given 172×40.
      const big = layoutGraph(chain({ width: 600, height: 600 }), edges, {
        algorithm: "force",
        iterations: 50,
      });
      expect(
        positions(layoutGraph(chain(), edges, { algorithm: "force", iterations: 50 })),
      ).not.toEqual(positions(big));
    });
  });

  describe("layoutFlowElk", () => {
    it("lays an unsized leaf out exactly like one declaring the default box", async () => {
      const unsized = await layoutFlowElk(chain(), edges, { direction: "LR" });
      const declared = await layoutFlowElk(chain(FLOW_DEFAULT_NODE_SIZE), edges, {
        direction: "LR",
      });
      expect(unsized.engine).toBe("elk");
      expect(positions(unsized.nodes)).toEqual(positions(declared.nodes));

      const big = await layoutFlowElk(chain({ width: 400, height: 200 }), edges, {
        direction: "LR",
      });
      expect(positions(unsized.nodes)).not.toEqual(positions(big.nodes));
    });
  });
});
