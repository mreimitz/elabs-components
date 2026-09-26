/**
 * One measurement path, one resize debounce (RM-189, review F12).
 *
 * Measurement ran three ways — visx `ParentSize` (leading + trailing, 10 ms, or
 * 100 ms on Area, Bar and Radar), `useLayoutMeasure` (trailing 10 ms, or none)
 * and raw `ResizeObserver`s (none). Those families now measure through
 * `useLayoutMeasure` (`layout-size.ts`), directly or through `ChartParentSize`,
 * whose `ChartResizeObserver` answers the FIRST callback of a burst at once,
 * then at most once per `CHART_RESIZE_DEBOUNCE_MS` with the newest size while
 * the burst lasts — so a chart follows a drag — and never repeats the last one.
 *
 * This file pins that timing, and the box itself: the size a chart draws at is
 * the element's layout box — at mount and after a resize — for the wrapper and
 * for two families that measure on their own node (Network, Funnel).
 */
import { act, cleanup, render } from "@testing-library/react";
import { Activity } from "react";
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

describe("ChartResizeObserver: leading, then at most once per period (max wait)", () => {
  it("answers the first callback of a burst at once, and folds the rest of the period into one call", () => {
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
    expect(calls).toHaveLength(2); // ONE call for the three
    vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS * 3);
    expect(calls).toHaveLength(2);
    observer.disconnect();
  });

  it("follows a 400 ms drag (a callback every 30 ms): at once, then one call per 100 ms, ending on the final size", () => {
    vi.useFakeTimers();
    const start = Date.now();
    const calls: { at: number; width: number }[] = [];
    const observer = new ChartResizeObserver((entries) =>
      calls.push({ at: Date.now() - start, width: entries[0]!.contentRect.width }),
    );
    observer.observe(document.body);

    // Callbacks at 0, 30, …, 390 ms; the box shrinks 15 px per step, 590 → 395.
    for (let step = 0; step < 14; step++) {
      box.width = 590 - 15 * step;
      tick();
      if (step === 0) expect(calls).toEqual([{ at: 0, width: 590 }]); // leading
      vi.advanceTimersByTime(30);
    }
    // Mid-drag: one call per period, each with the newest size of that period.
    expect(calls).toEqual([
      { at: 0, width: 590 },
      { at: 100, width: 545 }, // the 90 ms callback
      { at: 200, width: 500 }, // 180 ms
      { at: 300, width: 455 }, // 270 ms
      { at: 400, width: 395 }, // 390 ms: the final size, within one period of the last callback
    ]);
    const gaps = calls.slice(1).map((call, i) => call.at - calls[i]!.at);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(CHART_RESIZE_DEBOUNCE_MS);

    // After the drag: no duplicate of the final size, however long it stays quiet.
    vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS * 5);
    expect(calls).toHaveLength(5);
    expect(calls.at(-1)!.width).toBe(395);
    observer.disconnect();
  });

  it("a step after the leading call lands at the end of that period, never later than CHART_RESIZE_DEBOUNCE_MS after it", () => {
    vi.useFakeTimers();
    const start = Date.now();
    const calls: { at: number; width: number }[] = [];
    const observer = new ChartResizeObserver((entries) =>
      calls.push({ at: Date.now() - start, width: entries[0]!.contentRect.width }),
    );
    observer.observe(document.body);
    box.width = 500;
    tick(); // leads at 0
    vi.advanceTimersByTime(40);
    box.width = 380;
    tick(); // stops at 40
    vi.advanceTimersByTime(59);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual([
      { at: 0, width: 500 },
      { at: 100, width: 380 },
    ]);
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

  it("draws once at mount: the observer's first callback, at the attach size, renders nothing", () => {
    vi.useFakeTimers();
    const { seen } = renderWrapper();
    const rendersAtMount = seen.length;
    tick(); // the first observation reports the 600 × 300 already drawn
    act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS));
    expect(seen.length).toBe(rendersAtMount);
    resizeTo(380, 200); // a real change still leads at once
    expect(seen.length).toBe(rendersAtMount + 1);
    expect(seen.at(-1)).toEqual({ width: 380, height: 200 });
  });

  it("reads the box once at mount, not again in the mount effect", () => {
    // `layoutSize` reads `offsetWidth` once per measurement.
    const reads = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(() => box.width);
    renderWrapper();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("a window resize alone lands the new box one period later", () => {
    vi.useFakeTimers();
    const { svg } = renderWrapper();
    box.width = 420;
    box.height = 260;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS));
    expect(svg().getAttribute("width")).toBe("420");
    expect(svg().getAttribute("height")).toBe("260");
  });

  it("shown again after a hidden resize, the first frame has the new box", () => {
    const plot = (size: { width: number; height: number }) => (
      <svg data-testid="plot" height={size.height} width={size.width} />
    );
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <ChartParentSize>{plot}</ChartParentSize>
      </Activity>
    );
    const view = render(tree("visible"));
    view.rerender(tree("hidden"));
    box.width = 450; // no observer tick while hidden
    box.height = 220;
    view.rerender(tree("visible"));
    expect(view.getByTestId("plot").getAttribute("width")).toBe("450");
    expect(view.getByTestId("plot").getAttribute("height")).toBe("220");
  });

  it("the new box on the first resize callback, with no wait", () => {
    vi.useFakeTimers();
    const { seen, svg } = renderWrapper();
    resizeTo(380, 200);
    expect(seen.at(-1)).toEqual({ width: 380, height: 200 });
    expect(svg().getAttribute("width")).toBe("380");
    expect(svg().getAttribute("height")).toBe("200");
  });

  it("steps within one period land once, with the newest size, at the period's end", () => {
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

  it("the drawn width follows a drag (20 px every 30 ms, 600 → 380) and ends on the final box", () => {
    vi.useFakeTimers();
    const { seen, svg } = renderWrapper();
    const drawn: number[] = [];
    for (let width = 580; width >= 380; width -= 20) {
      resizeTo(width, 300);
      drawn.push(Number(svg().getAttribute("width")));
      act(() => vi.advanceTimersByTime(30));
    }
    // Mid-drag the chart moves, not only its first step: 580 at once, then newer steps.
    expect(drawn[0]).toBe(580);
    expect(new Set(drawn.slice(0, -1)).size).toBeGreaterThan(2);
    act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS));
    expect(svg().getAttribute("width")).toBe("380");
    const widths = seen.map((s) => s.width);
    expect(widths.at(-1)).toBe(380);
    // No second draw of the final box once the drag is over.
    const settled = seen.length;
    act(() => vi.advanceTimersByTime(CHART_RESIZE_DEBOUNCE_MS * 5));
    expect(seen.length).toBe(settled);
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
