import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { layoutFrame, motionProgress } = (
  await runnerImport(`${root}src/layout/layout-motion.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;
const node = (id, position, props = {}) => ({ id, position, data: {}, ...props });
const edge = (points) => ({ id: "e", source: "a", target: "b", data: { route: { points } } });

test("relayout interpolates nested coordinates and dimensions without mutating endpoints", () => {
  const before = { nodes: [node("a", { x: 10, y: 20 }, { width: 100, height: 50 })], edges: [] };
  const after = { nodes: [node("a", { x: 110, y: 220 }, { width: 300, height: 150 })], edges: [] };
  const middle = layoutFrame(before, after, 0.5).nodes[0];
  assert.deepEqual(middle.position, { x: 60, y: 120 });
  assert.equal(middle.width, 200);
  assert.equal(middle.height, 100);
  assert.equal(before.nodes[0].width, 100);
  assert.strictEqual(layoutFrame(before, after, 1), after);
});

test("reparented and newly visible nodes fade at their correct parent coordinates", () => {
  const before = { nodes: [node("a", { x: 500, y: 400 }, { parentId: "old" })], edges: [] };
  const after = {
    nodes: [node("a", { x: 20, y: 30 }, { parentId: "new" }), node("b", { x: 1, y: 2 })],
    edges: [],
  };
  const frame = layoutFrame(before, after, 0.25);
  assert.deepEqual(frame.nodes[0].position, after.nodes[0].position);
  assert.equal(frame.nodes[0].style.opacity, 0.25);
  assert.equal(frame.nodes[1].style.opacity, 0.25);
});

test("different route bend counts retain every original corner at the start and exact route at completion", () => {
  const a = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 90 },
    { x: 100, y: 90 },
  ];
  const b = [
    { x: 20, y: 20 },
    { x: 20, y: 50 },
    { x: 150, y: 50 },
  ];
  const before = { nodes: [], edges: [edge(a)] };
  const after = { nodes: [], edges: [edge(b)] };
  const initial = layoutFrame(before, after, 0).edges[0].data.route.points;
  for (const corner of a)
    assert(initial.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1e-8));
  const middle = layoutFrame(before, after, 0.5).edges[0].data.route.points;
  assert.deepEqual(middle[0], { x: 10, y: 10 });
  assert.deepEqual(middle.at(-1), { x: 125, y: 70 });
  assert.deepEqual(layoutFrame(before, after, 1).edges[0].data.route.points, b);
});

test("motion follows the shared CSS easing token with exact endpoints", () => {
  const easing = "cubic-bezier(0.2, 0, 0, 1)";
  assert.equal(motionProgress(easing, 0), 0);
  assert.equal(motionProgress(easing, 1), 1);
  assert(motionProgress(easing, 0.5) > 0.8);
  assert(Math.abs(motionProgress("cubic-bezier(0, 0, 1, 1)", 0.5) - 0.5) < 0.0001);
});
