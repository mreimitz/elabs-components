/**
 * use-canvas-draw.test.tsx — the draw loop's two non-obvious contracts:
 * reduced motion really disables the enter ramp, and a missing 2D context is a
 * survivable state rather than a crash.
 *
 * `useReducedMotion` is mocked at the module boundary rather than through
 * `matchMedia`: motion reads the query once at subscribe time, so a stubbed
 * media list makes the test assert on motion's caching, not on this hook.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installCanvasContextStub } from "../../test/primitives";
import { type ChartScales, useCanvasDraw } from "./use-canvas-draw";

const reducedMotion = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => reducedMotion.value,
}));

let canvasStub: ReturnType<typeof installCanvasContextStub>;

beforeEach(() => {
  reducedMotion.value = false;
  progressSeen = [];
  canvasStub = installCanvasContextStub();
});

afterEach(() => {
  canvasStub.restore();
});

/**
 * Every `progress` value `draw` was handed, collected OUTSIDE React: a ref
 * mutated in a layout effect never reaches the DOM (nothing re-renders), so
 * asserting through rendered text would assert on React, not on the ramp.
 */
let progressSeen: number[] = [];

function Harness({ animateIn }: { animateIn: boolean }) {
  const { canvasRef } = useCanvasDraw({
    animateIn,
    // A short ramp on purpose: the assertion is that it RAMPS, and a 480ms
    // default takes ~30 rAF frames, which is unnecessarily slow for a test.
    // (This used to also mask a real clock-mixing bug, #396, that made the
    // ramp jump load-dependently — fixed by deriving `start` from the first
    // rAF callback's own `now` instead of an out-of-band `performance.now()`.)
    animationDuration: 60,
    draw: (_ctx, scales: ChartScales) => {
      progressSeen.push(scales.progress);
    },
    height: 100,
    width: 200,
  });
  return <canvas ref={canvasRef} />;
}

describe("useCanvasDraw", () => {
  it("ramps progress 0→1 when asked to animate in", async () => {
    render(<Harness animateIn />);
    await waitFor(() => expect(progressSeen.at(-1)).toBe(1), { timeout: 4000 });
    expect(progressSeen[0]).toBeLessThan(1);
    expect(progressSeen.length).toBeGreaterThan(1);
  });

  it("never ramps progress negative when the first rAF `now` disagrees with the ambient performance.now() clock", () => {
    // Deterministic lock for the clock-mixing mechanism itself (#396): a real
    // `performance.now()` reading taken OUTSIDE the rAF loop (as an eager
    // `start` capture would) is made to read far ahead of the timestamps the
    // rAF scheduler itself hands to callbacks — exactly the origin mismatch
    // jsdom produces under contention. Every scheduled frame is driven by
    // hand, including the re-scheduling `step` does from inside itself, so
    // this reproduces the bug on every run rather than only under real load.
    const pendingFrames: FrameRequestCallback[] = [];
    let nextFrameId = 0;
    const rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        pendingFrames.push(cb);
        return ++nextFrameId;
      });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    // Ambient clock reads a huge value: the eager `performance.now()` this
    // issue diagnoses would capture THIS as `start`, while the rAF callbacks
    // below hand back timestamps from an entirely different, near-zero origin.
    const nowSpy = vi.spyOn(performance, "now").mockReturnValue(999_999);

    render(<Harness animateIn />);

    // Drive every scheduled frame (including ones `step` re-schedules from
    // inside itself) on a rAF-native clock that starts near zero.
    let rafClock = 0;
    let framesRun = 0;
    while (pendingFrames.length > 0 && framesRun < 10) {
      const callback = pendingFrames.shift();
      framesRun += 1;
      callback?.(rafClock);
      rafClock += 60; // animationDuration in Harness
    }

    rafSpy.mockRestore();
    cafSpy.mockRestore();
    nowSpy.mockRestore();

    expect(progressSeen.length).toBeGreaterThan(0);
    expect(progressSeen.every((p) => p >= 0)).toBe(true);
    expect(progressSeen.at(-1)).toBe(1);
  });

  it("draws the FINAL frame immediately under prefers-reduced-motion", async () => {
    reducedMotion.value = true;
    render(<Harness animateIn />);
    // Give a ramp a chance to run, so this asserts absence rather than earliness.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(progressSeen).toEqual([1]);
  });

  it("paints exactly once on mount when there is no enter ramp", () => {
    render(<Harness animateIn={false} />);
    expect(progressSeen).toEqual([1]);
  });

  it("survives a canvas with no 2D context instead of throwing", () => {
    canvasStub.restore(); // back to jsdom's null-returning getContext
    expect(() => render(<Harness animateIn={false} />)).not.toThrow();
  });
});
