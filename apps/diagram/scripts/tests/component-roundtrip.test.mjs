import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import ELK from "elkjs/lib/elk.bundled.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { module: pipeline } = await runnerImport(`${root}src/state/pipeline.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
// Import the actual pure layout implementation without the UI barrel's CSS modules.
const { module: layout } = await runnerImport(`${root}src/layout/run-elk.ts`, {
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
const { stageGraph } = pipeline;
const node = (id, type, parentId, extra = {}) => ({
  id,
  type,
  parentId,
  data: {},
  position: { x: 0, y: 0 },
  ...extra,
});
const edge = (id, source, target) => ({ id, source, target });
const collapsed = {
  nodes: [
    node("area", "arch/zone"),
    node("ref", "arch/composite", "area"),
    node("source", "arch/service"),
    node("target", "arch/service"),
  ],
  edges: [edge("in", "source", "ref"), edge("out", "ref", "target")],
};
const expanded = {
  nodes: [
    node("area", "arch/zone"),
    node("ref", "arch/zone", "area"),
    node("ref.a", "arch/service", "ref"),
    node("ref.b", "arch/service", "ref"),
    node("source", "arch/service"),
    node("target", "arch/service"),
  ],
  edges: [
    edge("in", "source", "ref.a"),
    edge("inner", "ref.a", "ref.b"),
    edge("out", "ref.b", "target"),
  ],
};
// React Flow measures an explicit wrapper box when width/height are supplied;
// otherwise it measures the renderer's intrinsic dimensions.
const measure = (nodes) =>
  nodes.map((n) => ({
    ...n,
    measured: {
      width: n.width ?? (n.type === "arch/composite" ? 224 : 120),
      height: n.height ?? (n.type === "arch/composite" ? 260 : 90),
    },
  }));
const place = async (graph, direction) => {
  const groups = graph.nodes
    .filter((n) => graph.nodes.some((child) => child.parentId === n.id))
    .map((n) => ({
      id: n.id,
      children: graph.nodes.filter((child) => child.parentId === n.id).map((child) => child.id),
    }));
  const result = await layoutFlowElk(measure(graph.nodes), graph.edges, {
    direction,
    groups,
    edgeRouting: "orthogonal",
    loadEngine: async () => ({
      layout: (elkGraph) => engine.layout(layout.decorateElkGraph(elkGraph, new Map(), direction)),
    }),
  });
  assert.equal(result.engine, "elk");
  return result;
};
const geometry = (nodes) =>
  nodes.map(({ id, position, width, height, measured }) => ({
    id,
    position,
    width: width ?? measured?.width,
    height: height ?? measured?.height,
  }));

for (const direction of ["LR", "TB"]) {
  test(`component expand/collapse restores intrinsic boxes and original ELK geometry (${direction})`, async () => {
    const first = await place(collapsed, direction);
    let current = first;
    for (let cycle = 0; cycle < 3; cycle++) {
      const open = await place(stageGraph(current.nodes, expanded), direction);
      const staged = stageGraph(open.nodes, collapsed);
      const ref = staged.nodes.find((n) => n.id === "ref");
      assert.equal(
        ref.width,
        undefined,
        "the expanded zone box must not constrain the collapsed renderer",
      );
      assert.equal(ref.height, undefined);
      assert.deepEqual(
        ref.position,
        open.nodes.find((n) => n.id === "ref").position,
        "keep position while measuring the new shape",
      );
      current = await place(staged, direction);
      assert.deepEqual(geometry(current.nodes), geometry(first.nodes));
    }
  });
}

test("restaging keeps compatible zone boxes, drops collapsed chips and changed variants, and honors manual positions", () => {
  const old = node("a", "arch/zone", undefined, {
    width: 640,
    height: 480,
    position: { x: 80, y: 40 },
  });
  const next = { nodes: [node("a", "arch/zone")], edges: [] };
  assert.equal(stageGraph([old], next).nodes[0].width, 640);
  assert.equal(stageGraph([{ ...old, data: { collapsed: true } }], next).nodes[0].width, undefined);
  const service = { ...old, type: "arch/service", data: { variant: "icon" } };
  const cards = {
    nodes: [node("a", "arch/service", undefined, { data: { variant: "card" } })],
    edges: [],
  };
  assert.equal(stageGraph([service], cards).nodes[0].width, undefined);
  assert.deepEqual(stageGraph([old], next, true).nodes[0].position, { x: 0, y: 0 });
});
