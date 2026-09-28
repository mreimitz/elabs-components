import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(`${root}src/story/${path}`, { root, configFile: false, logLevel: "error" }))
    .module;
const { advanceProgress, followPosition, storyBoundsMatch } = await load("camera-math.ts");
const { visibleStoryTarget, litStoryNodes } = await load("visible-targets.ts");
const { storyActions, storyStore } = await load("story-store.ts");
const originalWindow = globalThis.window;
const story = {
  explicit: true,
  issues: [],
  steps: [0, 1, 2].map((index) => ({
    id: `story:${index}`,
    title: `Step ${index + 1}`,
    duration: 8,
    camera: "fit",
    nodeIds: ["a"],
    edgeIds: [],
    expand: [],
    callouts: [],
    follow: [],
  })),
};
let replaced;
beforeEach(() => {
  replaced = [];
  globalThis.window = {
    location: { hash: "#d/a.yaml" },
    history: {
      state: { fixture: true },
      replaceState(state, _title, hash) {
        assert.deepEqual(state, { fixture: true });
        replaced.push(hash);
        globalThis.window.location.hash = hash;
      },
    },
  };
  storyStore.set({
    source: "",
    path: null,
    story: { explicit: false, steps: [], issues: [] },
    index: null,
    progress: 0,
    playing: false,
    camera: false,
    pendingPlay: false,
  });
});
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("clock uses seconds, clamps at end and cannot run backward from negative elapsed time", () => {
  assert.equal(advanceProgress(0, 1000, 8), 0.125);
  assert.equal(advanceProgress(0.5, 4000, 8), 1);
  assert.equal(advanceProgress(0.9, 999999, 8), 1);
  assert.equal(advanceProgress(0.5, -200, 8), 0.5);
  let progress = 0;
  for (let frame = 0; frame < 480; frame++) progress = advanceProgress(progress, 1000 / 60, 8);
  assert.ok(Math.abs(progress - 1) < 1e-12);
});

test("follow sampling divides time equally, preserves sequence and lands on last endpoint", () => {
  assert.equal(followPosition(0, 0), null);
  assert.deepEqual(followPosition(-1, 3), { index: 0, fraction: 0 });
  assert.deepEqual(followPosition(0.5, 3), { index: 1, fraction: 0.5 });
  assert.deepEqual(followPosition(1 / 3, 3), { index: 1, fraction: 0 });
  assert.deepEqual(followPosition(1, 3), { index: 2, fraction: 1 });
  assert.deepEqual(followPosition(2, 3), { index: 2, fraction: 1 });
});

test("a story binds without starting and a valid share step restores paused", () => {
  storyActions.bind("a:first", "a.yaml", story);
  assert.equal(storyStore.get().index, null);
  assert.equal(storyStore.get().playing, false);
  globalThis.window.location.hash = "#d/b.yaml&step=2&present";
  storyActions.bind("b:first", "b.yaml", story);
  assert.equal(storyStore.get().index, 1);
  assert.equal(storyStore.get().playing, false);
  assert.equal(storyStore.get().camera, true);
});

test("source identity preserves playback but changed content ends and removes stale share step", () => {
  storyActions.bind("a:first", "a.yaml", story);
  storyActions.go(1, true);
  storyActions.seek(0.4);
  storyActions.play();
  const before = storyStore.get();
  storyActions.bind("a:first", "a.yaml", story);
  assert.strictEqual(storyStore.get(), before);
  storyActions.bind("a:updated", "a.yaml", story);
  assert.equal(storyStore.get().index, null);
  assert.equal(storyStore.get().playing, false);
  assert.equal(storyStore.get().progress, 0);
  assert.equal(globalThis.window.location.hash, "#d/a.yaml");
});

test("manual pan pauses and relinquishes camera; explicit seek and play reclaim it", () => {
  storyActions.bind("a:first", "a.yaml", story);
  storyActions.play();
  assert.equal(storyStore.get().index, 0);
  assert.equal(storyStore.get().playing, true);
  storyActions.manual();
  assert.equal(storyStore.get().playing, false);
  assert.equal(storyStore.get().camera, false);
  storyActions.seek(0.5);
  assert.equal(storyStore.get().progress, 0.5);
  assert.equal(storyStore.get().playing, false);
  assert.equal(storyStore.get().camera, true);
  storyActions.play();
  assert.equal(storyStore.get().playing, true);
  assert.equal(storyStore.get().index, 0);
  assert.equal(storyStore.get().progress, 0.5);
  storyActions.pause();
  assert.equal(storyStore.get().playing, false);
});

test("navigation stays bounded and explicit replay starts again only on Play", () => {
  storyActions.bind("a:first", "a.yaml", story);
  storyActions.go(2);
  const before = storyStore.get();
  storyActions.move(1);
  assert.strictEqual(storyStore.get(), before);
  storyActions.seek(1);
  assert.equal(storyStore.get().playing, false);
  storyActions.play();
  assert.equal(storyStore.get().index, 0);
  assert.equal(storyStore.get().progress, 0);
  assert.equal(storyStore.get().playing, true);
  storyActions.seek(-9);
  assert.equal(storyStore.get().progress, 0);
  storyActions.seek(9);
  assert.equal(storyStore.get().progress, 1);
  storyActions.end();
  assert.equal(storyStore.get().index, null);
  assert.equal(storyStore.get().playing, false);
  assert.equal(storyStore.get().camera, false);
  assert.equal(globalThis.window.location.hash, "#d/a.yaml");
});

test("live, private drill and other-document routes never get a share-step mutation", () => {
  storyActions.bind("a:first", "a.yaml", story);
  for (const hash of ["#v/a.yaml", "#d/a.yaml&into=tenant", "#d/b.yaml"]) {
    globalThis.window.location.hash = hash;
    replaced.length = 0;
    storyActions.go(1);
    storyActions.end();
    assert.deepEqual(replaced, []);
    assert.equal(globalThis.window.location.hash, hash);
  }
});

test("invalid or ineligible incoming share steps stay inactive and empty stories cannot play", () => {
  for (const hash of [
    "#d/a.yaml&step=99",
    "#d/a.yaml&step=2&lens=visual",
    "#d/a.yaml&step=2&into=tenant",
  ]) {
    storyStore.set({ source: "", path: null });
    globalThis.window.location.hash = hash;
    storyActions.bind(hash, "a.yaml", story);
    assert.equal(storyStore.get().index, null);
    assert.equal(storyStore.get().playing, false);
  }
  storyActions.bind("empty", "empty.yaml", { explicit: true, steps: [], issues: [] });
  storyActions.play();
  assert.equal(storyStore.get().index, null);
  assert.equal(storyStore.get().playing, false);
});

test("hidden and unavailable inner targets resolve to the nearest visible owner", () => {
  const nodes = [
    { id: "t", data: {}, position: { x: 0, y: 0 } },
    { id: "t.group", parentId: "t", hidden: true, data: {}, position: { x: 0, y: 0 } },
    { id: "t.leaf", parentId: "t.group", hidden: true, data: {}, position: { x: 0, y: 0 } },
    { id: "hidden-root", hidden: true, data: {}, position: { x: 0, y: 0 } },
  ];
  assert.strictEqual(visibleStoryTarget("t.leaf", nodes), nodes[0]);
  assert.strictEqual(visibleStoryTarget("t.unexpanded.nested", nodes), nodes[0]);
  assert.equal(visibleStoryTarget("missing", nodes), undefined);
  assert.equal(visibleStoryTarget("hidden-root", nodes), undefined);
});

test("a whole-zone target lights nested descendants without lighting unrelated siblings", () => {
  const nodes = [
    { id: "zone" },
    { id: "group", parentId: "zone" },
    { id: "leaf", parentId: "group" },
    { id: "peer", parentId: "zone" },
    { id: "outside" },
    { id: "unrelated", parentId: "outside" },
  ].map((node) => ({ ...node, data: {}, position: { x: 0, y: 0 } }));
  assert.deepEqual([...litStoryNodes(["zone"], nodes)].sort(), ["group", "leaf", "peer", "zone"]);
  assert.deepEqual([...litStoryNodes(["leaf"], nodes)], ["leaf"]);
  assert.deepEqual([...litStoryNodes(["missing"], nodes)], []);
});

test("camera readiness rejects stale rendered dimensions and accepts subpixel layout rounding", () => {
  const expected = { x: 16, y: 120, width: 358, height: 181.2375 };
  assert.equal(
    storyBoundsMatch({ x: 300.382, y: 120, width: 163.595, height: 181.2375 }, expected),
    false,
  );
  assert.equal(storyBoundsMatch({ ...expected, x: 16.001, height: 181.238 }, expected), true);
  assert.equal(storyBoundsMatch({ ...expected, x: NaN }, expected), false);
  assert.equal(storyBoundsMatch(expected, { ...expected, width: Infinity }), false);
});
