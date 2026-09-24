/**
 * Pinch-to-zoom — the gesture primitive (`usePinchGesture`), the window
 * maths (`pinchWindow`) and the default-on zoom of the time-series shell and
 * the category families.
 *
 * jsdom has no touch screen and drops `touch-action` from inline styles, so
 * gestures are driven with synthetic pointer / wheel events and the shell is
 * exercised through its keyboard and button paths, which share the window.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => true,
}));

// jsdom lacks ResizeObserver-backed measurement: a fixed 560×288 plot box.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
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

import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { pinchWindow } from "../navigator/navigator-window";
import { XAxis } from "../x-axis";
import { type PinchFrame, usePinchGesture, WHEEL_PINCH_RATE } from "./use-pinch-gesture";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

// jsdom has no PointerEvent: a MouseEvent subclass carrying pointerId / pointerType.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

function touch(el: Element, type: string, pointerId: number, clientX: number, clientY = 0) {
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId, pointerType: "touch" }),
  );
}

// ── pinchWindow ──────────────────────────────────────────────────────────────

describe("pinchWindow", () => {
  const range: [number, number] = [0, 100];
  const extent: [number, number] = [0, 1000];
  const start = { start: 0, end: 1000 };

  it("keeps the data under the fingers' midpoint fixed while spreading", () => {
    // Midpoint at 25% of the plot = 250 in data; a 2× spread halves the span.
    const next = pinchWindow(start, 2, 25, 25, range, extent);
    expect(next.end - next.start).toBe(500);
    expect(next.start + 0.25 * (next.end - next.start)).toBe(250);
  });

  it("pans with the midpoint when the fingers move together", () => {
    const zoomed = { start: 400, end: 600 };
    // Midpoint drags 50 px right over a 200-unit window: the window moves 100 left.
    expect(pinchWindow(zoomed, 1, 25, 75, range, extent)).toEqual({ start: 300, end: 500 });
  });

  it("clamps to the extent and to minSpan", () => {
    expect(pinchWindow(start, 0.5, 50, 50, range, extent)).toEqual({ start: 0, end: 1000 });
    const tight = pinchWindow(start, 1000, 50, 50, range, extent, 100);
    expect(tight.end - tight.start).toBe(100);
  });

  it("ignores a degenerate range or a non-finite scale", () => {
    expect(pinchWindow(start, 2, 0, 0, [10, 10], extent)).toEqual(start);
    expect(pinchWindow(start, Number.NaN, 50, 50, range, extent)).toEqual(start);
  });
});

// ── usePinchGesture ─────────────────────────────────────────────────────────

function Target({
  onPinch,
  enabled = true,
}: {
  onPinch: (f: PinchFrame) => void;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePinchGesture(ref, { enabled, onPinch, wheelCommitDelay: 50 });
  return <div data-testid="target" ref={ref} />;
}

describe("usePinchGesture", () => {
  it("two touch pointers emit start → move → end with the spread ratio", async () => {
    const frames: PinchFrame[] = [];
    render(<Target onPinch={(f) => frames.push({ ...f })} />);
    const el = screen.getByTestId("target");
    touch(el, "pointerdown", 1, 100);
    expect(frames).toHaveLength(0);
    touch(el, "pointerdown", 2, 200);
    expect(frames.map((f) => f.phase)).toEqual(["start"]);
    expect(frames[0]!.origin).toEqual({ x: 150, y: 0 });
    touch(el, "pointermove", 2, 300);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    const move = frames.find((f) => f.phase === "move")!;
    expect(move.scale).toBe(2);
    expect(move.center).toEqual({ x: 200, y: 0 });
    touch(el, "pointerup", 1, 100);
    expect(frames.at(-1)).toMatchObject({ phase: "end", scale: 2, source: "touch" });
  });

  it("one finger, a mouse, or a plain wheel never pinch", () => {
    const onPinch = vi.fn();
    render(<Target onPinch={onPinch} />);
    const el = screen.getByTestId("target");
    touch(el, "pointerdown", 1, 100);
    touch(el, "pointermove", 1, 150);
    el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, pointerType: "mouse" }));
    fireEvent.wheel(el, { deltaY: 40 });
    expect(onPinch).not.toHaveBeenCalled();
  });

  it("ctrl + wheel (a trackpad pinch) zooms and commits after the wheel goes quiet", () => {
    vi.useFakeTimers();
    const frames: PinchFrame[] = [];
    render(<Target onPinch={(f) => frames.push({ ...f })} />);
    const el = screen.getByTestId("target");
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      ctrlKey: true,
      deltaY: -20,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(frames[0]).toMatchObject({ phase: "start", source: "trackpad" });
    act(() => {
      vi.advanceTimersByTime(60);
    });
    const end = frames.at(-1)!;
    expect(end.phase).toBe("end");
    expect(end.scale).toBeCloseTo(Math.exp(20 * WHEEL_PINCH_RATE));
  });

  it("binds nothing while disabled", () => {
    const onPinch = vi.fn();
    render(<Target enabled={false} onPinch={onPinch} />);
    const el = screen.getByTestId("target");
    touch(el, "pointerdown", 1, 100);
    touch(el, "pointerdown", 2, 200);
    expect(onPinch).not.toHaveBeenCalled();
  });
});

// ── The time-series shell ───────────────────────────────────────────────────

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);
const rows = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(T0 + i * DAY),
  users: 100 + ((i * 37) % 50),
}));

function lineChart(extra: Record<string, unknown> = {}) {
  return (
    <LineChart accessibleLabel="Users" animationDuration={0} data={rows} {...extra}>
      <Line dataKey="users" />
      <XAxis />
    </LineChart>
  );
}

describe("time-series zoom (default on)", () => {
  it("renders no zoom chrome at rest", () => {
    const { container } = render(lineChart());
    expect(container.querySelector('[data-slot="chart-zoom-controls"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("+ zooms from the focused chart, the buttons appear, and 0 resets", () => {
    const onWindowChange = vi.fn();
    render(lineChart({ onWindowChange }));
    const root = screen.getByRole("figure", { name: "Users" });
    fireEvent.keyDown(root, { key: "+" });
    const zoomed = onWindowChange.mock.calls.at(-1)!;
    expect(zoomed[1]).toEqual({ phase: "commit", source: "keyboard" });
    const w = zoomed[0] as { kind: string; start: Date; end: Date };
    expect(w.kind).toBe("time");
    expect(w.end.getTime() - w.start.getTime()).toBeCloseTo((59 * DAY) / 1.5, -3);
    expect(screen.getByRole("group", { name: "Chart zoom" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Showing .+ to .+/);

    fireEvent.keyDown(root, { key: "0" });
    expect(onWindowChange).toHaveBeenLastCalledWith(null, { phase: "commit", source: "keyboard" });
    expect(screen.queryByRole("group", { name: "Chart zoom" })).toBeNull();
  });

  it("the zoom buttons step and reset, handing focus back to the chart", () => {
    const onWindowChange = vi.fn();
    render(lineChart({ onWindowChange }));
    const root = screen.getByRole("figure", { name: "Users" });
    fireEvent.keyDown(root, { key: "=" });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const inner = onWindowChange.mock.calls.at(-1)![0] as { start: Date; end: Date };
    expect(inner.end.getTime() - inner.start.getTime()).toBeCloseTo((59 * DAY) / 2.25, -3);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(onWindowChange).toHaveBeenLastCalledWith(null, { phase: "commit", source: "pointer" });
    expect(root).toHaveFocus();
  });

  it("a two-finger pinch on the plot narrows the window", () => {
    const onWindowChange = vi.fn();
    render(lineChart({ onWindowChange }));
    const root = screen.getByRole("figure", { name: "Users" });
    // jsdom lays nothing out: give the plot root its 560 px box.
    root.getBoundingClientRect = () => new DOMRect(0, 0, 560, 288);
    touch(root, "pointerdown", 1, 200);
    touch(root, "pointerdown", 2, 300);
    touch(root, "pointermove", 2, 400);
    act(() => touch(root, "pointerup", 2, 400));
    const [w, meta] = onWindowChange.mock.calls.at(-1)!;
    expect(meta).toEqual({ phase: "commit", source: "touch" });
    expect(w.end.getTime() - w.start.getTime()).toBeLessThan(59 * DAY * 0.6);
  });

  it("zoom={false} or a caller-driven xDomain leave the keys alone", () => {
    for (const extra of [
      { zoom: false },
      { xDomain: [new Date(T0), new Date(T0 + 10 * DAY)] as [Date, Date] },
    ]) {
      const onWindowChange = vi.fn();
      render(lineChart({ ...extra, onWindowChange }));
      fireEvent.keyDown(screen.getByRole("figure", { name: "Users" }), { key: "+" });
      expect(onWindowChange).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("leaves Ctrl / ⌘ + keys to the browser’s own zoom", () => {
    const onWindowChange = vi.fn();
    render(lineChart({ onWindowChange }));
    const root = screen.getByRole("figure", { name: "Users" });
    fireEvent.keyDown(root, { key: "+", ctrlKey: true });
    fireEvent.keyDown(root, { key: "=", metaKey: true });
    expect(onWindowChange).not.toHaveBeenCalled();
  });
});

// ── Category families ───────────────────────────────────────────────────────

const categories = Array.from({ length: 12 }, (_, i) => ({ name: `C${i + 1}`, value: 10 + i }));

describe("category zoom (default on)", () => {
  it("a vertical BarChart zooms by index and slices the bars", () => {
    const onWindowChange = vi.fn();
    const { container } = render(
      <BarChart
        accessibleLabel="Values"
        animationDuration={0}
        data={categories}
        onWindowChange={onWindowChange}
        xDataKey="name"
      >
        <Bar dataKey="value" />
      </BarChart>,
    );
    expect(container.querySelector('[data-slot="chart-zoom-controls"]')).toBeNull();
    fireEvent.keyDown(screen.getByRole("figure", { name: "Values" }), { key: "+" });
    const [w, meta] = onWindowChange.mock.calls.at(-1)!;
    expect(meta).toEqual({ phase: "commit", source: "keyboard" });
    expect(w).toEqual({ kind: "index", start: 2, end: 10 });
    expect(screen.getByRole("status")).toHaveTextContent("Showing C3 to C10");
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(onWindowChange).toHaveBeenLastCalledWith(null, { phase: "commit", source: "pointer" });
  });
});
