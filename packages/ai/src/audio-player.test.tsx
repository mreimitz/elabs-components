/**
 * Issue #33 — `media-chrome` is an OPTIONAL peer of `@elabs-ai/components-ai`,
 * reached only through `lazy(() => import("./_audio-player-media-chrome"))`
 * (ADR 0019, `lazyPart` in `audio-player.tsx`). A REJECTED `lazy()` import
 * throws during render — `Suspense` alone does not catch that (it only covers
 * the pending state) — so every exported part is wrapped in
 * `LazyEngineBoundary` (`_lazy-engine-boundary.tsx`). This locks that the
 * boundary falls back gracefully for the top-level `AudioPlayer` AND for a
 * sub-control, instead of taking the tree down.
 *
 * `vi.mock` factories are hoisted, so the mock itself must resolve
 * successfully (a factory that throws or rejects gets intercepted by
 * Vitest's OWN "error when mocking a module" diagnostic instead of the
 * message this test needs — see `interactive-terminal-missing-peer.test.tsx`
 * for the same finding). So the module resolves fine and the simulated
 * failure instead comes from each named export THROWING when React renders
 * it — a real render-phase error, which is exactly what `LazyEngineBoundary`
 * exists to catch.
 *
 * The top-level `AudioPlayer` case asserts a SETTLED, non-loading notice
 * (never a permanent `Skeleton`) — a loading placeholder left in place after
 * the load has definitively failed reads as "still loading, forever", which
 * `.claude/rules/loading-states.md` treats as a defect, not a graceful
 * fallback. See `AudioPlayerMissing` in `audio-player.tsx`.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_audio-player-media-chrome", () => ({
  AudioPlayer: () => {
    throw new Error("Cannot find module 'media-chrome'");
  },
  AudioPlayerPlayButton: () => {
    throw new Error("Cannot find module 'media-chrome'");
  },
}));

import { AudioPlayer, AudioPlayerPlayButton } from "./audio-player";

afterEach(cleanup);

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

describe("AudioPlayer — missing optional peer (#33)", () => {
  it("falls back to a settled, actionable notice — never a permanent skeleton — when media-chrome fails to load", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AudioPlayer />);
    await flush();

    // The tree survived, and it settled: no permanent loading placeholder
    // (a `Skeleton` left in place after a definitive failure would read as
    // "still loading, forever" — the bug this locks against), and the
    // notice names the exact missing package via `role="status"` (a missing
    // optional peer is a capability gap, not a broken component).
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/media-chrome/i);
    expect(document.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("degrades a sub-control to nothing rather than crashing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(<AudioPlayerPlayButton />);
    await flush();

    // `renderMissing={() => null}` for sub-controls — an empty, but intact,
    // tree beats a crash.
    expect(container).toBeEmptyDOMElement();
    expect(errorSpy).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });
});
