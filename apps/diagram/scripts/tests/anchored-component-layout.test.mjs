import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { anchorComponentLayout } = (
  await runnerImport(`${root}src/layout/anchored-component-layout.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;
const node = (id, x, y, width, height, parentId) => ({
  id,
  position: { x, y },
  width,
  height,
  data: {},
  ...(parentId ? { parentId } : {}),
});
const layout = (nodes, edges = []) => ({ nodes, edges, engine: "elk", ms: 1 });
const byId = (result, id) => result.nodes.find((n) => n.id === id);

test("expansion anchors the component and leaves distant nodes at their original coordinates", () => {
  const before = layout([node("c", 500, 300, 100, 100), node("distant", 10, 10, 80, 80)]);
  const after = layout([
    node("c", 10, 10, 300, 250),
    node("child", 16, 60, 80, 80, "c"),
    node("distant", 500, 500, 80, 80),
  ]);
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.deepEqual(byId(result, "c").position, { x: 500, y: 300 });
  assert.deepEqual(byId(result, "distant").position, { x: 10, y: 10 });
  assert.deepEqual(byId(result, "child").position, { x: 16, y: 60 });
  assert.equal(byId(result, "c").width, 300);
  assert.deepEqual(byId(after, "c").position, { x: 10, y: 10 });
});

test("nested parents grow down/right and colliding sibling branches move without shuffling", () => {
  const before = layout([
    node("parent", 200, 200, 180, 200),
    node("c", 16, 60, 100, 100, "parent"),
    node("right", 420, 200, 100, 100),
    node("further", 560, 200, 100, 100),
    node("above", 220, 20, 80, 80),
  ]);
  const after = layout([
    node("parent", 0, 0, 500, 500),
    node("c", 20, 200, 300, 250, "parent"),
    node("child", 16, 60, 80, 80, "c"),
    node("right", 600, 0, 100, 100),
    node("further", 800, 0, 100, 100),
    node("above", 0, 800, 80, 80),
  ]);
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.deepEqual(byId(result, "parent").position, { x: 200, y: 200 });
  assert.deepEqual(byId(result, "c").position, { x: 16, y: 60 });
  assert.equal(byId(result, "parent").width, 332);
  assert.equal(byId(result, "parent").height, 326);
  assert.equal(byId(result, "right").position.x, 692);
  assert.equal(byId(result, "further").position.x, 952);
  assert.deepEqual(byId(result, "above").position, { x: 220, y: 20 });
});

test("a sibling below the component moves downward even in left-to-right diagrams", () => {
  const before = layout([node("c", 100, 100, 100, 100), node("below", 100, 240, 100, 100)]);
  const after = layout([node("c", 0, 0, 200, 300), node("below", 400, 0, 100, 100)]);
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.deepEqual(byId(result, "below").position, { x: 100, y: 560 });
});

test("internal routes translate with the component and changed external routes reconnect", () => {
  const before = layout([node("c", 500, 300, 100, 100), node("outside", 1000, 300, 100, 100)]);
  const route = {
    points: [
      { x: 126, y: 110 },
      { x: 176, y: 110 },
    ],
    label: { x: 136, y: 100, width: 20, height: 20 },
  };
  const after = layout(
    [
      { ...node("c", 10, 10, 300, 250), type: "arch/zone" },
      node("a", 16, 60, 100, 80, "c"),
      node("b", 166, 60, 100, 80, "c"),
      node("outside", 700, 10, 100, 100),
    ],
    [
      { id: "internal", source: "a", target: "b", data: { route } },
      {
        id: "external",
        source: "b",
        target: "outside",
        data: {
          route: {
            points: [
              { x: 276, y: 110 },
              { x: 400, y: 110 },
              { x: 400, y: 60 },
              { x: 700, y: 60 },
            ],
          },
          label: "Connection",
        },
      },
    ],
  );
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.deepEqual(result.edges[0].data.route.points, [
    { x: 616, y: 400 },
    { x: 666, y: 400 },
  ]);
  assert.equal(result.edges[0].data.route.label.x, 626);
  assert.deepEqual(result.edges[1].data.route.points[0], { x: 766, y: 400 });
  assert.deepEqual(result.edges[1].data.route.points.at(-1), { x: 1000, y: 350 });
  assert.equal(result.edges[1].data.label, "Connection");
  assert.equal(route.points[0].x, 126);
});

test("unknown anchors are left to ordinary layout and collapse fallback keeps its compact size", () => {
  const before = layout([node("c", 200, 300, 400, 500)]);
  const after = layout([node("c", 0, 0, 100, 100)]);
  assert.equal(anchorComponentLayout(before, after, "unknown", "LR"), after);
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.equal(byId(result, "c").width, 100);
  assert.deepEqual(byId(result, "c").position, { x: 200, y: 300 });
});

test("wide expansion preserves neighbor order even when input nodes are reversed", () => {
  const before = layout([
    node("c", 100, 100, 100, 100),
    node("further", 400, 100, 100, 100),
    node("near", 250, 100, 100, 100),
  ]);
  const after = layout([
    node("c", 0, 0, 700, 200),
    node("further", 0, 0, 100, 100),
    node("near", 0, 0, 100, 100),
  ]);
  const result = anchorComponentLayout(before, after, "c", "LR");
  assert.equal(byId(result, "near").position.x, 960);
  assert.equal(byId(result, "further").position.x, 1220);
});

test("a newly expanded obstacle invalidates a preserved edge even when neither endpoint moves", () => {
  const route = {
    points: [
      { x: 80, y: 240 },
      { x: 800, y: 240 },
    ],
    label: { x: 250, y: 230, width: 80, height: 20 },
  };
  const edge = { id: "crossing", source: "s", target: "t", data: { route } };
  const before = layout(
    [
      { ...node("c", 200, 100, 100, 100), type: "arch/zone" },
      node("s", 0, 200, 80, 80),
      node("t", 800, 200, 80, 80),
    ],
    [edge],
  );
  const after = layout(
    [
      { ...node("c", 200, 100, 300, 300), type: "arch/zone" },
      node("child", 30, 100, 80, 80, "c"),
      node("s", 0, 200, 80, 80),
      node("t", 800, 200, 80, 80),
    ],
    [edge],
  );
  const result = anchorComponentLayout(before, after, "c", "LR");
  const rerouted = result.edges[0].data.route;
  assert.ok(rerouted);
  assert.notDeepEqual(rerouted.points, route.points);
  assert.deepEqual(rerouted.points[0], route.points[0]);
  assert.deepEqual(rerouted.points.at(-1), route.points.at(-1));
  for (let i = 1; i < rerouted.points.length; i++) {
    const a = rerouted.points[i - 1],
      b = rerouted.points[i];
    assert.equal(
      a.x === b.x
        ? a.x > 200 && a.x < 500 && Math.max(a.y, b.y) > 100 && Math.min(a.y, b.y) < 400
        : a.y > 100 && a.y < 400 && Math.max(a.x, b.x) > 200 && Math.min(a.x, b.x) < 500,
      false,
    );
  }
  assert.notDeepEqual(rerouted.label, route.label);
});
