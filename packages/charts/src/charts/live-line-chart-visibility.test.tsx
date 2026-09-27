/**
 * Locks two review findings on `LiveLineChart`'s animation loop
 * (`live-line-chart.tsx`):
 *
 *  1. The `requestAnimationFrame` loop must not run while the chart is
 *     off-screen (not intersecting its own container) or the tab is hidden
 *     (Page Visibility API) — it used to run forever regardless.
 *  2. `prefers-reduced-motion` must skip the value/range lerp smoothing
 *     (snap straight to the target) instead of easing toward it.
 *
 * jsdom has no real `IntersectionObserver` (RM-038) and no controllable
 * `requestAnimationFrame`/`performance.now()` — all three are faked here so
 * the loop's scheduling can be driven and observed deterministically.
 */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (dims: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// One mutable switch (same pattern as chart-reveal-clip.test.tsx) instead of
// resetting modules — lets a test flip `prefers-reduced-motion` without a
// second React instance.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => motionState.reduced,
}));
// RM-189: the reveal clip and LiveLineChart read reduced motion from the tokens
// package hook (the person's explicit preference before the OS setting).
vi.mock("@elabs-ai/components-tokens", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => motionState.reduced === true,
}));

import { LiveLine } from "./live-line";
import { LiveLineChart, type LiveLinePoint } from "./live-line-chart";

// ---------------------------------------------------------------------------
// Fake IntersectionObserver — same shape as chart-reveal-clip.test.tsx's, plus
// a `fire(isIntersecting)` helper.
// ---------------------------------------------------------------------------
class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observedTargets: Element[] = [];

  constructor(public callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observedTargets.push(target);
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(isIntersecting: boolean) {
    const target = this.observedTargets[0];
    act(() => {
      this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this);
    });
  }
}

// ---------------------------------------------------------------------------
// Fake requestAnimationFrame — tracks every scheduled callback by id so a
// test can both COUNT schedule calls and manually flush the oldest pending
// one; `cancelAnimationFrame` removes it, mirroring real browser semantics
// (this is what makes the "stops scheduling" assertions meaningful: a stale
// callback that was properly cancelled can never be flushed again).
// ---------------------------------------------------------------------------
let nextRafId = 1;
let rafQueue = new Map<number, FrameRequestCallback>();
let scheduleCount = 0;

function flushOldestFrame(): boolean {
  const entry = rafQueue.entries().next();
  if (entry.done) {
    return false;
  }
  const [id, cb] = entry.value;
  rafQueue.delete(id);
  act(() => {
    cb(performance.now());
  });
  return true;
}

let originalIO: typeof IntersectionObserver | undefined;
let nowMs = 0;

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;

  nextRafId = 1;
  rafQueue = new Map();
  scheduleCount = 0;
  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextRafId++;
    scheduleCount += 1;
    rafQueue.set(id, cb);
    return id;
  }) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = ((id: number) => {
    rafQueue.delete(id);
  }) as typeof cancelAnimationFrame;

  motionState.reduced = false;

  nowMs = 0;
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);

  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  vi.restoreAllMocks();
});

const NOW_SEC = Math.floor(Date.now() / 1000);
const sampleData: LiveLinePoint[] = Array.from({ length: 5 }, (_, i) => ({
  time: NOW_SEC - (4 - i),
  value: 50 + i,
}));

function renderChart(props?: Partial<{ value: number; lerpSpeed: number }>) {
  return render(
    <LiveLineChart data={sampleData} value={50} {...props}>
      <LiveLine dataKey="value" />
    </LiveLineChart>,
  );
}

describe("LiveLineChart — animation loop pauses off-screen / tab-hidden (review item 7a)", () => {
  it("does not schedule any animation frame before the container has ever intersected the viewport", () => {
    renderChart();
    expect(scheduleCount).toBe(0);
  });

  it("starts scheduling once the container intersects, and stops once it stops intersecting", () => {
    renderChart();
    const observer = FakeIntersectionObserver.instances.at(-1);
    expect(observer).toBeTruthy();

    observer!.fire(true);
    expect(scheduleCount).toBeGreaterThan(0);
    const countWhileVisible = scheduleCount;

    // The loop is actually running: flushing the queued frame reschedules itself.
    expect(flushOldestFrame()).toBe(true);
    expect(scheduleCount).toBeGreaterThan(countWhileVisible);

    observer!.fire(false);
    const countAfterLeavingView = scheduleCount;

    // The pending frame was cancelled by the effect's cleanup when `isActive`
    // flipped to false, and no new one was scheduled in its place.
    expect(flushOldestFrame()).toBe(false);
    expect(scheduleCount).toBe(countAfterLeavingView);
  });

  it("stops scheduling when the tab becomes hidden, and resumes when it becomes visible again", () => {
    renderChart();
    const observer = FakeIntersectionObserver.instances.at(-1);
    observer!.fire(true);
    expect(scheduleCount).toBeGreaterThan(0);

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const countAfterHidden = scheduleCount;
    expect(flushOldestFrame()).toBe(false);
    expect(scheduleCount).toBe(countAfterHidden);

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(scheduleCount).toBeGreaterThan(countAfterHidden);
  });
});

describe("LiveLineChart — prefers-reduced-motion skips lerp smoothing (review item 7a)", () => {
  it("snaps the displayed value straight to the target on the next tick instead of easing toward it", () => {
    // A tiny lerpSpeed would normally mean the displayed value barely moves in
    // one tick (0.1% of the distance to target); under reduced motion it must
    // snap fully to `value` instead.
    const { container, rerender } = renderChart({ value: 50, lerpSpeed: 0.001 });
    const observer = FakeIntersectionObserver.instances.at(-1);
    observer!.fire(true);

    // Warm-up: commit an initial frame (still at the starting value=50) far
    // enough past t=0 to clear the internal 32ms commit-throttle window.
    nowMs = 1000;
    flushOldestFrame();

    // Now retarget to 91 under reduced motion and flush exactly one more tick.
    motionState.reduced = true;
    nowMs = 1040;
    rerender(
      <LiveLineChart data={sampleData} value={91} lerpSpeed={0.001}>
        <LiveLine dataKey="value" />
      </LiveLineChart>,
    );
    expect(flushOldestFrame()).toBe(true);

    const badge = container.querySelector("text");
    expect(badge?.textContent).toBe("91.00");
  });

  it("control: WITHOUT reduced motion, the same tiny lerpSpeed barely moves the displayed value in one tick", () => {
    const { container, rerender } = renderChart({ value: 50, lerpSpeed: 0.001 });
    const observer = FakeIntersectionObserver.instances.at(-1);
    observer!.fire(true);

    nowMs = 1000;
    flushOldestFrame();

    nowMs = 1040;
    rerender(
      <LiveLineChart data={sampleData} value={91} lerpSpeed={0.001}>
        <LiveLine dataKey="value" />
      </LiveLineChart>,
    );
    expect(flushOldestFrame()).toBe(true);

    const badge = container.querySelector("text");
    // 50 + (91 - 50) * 0.001 = 50.041
    expect(badge?.textContent).toBe("50.04");
  });
});
