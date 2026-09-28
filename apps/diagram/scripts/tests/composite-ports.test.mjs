import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" })).module;
const { checkText } = await load("spec/check-text.ts");
const { ARCH_DEFINITIONS } = await load("spec/compile/arch-definitions.ts");
const { toReactFlow } = await load("spec/flow-spec/to-react-flow.ts");
const { connectCompositePorts } = await load("spec/compose/ports.ts");
const files = new Map([
  ["child.yaml", { text: 'diagram: "1"\nnodes: [{id: top}, {id: right}]\n', mtime: 1 }],
]);
for (const direction of ["LR", "TB"]) {
  test(`named reference ports preserve both directions and avoid ordinary handle collisions (${direction})`, () => {
    const checked = checkText(
      `diagram: "1"\ndirection: ${direction}\nnodes: [{id: a}, {id: b}, {id: t, ref: ws/child}]\nflows: ["a -> t.top", "b -> t.right", "t.top -> b", "t.right -> a", "a -> t"]\n`,
      new Set(),
      { files },
    );
    assert.equal(checked.ok, true, JSON.stringify(checked.issues));
    const graph = toReactFlow(checked.spec, ARCH_DEFINITIONS);
    const before = JSON.stringify(graph);
    const edges = connectCompositePorts(graph.nodes, graph.edges);
    assert.equal(JSON.stringify(graph), before, "decoration does not mutate the generic graph");
    assert.equal(edges[0].targetHandle, "in:inner:top");
    assert.equal(edges[1].targetHandle, "in:inner:right");
    assert.equal(edges[2].sourceHandle, "out:inner:top");
    assert.equal(edges[3].sourceHandle, "out:inner:right");
    assert.equal(
      edges[4].targetHandle,
      graph.edges[4].targetHandle,
      "plain reference endpoints stay ordinary",
    );
    assert.ok(!edges[4].targetHandle.includes("inner:"));
    assert.equal(edges[0].sourceHandle, graph.edges[0].sourceHandle);
  });
}
test("expanded, missing and unlisted inner endpoints never create phantom handles", () => {
  const edge = {
    id: "a->b",
    source: "a",
    target: "b",
    sourceHandle: "out:right",
    targetHandle: "in:left",
    data: { innerSource: "x", innerTarget: "absent" },
  };
  const nodes = [
    { id: "a", type: "arch/zone", data: { ports: ["x"] }, position: { x: 0, y: 0 } },
    { id: "b", type: "arch/composite", data: { ports: ["real"] }, position: { x: 0, y: 0 } },
  ];
  assert.deepEqual(connectCompositePorts(nodes, [edge]), [edge]);
  assert.deepEqual(connectCompositePorts([], [edge]), [edge]);
});
