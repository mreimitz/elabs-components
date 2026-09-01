/**
 * Loader-level regression lock for issue #99 — `loadXTermEngine()` memoised
 * its dynamic `import()` with `enginePromise ??= …`. A REJECTED promise is
 * neither `null` nor `undefined`, so once the first load failed the cache was
 * poisoned forever: every later call (including the retries
 * `InteractiveTerminal`'s "Try again" button drives) got back the same
 * settled rejection with zero new `import()` attempts.
 *
 * Mocks one layer BELOW the loader — `@xterm/xterm` / `@xterm/addon-fit`
 * themselves — via a getter that increments an attempt counter and either
 * throws or resolves, so the loader's own cache-eviction logic runs for
 * real. `interactive-terminal-retry.test.tsx` explains why the loader module
 * itself must never be mocked for this bug.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: {
    attempts: 0,
    shouldFail: true,
  },
}));

vi.mock("@xterm/xterm", () => ({
  get Terminal() {
    h.state.attempts += 1;
    if (h.state.shouldFail) {
      throw new Error("Unexpected token evaluating the xterm engine chunk");
    }
    return class FakeTerminal {};
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class FakeFitAddon {},
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

describe("loadXTermEngine (#99 — a rejected load must not poison the cache forever)", () => {
  beforeEach(() => {
    h.state.attempts = 0;
    h.state.shouldFail = true;
    // Each test gets its own fresh module instance, so `enginePromise` (a
    // module-scoped singleton) never leaks state between tests.
    vi.resetModules();
  });

  it("evicts a rejected load so a retry attempts the import again, and a cleared failure can then succeed", async () => {
    const { loadXTermEngine } = await import("./_interactive-terminal-xterm");

    await expect(loadXTermEngine()).rejects.toThrow(
      "Unexpected token evaluating the xterm engine chunk",
    );
    expect(h.state.attempts).toBe(1);

    // The underlying failure condition has cleared (e.g. a redeploy fixed the
    // chunk). Today (unfixed) this call is served the same cached rejection
    // and `attempts` stays at 1 — the bug.
    h.state.shouldFail = false;

    await expect(loadXTermEngine()).resolves.toMatchObject({
      XTerm: expect.any(Function),
      FitAddon: expect.any(Function),
    });
    expect(h.state.attempts).toBe(2);
  });

  it("keeps caching a SUCCESS — a call after a successful load does not re-import (ADR 0019, once per app)", async () => {
    const { loadXTermEngine } = await import("./_interactive-terminal-xterm");
    h.state.shouldFail = false;

    await loadXTermEngine();
    expect(h.state.attempts).toBe(1);

    await loadXTermEngine();
    await loadXTermEngine();
    expect(h.state.attempts).toBe(1);
  });

  it("shares one attempt across two concurrent calls issued before the first settles", async () => {
    const { loadXTermEngine } = await import("./_interactive-terminal-xterm");
    h.state.shouldFail = false;

    const first = loadXTermEngine();
    const second = loadXTermEngine();
    expect(second).toBe(first);

    await Promise.all([first, second]);
    expect(h.state.attempts).toBe(1);
  });
});
