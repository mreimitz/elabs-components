import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { startParticles, readParticleStats } = (
  await runnerImport(`${root}src/particles/engine.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;
test("real engine pairs directions, refreshes metadata/geometry, gates demand, culls and cleans its clock", () => {
  const globals = [
    "document",
    "window",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "ResizeObserver",
    "MutationObserver",
    "getComputedStyle",
    "Element",
  ];
  const previous = Object.fromEntries(
    globals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  const frames = new Map(),
    mutations = [],
    sizes = [];
  let serial = 0,
    listeners = new Map(),
    paneListeners = new Map();
  const ctx = {
    moves: [],
    colors: [],
    setTransform() {},
    clearRect() {
      this.moves = [];
      this.colors = [];
    },
    save() {},
    restore() {},
    translate(x, y) {
      this.moves.push([x, y]);
      this.colors.push(this.fillStyle);
    },
    rotate() {},
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
  };
  const edge = { dataset: { id: "a->b" } };
  class Element {
    closest() {
      return edge;
    }
  }
  const path = Object.assign(new Element(), {
    dataset: { kind: "data", direction: "both", schedule: "nightly" },
    isConnected: true,
    d: "M0 0L44 0",
    getAttribute() {
      return this.d;
    },
    getTotalLength() {
      return 44;
    },
    getPointAtLength(l) {
      return { x: l, y: 0 };
    },
  });
  let paths = [path],
    viewport = [0, 0, 1];
  const pane = {
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
    querySelectorAll: () => paths,
    addEventListener: (n, f) => paneListeners.set(n, f),
    removeEventListener: (n) => paneListeners.delete(n),
  };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  try {
    Object.assign(globalThis, {
      Element,
      document: {
        hidden: false,
        documentElement: {},
        addEventListener: (n, f) => listeners.set(n, f),
        removeEventListener: (n) => listeners.delete(n),
      },
      window: { devicePixelRatio: 1 },
      requestAnimationFrame: (f) => {
        frames.set(++serial, f);
        return serial;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      getComputedStyle: (el) => ({ stroke: el.dataset.kind === "access" ? "strong" : "normal" }),
      MutationObserver: class {
        constructor(f) {
          this.callback = f;
          mutations.push(this);
        }
        observe() {}
        disconnect() {
          this.closed = true;
        }
      },
      ResizeObserver: class {
        constructor(f) {
          this.callback = f;
          sizes.push(this);
        }
        observe() {}
        disconnect() {
          this.closed = true;
        }
      },
    });
    const tick = (t) => {
      const queued = [...frames.values()];
      frames.clear();
      for (const f of queued) f(t);
    };
    const dispose = startParticles({ canvas, pane, viewport: () => viewport });
    tick(100);
    tick(200);
    assert.equal(ctx.moves.length, 2, "single batch emits in both directions");
    assert.ok(ctx.moves[0][0] < ctx.moves[1][0]);
    const sampleCount = readParticleStats(canvas).samples;
    viewport = [0, 0, 2];
    tick(300);
    assert.equal(readParticleStats(canvas).samples, sampleCount, "zoom reuses path");
    path.dataset.kind = "access";
    mutations[0].callback();
    tick(400);
    assert.deepEqual(new Set(ctx.colors), new Set(["strong"]), "live kind refreshes token color");
    globalThis.getComputedStyle = () => ({ stroke: "dark-token" });
    mutations[1].callback();
    tick(450);
    assert.deepEqual(
      new Set(ctx.colors),
      new Set(["dark-token"]),
      "live theme refreshes token color",
    );
    path.d = "M0 0L45 0";
    mutations[0].callback();
    tick(500);
    assert.equal(readParticleStats(canvas).samples, sampleCount + 1);
    path.dataset.schedule = "on-demand";
    mutations[0].callback();
    tick(600);
    assert.equal(ctx.moves.length, 0);
    paneListeners.get("focusin")({ target: path });
    tick(700);
    assert.ok(ctx.moves.length >= 2, "keyboard-focused demand animates");
    paneListeners.get("focusout")();
    tick(800);
    assert.equal(ctx.moves.length, 0);
    paneListeners.get("pointerover")({ target: path });
    tick(900);
    assert.ok(ctx.moves.length >= 2, "hovered demand animates");
    viewport = [10000, 0, 1];
    tick(1000);
    assert.equal(readParticleStats(canvas).visibleEdges, 0);
    assert.equal(ctx.moves.length, 0);
    paths = [];
    mutations[0].callback();
    tick(1100);
    assert.equal(readParticleStats(canvas).cachedEdges, 0);
    globalThis.document.hidden = true;
    listeners.get("visibilitychange")();
    assert.equal(frames.size, 0);
    globalThis.document.hidden = false;
    listeners.get("visibilitychange")();
    assert.equal(frames.size, 1);
    dispose();
    assert.equal(frames.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(paneListeners.size, 0);
    assert.ok([...mutations, ...sizes].every((o) => o.closed));
  } finally {
    for (const key of globals) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  }
});
