/**
 * #175 — `revealOn`/`replayOnClick` on `BarChart`'s public props.
 *
 * `BarChart` reads the same reveal gate as `LineChart`/`AreaChart`
 * (`useChartRevealGate` in `chart-reveal-clip.tsx`); these tests mirror the
 * `LineChart revealOn (#175)` block in `line-chart.test.tsx`. jsdom has no real
 * `IntersectionObserver`, so a fake one lets a test fire an intersection
 * deterministically; the real-browser scroll proof is the
 * `Charts/BarChart` → `RevealInView` story.
 *
 * Bars grow on their own `revealEpoch` rather than through a clip, so the
 * observable contract is the reported phase: `"revealing"` while the reveal is
 * held or playing, `"ready"` once it has settled.
 */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One mutable switch instead of a module reset (the `chart-reveal-clip.test.tsx`
// pattern). Defaults to `false`: the animating path.
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

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import type { ChartPhase } from "./chart-phase";

const data = [
  { month: "Jan", value: 100 },
  { month: "Feb", value: 200 },
  { month: "Mar", value: 150 },
];

class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
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
  fireIntersecting() {
    const target = this.observedTargets[0];
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
  }
}

let originalIO: typeof IntersectionObserver | undefined;

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver;
  motionState.reduced = false;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  motionState.reduced = false;
});

/** Longer than the default 1100ms reveal, so an un-held reveal has settled. */
const PAST_REVEAL_MS = 1500;

function renderBarChart(props: Partial<Parameters<typeof BarChart>[0]> = {}) {
  const phases: ChartPhase[] = [];
  const utils = render(
    <BarChart data={data} onPhaseChange={(phase) => phases.push(phase)} xDataKey="month" {...props}>
      <Bar dataKey="value" fill="var(--chart-1)" />
    </BarChart>,
  );
  const lastPhase = () => phases.at(-1);
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  return { ...utils, advance, lastPhase, phases };
}

describe("BarChart revealOn / replayOnClick (#175)", () => {
  it('default ("mount") never constructs an IntersectionObserver and settles on its own', () => {
    const { advance, lastPhase } = renderBarChart();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("ready");
  });

  it('<BarChart revealOn="inView" /> holds its reveal until scrolled into view — the hold does not lapse on a timer', () => {
    const { advance, container, lastPhase } = renderBarChart({ revealOn: "inView" });

    // The chart's own container is what gets observed.
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(FakeIntersectionObserver.instances[0]?.observedTargets[0]).toBe(container.firstChild);

    // Held well past the reveal duration: still not settled, no bar grown.
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("revealing");
    const barHeights = () =>
      Array.from(container.querySelectorAll('g[class^="bar-series-"] rect[fill]')).map((rect) =>
        Number.parseFloat(rect.getAttribute("height") ?? "NaN"),
      );
    expect(barHeights().length).toBe(data.length);
    expect(barHeights().every((height) => height === 0)).toBe(true);

    // Scrolling the chart's container into view releases the hold and plays.
    act(() => {
      FakeIntersectionObserver.instances[0]?.fireIntersecting();
    });
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("ready");
    expect(barHeights().every((height) => height > 0)).toBe(true);
  });

  it("replayOnClick replays the enter reveal after it has settled", () => {
    const { advance, container, lastPhase } = renderBarChart({ replayOnClick: true });
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("ready");

    fireEvent.click(container.firstChild as HTMLElement);
    expect(lastPhase()).toBe("revealing");

    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("ready");
  });

  it("a replay releases an in-view hold, like a scroll does", () => {
    const { advance, container, lastPhase } = renderBarChart({
      replayOnClick: true,
      revealOn: "inView",
    });
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("revealing");

    fireEvent.click(container.firstChild as HTMLElement);
    advance(PAST_REVEAL_MS);
    expect(lastPhase()).toBe("ready");
  });

  describe("reduced motion", () => {
    it('never holds — a below-the-fold chart still shows its bars without scrolling (revealOn="inView")', () => {
      motionState.reduced = true;
      const { advance, lastPhase } = renderBarChart({ revealOn: "inView" });
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");
    });

    it("a click does not replay the grow (no motion put back on screen)", () => {
      motionState.reduced = true;
      const { advance, container, lastPhase } = renderBarChart({ replayOnClick: true });
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");

      fireEvent.click(container.firstChild as HTMLElement);
      expect(lastPhase()).toBe("ready");
    });
  });
});
