/**
 * One measurement path, one resize debounce (RM-189, review F12).
 *
 * Measurement ran three ways — visx `ParentSize` (leading + trailing, 10 ms, or
 * 100 ms on Area, Bar and Radar), `useLayoutMeasure` (trailing 10 ms, or none)
 * and raw `ResizeObserver`s (none). Those families now measure through
 * `useLayoutMeasure` (`layout-size.ts`), directly or through `ChartParentSize`,
 * whose `ChartResizeObserver` answers the FIRST callback of a burst at once and
 * folds the rest into one trailing update `CHART_RESIZE_DEBOUNCE_MS` later.
 *
 * This file pins that timing, and the box itself: the size a chart draws at is
 * the element's layout box — at mount and after a resize — for the wrapper and
 * for two families that measure on their own node (Network, Funnel).
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartParentSize } from "./chart-parent-size";
import { FunnelChart } from "./funnel-chart";
import { CHART_RESIZE_DEBOUNCE_MS, ChartResizeObserver } from "./layout-size";
import { NetworkChart } from "./network/network-chart";

// ── The layout box every element reports (jsdom lays nothing out) ───────────
const box = { width: 600, height: 300 };

// ── A ResizeObserver the test fires by hand ─────────────────────────────────
class ManualResizeObserver {
  static live = new Set<ManualResizeObserver>();
  readonly targets = new Set<Element>();
  constructor(readonly callback: ResizeObserverCallback) {
    ManualResizeObserver.live.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    ManualResizeObserver.live.delete(this);
  }
}

/** One ResizeObserver tick: every live observer hears about its targets. */
function tick() {
  act(() => {
    for (const observer of [...ManualResizeObserver.live]) {
      if (observer.targets.size === 0) continue;
      const entries = [...observer.targets].map((target) => ({
        target,
        contentRect: new DOMRect(0, 0, box.width, box.height),
      })) as unknown as ResizeObserverEntry[];
      observer.callback(entries, observer as unknown as ResizeObserver);
    }
  });
}

// ── jsdom lays nothing out ────────────────────────────────────────────────
const realGetComputedStyle = window.getComputedStyle.bind(window);
const realResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  box.width = 600;
  box.height = 300;
  ManualResizeObserver.live.clear();
  globalThis.ResizeObserver = ManualResizeObserver as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => box.width);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => box.height);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, box.width, box.height),
  );
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = realGetComputedStyle(el, pseudo);
    return new Proxy(style, {
      get(target, prop) {
        if (el instanceof HTMLElement) {
          if (prop === "width") return `${box.width}px`;
          if (prop === "height") return `${box.height}px`;
          if (prop === "boxSizing") return "border-box";
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.ResizeObserver = realResizeObserver;
});

function resizeTo(width: number, height: number) {
  box.width = width;
  box.height = height;
  tick();
}

describe("CHART_RESIZE_DEBOUNCE_MS (RM-189)", () => {
  it("is 100 ms — the pause Area, Bar and Radar gave ParentSize (debounceTime={100})", () => {
    expect(CHART_RESIZE_DEBOUNCE_MS).toBe(100);
  });
});

describe("ChartResizeObserver: leading + trailing", () => {
  it("answers the first callback of a burst at once, and folds the rest into one trailing call", () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const observer = new ChartResizeObserver(() => calls.push(Date.now()));
    observer.observe(document.body);

    tick(); // first callback of the burst → immediate
    expect(calls).toHaveLength(1);
    tick();
    tick();
    tick();
    expect(calls).toHaveLength(1); // the rest wait
    vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2); // ONE trailing call for the three
    vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS * 3);
    expect(calls).toHaveLength(2);
    observer.disconnect();
  });

  it("never calls twice for a single observation, and leads again after a quiet spell", () => {
    vi.useFakeTimers();
    let calls = 0;
    const observer = new ChartResizeObserver(() => calls++);
    observer.observe(document.body);
    tick();
    vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS * 2);
    expect(calls).toBe(1);
    tick();
    expect(calls).toBe(2);
    observer.disconnect();
  });
});

describe("ChartParentSize hands its children the layout box (RM-189)", () => {
  function renderWrapper() {
    const seen: { width: number; height: number }[] = [];
    const view = render(
      <ChartParentSize>
        {(size) => {
          seen.push(size);
          return <svg data-testid="plot" height={size.height} width={size.width} />;
        }}
      </ChartParentSize>,
    );
    const svg = () => view.getByTestId("plot");
    return { seen, svg };
  }

  it("600 × 300 at mount", () => {
    const { seen, svg } = renderWrapper();
    expect(seen.at(-1)).toEqual({ width: 600, height: 300 });
    expect(svg().getAttribute("width")).toBe("600");
    expect(svg().getAttribute("height")).toBe("300");
  });

  it("the new box on the first resize callback, with no wait", () => {
    vi.useFakeTimers();
    const { seen, svg } = renderWrapper();
    resizeTo(380, 200);
    expect(seen.at(-1)).toEqual({ width: 380, height: 200 });
    expect(svg().getAttribute("width")).toBe("380");
    expect(svg().getAttribute("height")).toBe("200");
  });

  it("the rest of a burst lands once, CHART_RESIZE_DEBOUNCE_MS after its last callback", () => {
    vi.useFakeTimers();
    const { seen, svg } = renderWrapper();
    resizeTo(500, 250); // leads
    resizeTo(450, 240);
    resizeTo(380, 200);
    expect(svg().getAttribute("width")).toBe("500");
    const rendersBefore = seen.length;
    act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS));
    expect(svg().getAttribute("width")).toBe("380");
    expect(svg().getAttribute("height")).toBe("200");
    // Only the final size is drawn — 450 × 240 never renders.
    expect(seen.slice(rendersBefore).map((s) => s.width)).not.toContain(450);
  });
});

describe("families that measure their own node draw at its layout box (RM-189)", () => {
  const viewBoxOf = (el: Element | null) => el?.getAttribute("viewBox")?.split(" ").map(Number);

  it("NetworkChart's viewBox is the measured box, at mount and after a resize", () => {
    const { container } = render(
      <NetworkChart
        layout="circular"
        links={[
          { source: "a", target: "b" },
          { source: "b", target: "c" },
        ]}
        nodes={[
          { id: "a", label: "Alpha", value: 3 },
          { id: "b", label: "Beta", value: 2 },
          { id: "c", label: "Gamma", value: 1 },
        ]}
      />,
    );
    const svg = () => container.querySelector("svg[viewBox]");
    expect(viewBoxOf(svg())).toEqual([0, 0, 600, 300]);
    resizeTo(380, 200);
    expect(viewBoxOf(svg())).toEqual([0, 0, 380, 200]);
  });

  const stages = [
    { label: "Visit", value: 1000 },
    { label: "Sign up", value: 600 },
    { label: "Buy", value: 200 },
  ];

  it("FunnelChart (vertical) spans the measured width, at mount and after a resize", () => {
    const { container } = render(<FunnelChart data={stages} orientation="vertical" />);
    const widths = () =>
      [...container.querySelectorAll("svg[viewBox]")].map((svg) => viewBoxOf(svg)?.[2]);
    expect(widths().length).toBeGreaterThan(0);
    expect(new Set(widths())).toEqual(new Set([600]));
    resizeTo(380, 200);
    expect(new Set(widths())).toEqual(new Set([380]));
  });

  it("FunnelChart (horizontal) spans the measured height, at mount and after a resize", () => {
    const { container } = render(<FunnelChart data={stages} orientation="horizontal" />);
    const heights = () =>
      [...container.querySelectorAll("svg[viewBox]")].map((svg) => viewBoxOf(svg)?.[3]);
    expect(heights().length).toBeGreaterThan(0);
    expect(new Set(heights())).toEqual(new Set([300]));
    resizeTo(380, 200);
    expect(new Set(heights())).toEqual(new Set([200]));
  });
});
