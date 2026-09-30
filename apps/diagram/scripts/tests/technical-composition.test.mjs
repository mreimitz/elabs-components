import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import ELK from "elkjs/lib/elk.bundled.js";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { decorateElkGraph },
} = await runnerImport(`${root}src/layout/run-elk.ts`, {
  root,
  configFile: false,
  logLevel: "error",
  resolve: {
    alias: {
      "@elabs-ai/components-flow": fileURLToPath(
        new URL("../../../../packages/flow/src/flow-layout/layout-flow-elk.ts", import.meta.url),
      ),
    },
  },
});
const {
  module: { layoutFlowElk },
} = await runnerImport(
  fileURLToPath(
    new URL("../../../../packages/flow/src/flow-layout/layout-flow-elk.ts", import.meta.url),
  ),
  { root, configFile: false, logLevel: "error" },
);
const engine = new ELK();
let lastGraph;
const runElk = (nodes, edges, options) =>
  layoutFlowElk(nodes, edges, {
    ...options,
    loadEngine: async () => ({
      layout: async (graph) => {
        const result = await engine.layout(
          decorateElkGraph(
            graph,
            options.zoneDirection,
            options.direction,
            options.routing,
            new Map(),
            options.composition,
          ),
        );
        lastGraph = result;
        return result;
      },
    }),
  });
const node = (id, parentId) => ({
  id,
  parentId,
  data: {},
  position: { x: 0, y: 0 },
  width: 120,
  height: 80,
  measured: { width: 120, height: 80 },
});
for (const direction of ["LR", "TB"]) {
  test(`explicit sequence preserves authored stage order (${direction})`, async () => {
    const nodes = [
      node("sequence"),
      ...["first", "second", "third"].map((id) => node(id, "sequence")),
    ];
    const opts = {
      direction,
      zoneDirection: new Map(),
      composition: new Map([["sequence", { arrangement: "sequence", align: "start" }]]),
      groups: [{ id: "sequence", children: ["first", "second", "third"] }],
    };
    // A return dependency must not reverse authored process stages.
    const edges = [
      { id: "feedback", source: "third", target: "first", data: { layoutRole: "secondary" } },
    ];
    const result = await runElk(nodes, edges, opts);
    assert.equal(result.engine, "elk");
    const placed = new Map(result.nodes.map((n) => [n.id, n]));
    const axis = direction === "LR" ? "x" : "y";
    assert.ok(placed.get("first").position[axis] < placed.get("second").position[axis]);
    assert.ok(placed.get("second").position[axis] < placed.get("third").position[axis]);
    const again = await runElk(nodes, edges, opts);
    assert.deepEqual(
      again.nodes.map((n) => [n.id, n.position, n.width, n.height]),
      result.nodes.map((n) => [n.id, n.position, n.width, n.height]),
    );
  });
  test(`parallel branches stack across the flow axis and keep their internal direction (${direction})`, async () => {
    const nodes = [
      node("formulation"),
      node("structured", "formulation"),
      node("unstructured", "formulation"),
      node("s1", "structured"),
      node("s2", "structured"),
      node("u1", "unstructured"),
    ];
    const edges = [{ id: "s", source: "s1", target: "s2" }];
    const result = await runElk(nodes, edges, {
      direction,
      zoneDirection: new Map(),
      composition: new Map([["formulation", { arrangement: "parallel", align: "start" }]]),
      groups: [
        { id: "formulation", children: ["structured", "unstructured"] },
        { id: "structured", children: ["s1", "s2"] },
        { id: "unstructured", children: ["u1"] },
      ],
    });
    assert.equal(result.engine, "elk");
    const p = new Map(result.nodes.map((n) => [n.id, n]));
    const axis = direction === "LR" ? "x" : "y",
      cross = direction === "LR" ? "y" : "x";
    assert.ok(p.get("structured").position[cross] < p.get("unstructured").position[cross]);
    assert.ok(p.get("s1").position[axis] < p.get("s2").position[axis]);
    assert.equal(p.get("structured").position[axis], p.get("unstructured").position[axis]);
  });
}

for (const direction of ["LR", "TB"]) {
  test(`start-aligned unequal stages keep real fixed-port routes attached (${direction})`, async () => {
    const nodes = [
      node("sequence"),
      node("a", "sequence"),
      { ...node("b", "sequence"), width: 190, height: 140, measured: { width: 190, height: 140 } },
      node("c", "sequence"),
    ];
    const edges = [
      { id: "ab", source: "a", target: "b" },
      { id: "bc", source: "b", target: "c" },
    ];
    const routing = {
      labels: new Map(),
      zoneMinWidth: new Map(),
      handles: new Map(
        edges.map((e) => [
          e.id,
          {
            source: direction === "LR" ? "right" : "bottom",
            target: direction === "LR" ? "left" : "top",
          },
        ]),
      ),
    };
    const result = await runElk(nodes, edges, {
      direction,
      zoneDirection: new Map(),
      composition: new Map([["sequence", { arrangement: "sequence", align: "start" }]]),
      groups: [{ id: "sequence", children: ["a", "b", "c"] }],
      routing,
    });
    assert.equal(result.engine, "elk");
    const placed = new Map(result.nodes.map((n) => [n.id, n]));
    const cross = direction === "LR" ? "y" : "x";
    assert.equal(placed.get("a").position[cross], placed.get("b").position[cross]);
    assert.equal(placed.get("a").position[cross], placed.get("c").position[cross]);
    const byId = new Map();
    const allEdges = [];
    const walk = (n, x = 0, y = 0) => {
      const at = { x: x + (n.x ?? 0), y: y + (n.y ?? 0) };
      byId.set(n.id, { ...n, ...at });
      allEdges.push(...(n.edges ?? []));
      for (const child of n.children ?? []) walk(child, at.x, at.y);
    };
    walk(lastGraph);
    for (const edge of edges) {
      const route = allEdges.find((e) => e.id === edge.id);
      assert.ok(route.sections?.length, edge.id);
      const source = byId.get(edge.source),
        target = byId.get(edge.target);
      const first = route.sections[0].startPoint,
        last = route.sections.at(-1).endPoint;
      const expectedSource =
        direction === "LR"
          ? { x: source.x + source.width, y: source.y + source.height / 2 }
          : { x: source.x + source.width / 2, y: source.y + source.height };
      const expectedTarget =
        direction === "LR"
          ? { x: target.x, y: target.y + target.height / 2 }
          : { x: target.x + target.width / 2, y: target.y };
      assert.deepEqual(first, expectedSource, edge.id + " source");
      assert.deepEqual(last, expectedTarget, edge.id + " target");
    }
  });
}
