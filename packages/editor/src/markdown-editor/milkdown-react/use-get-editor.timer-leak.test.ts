import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { MarkdownEditor } from "../markdown-editor";
import { waitForPendingMilkdownTeardown } from "./use-get-editor";

afterEach(cleanup);

// @milkdown/ctx's internal `Timer` (armed by `Ctx.wait()`, which
// `@milkdown/core`'s `create()`/`destroy()` call internally for every
// `createTimer(name)` — e.g. `ConfigReady`, `InitReady`, `EditorViewReady`)
// uses `TimerType`'s default delay: `createTimer(name, timeout = 3e3)`,
// never overridden anywhere in this repo's editor setup.
const MILKDOWN_TIMER_DELAY_MS = 3000;

/**
 * Locks issue #84: `@milkdown/ctx`'s `Timer` class starts a 3-second
 * `setTimeout` on every wait and never clears the handle on the resolve
 * path — only the DOM/global event listener is removed
 * (`lib/index.js:281-288`, vendored `@milkdown/ctx@7.21.2`). That leaves the
 * timer armed for up to 3s after the promise it backs has already settled,
 * and if it fires after Vitest has recycled the test file's jsdom
 * environment, its callback's bare (unqualified) `removeEventListener` call
 * throws `ReferenceError: removeEventListener is not defined` — the
 * mechanism behind #65's originally-reported error.
 *
 * A bare "was `clearTimeout` called at some point" assertion would pass
 * regardless of this bug, since unrelated React/ProseMirror machinery also
 * calls `clearTimeout`. So this test tracks every `setTimeout` handle armed
 * with Milkdown's exact 3-second delay, and every `clearTimeout` call, and
 * asserts each such handle is cleared once Milkdown's own teardown
 * (`waitForPendingMilkdownTeardown`, tracked in `use-get-editor.ts`) has
 * settled. Against the unpatched `@milkdown/ctx` dependency this fails (no
 * `clearTimeout` call in the vendored file at all — `grep -c clearTimeout`
 * returns 0); the `patches/@milkdown__ctx@7.21.2.patch` fix (storing the
 * handle and clearing it in `#removeListener`, which both the resolve and
 * reject/timeout paths already call) makes it pass.
 */
test("clears the vendored @milkdown/ctx wait timer on teardown (#84)", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  const armedHandles = new Set<ReturnType<typeof setTimeout>>();
  const clearedHandles = new Set<Parameters<typeof clearTimeout>[0]>();

  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    const handle = originalSetTimeout(handler as never, timeout, ...args);
    if (timeout === MILKDOWN_TIMER_DELAY_MS) armedHandles.add(handle);
    return handle;
  }) as unknown as typeof setTimeout);

  vi.spyOn(globalThis, "clearTimeout").mockImplementation(((
    handle?: Parameters<typeof clearTimeout>[0],
  ) => {
    clearedHandles.add(handle);
    return originalClearTimeout(handle as never);
  }) as unknown as typeof clearTimeout);

  const { unmount } = render(createElement(MarkdownEditor, { defaultValue: "# Hello Timer" }));
  await waitFor(() => expect(screen.getByText("Hello Timer")).toBeInTheDocument());

  unmount();
  await waitForPendingMilkdownTeardown();

  vi.restoreAllMocks();

  // Sanity: the mechanism under test actually armed at least one 3-second
  // wait timer during create()/destroy() — otherwise the loop below would
  // trivially pass over an empty set.
  expect(armedHandles.size).toBeGreaterThan(0);

  for (const handle of armedHandles) {
    expect(clearedHandles.has(handle)).toBe(true);
  }
});
