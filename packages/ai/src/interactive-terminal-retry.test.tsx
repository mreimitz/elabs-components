/**
 * Component-level regression lock for issue #99 — after a NON-peer-missing
 * engine load failure, clicking "Try again" must actually recover the
 * terminal, not re-render the identical error forever.
 *
 * Deliberately does **not** `vi.mock("./_interactive-terminal-xterm")` — that
 * is exactly what hid this bug in `interactive-terminal-missing-peer.test.tsx`
 * (that file mocks the loader wholesale, so the module-scoped `enginePromise`
 * cache the loader owns never actually runs, and its cache-eviction defect
 * can't be observed). This file instead mocks one layer below, the same way
 * `interactive-terminal.test.tsx` does for its happy path:
 * `@xterm/xterm` / `@xterm/addon-fit` themselves, via a getter-backed mock
 * that fails on the first read and succeeds after the mock is flipped — so
 * `loadXTermEngine()`'s own memoisation/eviction logic runs for real.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      // A NON-peer-missing failure shape (no "cannot find module" / "failed
      // to resolve" / "module not found" wording), so `isOptionalPeerMissing()`
      // returns false and the error branch that renders the Retry button
      // ("Try again") is the one that mounts — issue #99's repro step 1.
      throw new Error("Unexpected token evaluating the xterm engine chunk");
    }
    return class FakeTerminal {
      options: Record<string, unknown> = {};
      textarea = { setAttribute: vi.fn() };
      loadAddon = vi.fn();
      open = vi.fn();
      write = vi.fn();
      clear = vi.fn();
      focus = vi.fn();
      dispose = vi.fn();
      attachCustomKeyEventHandler = vi.fn();
      onData = vi.fn(() => ({ dispose: vi.fn() }));
      onResize = vi.fn(() => ({ dispose: vi.fn() }));
    };
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class FakeFitAddon {
    fit = vi.fn();
    dispose = vi.fn();
  },
}));

// The real stylesheet import is a side-effect-only CSS import (already a
// no-op under this package's `css: false` vitest config); mock it explicitly
// so the module graph doesn't need to touch the filesystem in this test.
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import { InteractiveTerminal } from "./interactive-terminal";

beforeEach(() => {
  h.state.attempts = 0;
  h.state.shouldFail = true;
});
afterEach(cleanup);

/** Lets a pending dynamic `import()` + its `.then` settle inside `act`. */
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

describe("InteractiveTerminal — Retry recovers from a real engine load failure (#99)", () => {
  it('clicking "Try again" issues a fresh import attempt and, once the failure has cleared, mounts the terminal', async () => {
    render(<InteractiveTerminal aria-label="Agent shell" />);
    await flush();

    // Non-peer-missing branch: StatePanel kind="error" + "Try again".
    const retryButton = await screen.findByRole("button", { name: /try again/i });
    expect(h.state.attempts).toBe(1);

    // The underlying failure condition has cleared.
    h.state.shouldFail = false;

    await act(async () => {
      retryButton.click();
    });
    await flush();

    // A fresh import() attempt was actually issued by the retry — not served
    // from the poisoned cache (today, unfixed, this stays at 1 forever).
    expect(h.state.attempts).toBe(2);

    // The terminal recovered: the error panel + Retry button are gone.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    });
  });
});
