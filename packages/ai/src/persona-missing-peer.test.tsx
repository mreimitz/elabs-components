/**
 * Issue #33 — `@rive-app/react-webgl2` is an OPTIONAL peer of
 * `@elabs-ai/components-ai`, reached only through `lazy(() =>
 * import("./_persona-rive"))` inside `Persona` (ADR 0019). A REJECTED `lazy()`
 * import throws during render — `Suspense` alone does not catch that (it only
 * covers the pending state) — so `Persona` wraps it in `LazyEngineBoundary`
 * (`_lazy-engine-boundary.tsx`). This locks that the boundary actually falls
 * back to the placeholder instead of taking the whole tree down.
 *
 * Separate file from `persona.test.tsx`: that file exercises the real
 * (unmocked) `./_persona-rive` module and never awaits its resolution; this
 * file mocks it to simulate the optional peer being absent, without touching
 * the sibling file's assumptions.
 *
 * `vi.mock` factories are hoisted, so the mock itself must resolve
 * successfully (a factory that throws or returns a rejected promise gets
 * intercepted by Vitest's OWN "error when mocking a module" diagnostic
 * instead of the message this test needs — see
 * `interactive-terminal-missing-peer.test.tsx` for the same finding). So the
 * module resolves fine and the simulated failure instead comes from the
 * default export THROWING when React renders it — a real render-phase error,
 * which is exactly what `LazyEngineBoundary` exists to catch.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_persona-rive", () => ({
  default: () => {
    throw new Error("Cannot find module '@rive-app/react-webgl2'");
  },
}));

import { Persona } from "./persona";

afterEach(cleanup);

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

describe("Persona — missing optional peer (#33)", () => {
  it("falls back to the placeholder instead of crashing when the Rive engine fails to load", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Persona state="idle" fallback={<span>resting</span>} />);
    await flush();

    // The tree survived — the caller-supplied fallback rendered — rather than
    // the whole component (or its ancestors) unmounting.
    expect(screen.getByText("resting")).toBeInTheDocument();
    // The failure is still observable to a developer, not silently eaten.
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
