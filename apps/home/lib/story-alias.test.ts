import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexSource, frameOutdated, type StoryIndex } from "./story-alias";

// A fake `/storybook/index.json` answer: the ids it lists and, optionally, the packaged copy's
// build state (the `x-storybook-copy` header .vscode/storybook-copy.mjs sends).
function answer(
  ids: string[],
  copy?: "rebuilding" | "ready",
  status = 200,
  built = "Fri, 25 Sep 2026 14:08:19 GMT",
) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ "last-modified": built, ...(copy ? { "x-storybook-copy": copy } : {}) }),
    json: async () => ({ entries: Object.fromEntries(ids.map((id) => [id, {}])) }),
  } as unknown as Response;
}

describe("createIndexSource", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fetches the index once and shares it", async () => {
    const load = vi.fn(async () => answer(["a--default"]));
    const source = createIndexSource(load, 3000);
    const [first, second] = await Promise.all([source.get(), source.get()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first.reach).toBe("ok");
    expect(first.build).toBe("Fri, 25 Sep 2026 14:08:19 GMT");
    expect([...(first.ids ?? [])]).toEqual(["a--default"]);
    await source.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("re-checks while watched, so a Storybook that caught up shows without a reload", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(answer(["a--default"], "rebuilding"))
      .mockResolvedValue(answer(["a--default", "b--default"], "ready"));
    const source = createIndexSource(load, 3000);
    const before = await source.get();
    expect(before.rebuilding).toBe(true);
    expect(before.ids?.has("b--default")).toBe(false);

    const listener = vi.fn();
    source.subscribe(listener);
    const stop = source.watch();
    await vi.advanceTimersByTimeAsync(3000);
    expect(listener).toHaveBeenCalled();
    expect(source.current()?.ids?.has("b--default")).toBe(true);
    expect(source.current()?.rebuilding).toBe(false);

    stop();
    const calls = load.mock.calls.length;
    await vi.advanceTimersByTimeAsync(9000);
    expect(load).toHaveBeenCalledTimes(calls);
  });

  it("keeps one timer for many watchers and stops when the last one leaves", async () => {
    const load = vi.fn(async () => answer([]));
    const source = createIndexSource(load, 3000);
    await source.get();
    const stopA = source.watch();
    const stopB = source.watch();
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(2);
    stopA();
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(3);
    stopB();
    await vi.advanceTimersByTimeAsync(3000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("reports an index it cannot read as unreachable", async () => {
    const failing = createIndexSource(async () => answer([], undefined, 500), 3000);
    expect(await failing.get()).toMatchObject({ ids: null, reach: "unreachable" });
    const throwing = createIndexSource(async () => {
      throw new Error("offline");
    }, 3000);
    expect(await throwing.get()).toMatchObject({ ids: null, reach: "unreachable" });
  });
});

describe("frameOutdated", () => {
  const OLD = "Fri, 25 Sep 2026 08:56:03 GMT";
  const NEW = "Fri, 25 Sep 2026 14:08:19 GMT";
  const index = (build: string | null, rebuilding = false): StoryIndex => ({
    ids: new Set(),
    reach: build ? "ok" : "unreachable",
    rebuilding,
    build,
  });

  it("reloads a frame that failed on the old copy once the new build is served", () => {
    const origin = { build: OLD, rebuilding: true };
    expect(frameOutdated(origin, true, index(OLD, true))).toBe(false);
    expect(frameOutdated(origin, true, index(NEW))).toBe(true);
  });

  it("reloads a frame that rendered the old copy while it was being rebuilt", () => {
    expect(frameOutdated({ build: OLD, rebuilding: true }, false, index(NEW))).toBe(true);
  });

  it("reloads a failed frame loaded before the index was known, once it is", () => {
    expect(frameOutdated({ build: null, rebuilding: false }, true, index(NEW))).toBe(true);
  });

  it("leaves a frame alone while nothing newer is served", () => {
    // A story that fails on the current build stays failed, instead of reloading every few seconds.
    expect(frameOutdated({ build: NEW, rebuilding: false }, true, index(NEW))).toBe(false);
    // A frame that rendered a finished build is current.
    expect(frameOutdated({ build: OLD, rebuilding: false }, false, index(NEW))).toBe(false);
    // Storybook unreachable: nothing to reload into yet.
    expect(frameOutdated({ build: OLD, rebuilding: true }, true, index(null))).toBe(false);
    expect(frameOutdated({ build: OLD, rebuilding: true }, true, null)).toBe(false);
  });
});
