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
    // default takes ~30 rAF frames, which is slow enough to time out when the
    // whole suite runs in parallel (it passed in isolation and failed in the
    // full run — the co-residency trap in `.claude/rules/component-api.md`).
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
