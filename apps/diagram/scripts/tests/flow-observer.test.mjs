/** Execute the installed ESM hook, so dropping the dependency patch breaks this regression. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("@xyflow/react/package.json"));
function harness(code, hasObserver = true) {
  const frames = new Map();
  const updates = [];
  let sequence = 0;
  let notify;
  let disconnected = false;
  let effect;
  const context = {
    Map,
    selector$c: null,
    useStore: () => (batch) => updates.push([...batch.values()]),
    useRef: (current) => ({ current }),
    useState: (initial) => [initial()],
    useEffect: (callback) => {
      effect = callback;
    },
    requestAnimationFrame: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: hasObserver
      ? class {
          constructor(callback) {
            notify = callback;
          }
          disconnect() {
            disconnected = true;
          }
        }
      : undefined,
  };
  const observer = runInNewContext(`${code}\nuseResizeObserver();`, context);
  let cleanup = effect();
  return {
    observer,
    frames,
    updates,
    notify: (...targets) => notify(targets.map((target) => ({ target }))),
    flush: () => {
      const ready = [...frames.values()];
      frames.clear();
      ready.forEach((callback) => callback());
    },
    cleanup: () => cleanup(),
    remount: () => {
      cleanup = effect();
    },
    disconnected: () => disconnected,
  };
}
const node = (id) => ({ isConnected: true, getAttribute: () => id });
for (const entry of ["index.js", "index.mjs"]) {
  const source = await readFile(join(root, "dist/esm", entry), "utf8");
  const start = source.indexOf("function useResizeObserver() {");
  assert.ok(start >= 0, "Review dependency upgrade: hook moved");
  const code = source.slice(start, source.indexOf("\n/**", start));
  test(`${entry}: node measurements coalesce after observer delivery`, () => {
    const h = harness(code);
    const first = node("a"),
      latest = node("a"),
      other = node("b");
    h.notify(first);
    h.notify(latest, other);
    assert.equal(h.updates.length, 0, "Observer callback must not mutate observed geometry");
    assert.equal(h.frames.size, 1);
    h.flush();
    assert.equal(h.updates.length, 1);
    assert.deepEqual(
      h.updates[0].map((update) => update.id),
      ["a", "b"],
    );
    assert.equal(h.updates[0][0].nodeElement, latest);
    assert.ok(h.updates[0].every((update) => update.force));
    h.notify(other);
    h.flush();
    assert.equal(h.updates.length, 2);
    h.cleanup();
  });
  test(`${entry}: removed or repurposed elements never flush stale measurements`, () => {
    const h = harness(code);
    const gone = node("gone"),
      changed = node("before");
    h.notify(gone, changed);
    gone.isConnected = false;
    changed.getAttribute = () => "after";
    h.flush();
    assert.equal(h.updates.length, 0);
    h.notify(gone, node(null));
    assert.equal(h.frames.size, 0);
    h.cleanup();
  });
  test(`${entry}: cleanup cancels queued and late callbacks; strict remount resumes`, () => {
    const h = harness(code);
    h.notify(node("a"));
    h.cleanup();
    assert.equal(h.frames.size, 0);
    assert.equal(h.disconnected(), true);
    h.notify(node("late"));
    h.flush();
    assert.equal(h.updates.length, 0);
    h.remount();
    h.notify(node("new"));
    h.flush();
    assert.deepEqual(
      h.updates.flat().map((update) => update.id),
      ["new"],
    );
    h.cleanup();
  });
  test(`${entry}: an environment without ResizeObserver remains supported`, () => {
    const h = harness(code, false);
    assert.equal(h.observer, null);
    h.cleanup();
  });
}
