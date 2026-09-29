import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { routeDisclosureEdge, disclosureRouteIsClear } = (
  await runnerImport(`${root}src/layout/disclosure-routing.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;
const node = (id, x, y, width, height, extra = {}) => ({
  id,
  position: { x, y },
  width,
  height,
  data: {},
  ...extra,
});
const map = (nodes) => new Map(nodes.map((n) => [n.id, n]));
const crosses = (points, b) =>
  points.slice(1).some((p, i) => {
    const a = points[i];
    return a.x === p.x
      ? a.x > b.x &&
          a.x < b.x + b.width &&
          Math.max(a.y, p.y) > b.y &&
          Math.min(a.y, p.y) < b.y + b.height
      : a.y > b.y &&
          a.y < b.y + b.height &&
          Math.max(a.x, p.x) > b.x &&
          Math.min(a.x, p.x) < b.x + b.width;
  });
test("an access route to a higher external target passes around component header and controls", () => {
  const nodes = map([
    node("component", 100, 200, 400, 400, { type: "arch/zone" }),
    node("source", 250, 100, 80, 80, { parentId: "component" }),
    node("target", 700, 100, 100, 100),
  ]);
  const route = routeDisclosureEdge(
    {
      id: "e",
      source: "source",
      target: "target",
      data: {
        route: {
          points: [
            { x: 430, y: 340 },
            { x: 550, y: 340 },
            { x: 550, y: 150 },
            { x: 700, y: 150 },
          ],
          label: { x: 500, y: 100, width: 100, height: 24 },
        },
      },
    },
    nodes,
    nodes,
    [],
  );
  assert.ok(route);
  assert.deepEqual(route.points[0], { x: 430, y: 340 });
  assert.deepEqual(route.points.at(-1), { x: 700, y: 150 });
  assert.equal(crosses(route.points, { x: 100, y: 200, width: 400, height: 44 }), false);
  assert.equal(crosses(route.points, { x: 350, y: 300, width: 80, height: 80 }), false);
  assert.ok(route.label);
});
test("routes relocate exact named handle offsets and avoid newly moved unrelated leaf boxes", () => {
  const fresh = map([
    node("source", 0, 100, 100, 100),
    node("target", 500, 100, 100, 100),
    node("obstacle", 200, 300, 100, 100),
  ]);
  const current = map([
    node("source", 100, 200, 100, 100),
    node("target", 600, 200, 100, 100),
    node("obstacle", 300, 180, 100, 140),
  ]);
  const route = routeDisclosureEdge(
    {
      id: "e",
      source: "source",
      target: "target",
      data: {
        route: {
          points: [
            { x: 100, y: 125 },
            { x: 500, y: 125 },
          ],
        },
      },
    },
    fresh,
    current,
    [],
  );
  assert.ok(route);
  assert.deepEqual(route.points[0], { x: 200, y: 225 });
  assert.deepEqual(route.points.at(-1), { x: 600, y: 225 });
  assert.equal(crosses(route.points, { x: 300, y: 180, width: 100, height: 140 }), false);
});

test("preserved captions are rejected when they cover a new obstacle or reserved caption", () => {
  const nodes = map([
    node("source", 0, 100, 100, 100),
    node("target", 500, 100, 100, 100),
    node("obstacle", 200, 180, 100, 100),
  ]);
  const edge = { id: "e", source: "source", target: "target" };
  const route = {
    points: [
      { x: 100, y: 150 },
      { x: 500, y: 150 },
    ],
    label: { x: 200, y: 170, width: 100, height: 24 },
  };
  assert.equal(disclosureRouteIsClear(edge, route, nodes, []), false);
  const clearRoute = { ...route, label: { x: 200, y: 138, width: 100, height: 24 } };
  assert.equal(disclosureRouteIsClear(edge, clearRoute, nodes, []), true);
  assert.equal(disclosureRouteIsClear(edge, clearRoute, nodes, [clearRoute.label]), false);
});
