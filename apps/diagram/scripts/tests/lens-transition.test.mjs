/* global AbortController */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness(reduced = false) {
  const frames = new Map();
  const listeners = new Map();
  let next = 0;
  let now = 0;
  const window = {
    location: { hash: "#d/example.yaml", pathname: "/", search: "" },
    history: {
      replaceState: (_, __, url) => {
        window.location.hash = url.slice(url.indexOf("#"));
      },
    },
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  const createStore = (initial) => {
    let state = initial;
    return {
      get: () => state,
      set: (patch) => {
        state = { ...state, ...patch };
      },
      subscribe() {},
    };
  };
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL("../../src/shell/lens-store.ts", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    window,
    AbortController,
    require: (id) => {
      if (id === "react") return {};
      if (id.endsWith("motion")) return { prefersReducedMotion: () => reduced };
      if (id.endsWith("create-store")) return { createStore };
      return {
        isVisualLensHash: (hash) => hash.includes("lens=visual"),
        hashWithLens: (hash, visual) =>
          hash.replace("&lens=visual", "") + (visual ? "&lens=visual" : ""),
      };
    },
    requestAnimationFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  return {
    ...exports,
    window,
    frames,
    async flushPreparation() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    frame() {
      now += 16;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((fn) => fn(now));
    },
    finish() {
      for (let i = 0; frames.size && i < 100; i++) this.frame();
      assert.equal(frames.size, 0);
    },
  };
}

test("waits for real target readiness, then settles and retains drilldown intent", async () => {
  const h = harness();
  let ready;
  h.registerLensPreparation(
    () =>
      new Promise((resolve) => {
        ready = resolve;
      }),
  );
  h.lensActions.setLens("visual");
  assert.equal(h.lensStore.get().position, 0);
  assert.equal(h.lensStore.get().animating, true);
  ready(true);
  await h.flushPreparation();
  h.finish();
  assert.equal(h.lensStore.get().lens, "visual");
  h.registerLensPreparation(async () => true);
  h.lensActions.setLens("technical", { frameNodeIds: ["agent", "tool"] });
  await h.flushPreparation();
  h.finish();
  assert.deepEqual(Array.from(h.lensStore.get().frameNodeIds), ["agent", "tool"]);
  assert.equal(h.lensStore.get().position, 0);
});

test("rapid reversal starts at current position without second preparation", async () => {
  const h = harness();
  let preparations = 0;
  h.registerLensPreparation(async () => {
    preparations++;
    return true;
  });
  h.lensActions.setLens("visual");
  await h.flushPreparation();
  for (let i = 0; i < 6; i++) h.frame();
  const position = h.lensStore.get().position;
  assert.ok(position > 0 && position < 1);
  h.lensActions.setLens("technical");
  assert.equal(h.lensStore.get().position, position);
  h.frame();
  assert.ok(h.lensStore.get().position < position);
  h.finish();
  assert.equal(preparations, 1);
  assert.equal(h.lensStore.get().lens, "technical");
});

test("document navigation aborts stale preparation and discards its resolution", async () => {
  const h = harness();
  let signal;
  let ready;
  h.registerLensPreparation((value) => {
    signal = value;
    return new Promise((resolve) => {
      ready = resolve;
    });
  });
  h.lensActions.setLens("visual");
  h.window.location.hash = "#d/other.yaml";
  h.lensActions.settleForDocument();
  assert.equal(signal.aborted, true);
  ready(true);
  await h.flushPreparation();
  assert.equal(h.frames.size, 0);
  assert.equal(h.lensStore.get().position, 0);
  assert.equal(h.lensStore.get().animating, false);
});

test("navigation cancels a moving transition and reduced motion still settles deterministically", async () => {
  for (const reduced of [false, true]) {
    const h = harness(reduced);
    h.registerLensPreparation(async () => true);
    h.lensActions.setLens("visual");
    await h.flushPreparation();
    h.frame();
    h.frame();
    h.window.location.hash = "#d/other.yaml&lens=visual";
    h.lensActions.settleForDocument();
    assert.equal(h.frames.size, 0);
    assert.equal(h.lensStore.get().position, 1);
    h.lensActions.setLens("technical");
    await h.flushPreparation();
    h.finish();
    assert.equal(h.lensStore.get().position, 0);
    assert.equal(h.lensStore.get().animating, false);
  }
});

test("readiness failure settles cleanly and unregister aborts in-flight preparation", async () => {
  const h = harness();
  h.registerLensPreparation(async () => {
    throw new Error("renderer unmounted");
  });
  h.lensActions.setLens("visual");
  await h.flushPreparation();
  assert.equal(h.frames.size, 0);
  assert.equal(h.lensStore.get().position, 1);
  let signal;
  const unregister = h.registerLensPreparation((value) => {
    signal = value;
    return new Promise((resolve) => value.addEventListener("abort", () => resolve(false)));
  });
  h.lensActions.setLens("technical");
  unregister();
  assert.equal(signal.aborted, true);
  await h.flushPreparation();
  assert.equal(h.lensStore.get().animating, false);
});
