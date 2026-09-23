import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartMarkGeometry } from "./hit-test";
import type { ChartSelectionIntent } from "./types";
import {
  type GesturePointerEvent,
  initialGestureMode,
  LONG_PRESS_MS,
  useChartGesture,
  type UseChartGestureOptions,
} from "./use-chart-gesture";

// Five points on a diagonal, categories "a".."e", at (i*20+10, i*20+10).
const marks: ChartMarkGeometry[] = ["a", "b", "c", "d", "e"].map((category, index) => ({
  id: category,
  category,
  datum: { category },
  index,
  value: index,
  shape: { kind: "point", x: index * 20 + 10, y: index * 20 + 10 },
  visible: true,
}));

function pe(x: number, y: number, extra: Partial<GesturePointerEvent> = {}): GesturePointerEvent {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    currentTarget: null,
    ...extra,
  };
}

function setup(overrides: Partial<UseChartGestureOptions> = {}) {
  const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
  const hook = renderHook((props: Partial<UseChartGestureOptions>) =>
    useChartGesture({
      gestures: ["rect", "lasso", "range"],
      field: "category",
      getMarks: () => marks,
      onSelectionIntent,
      toPlotPoint: (clientX, clientY) => ({ x: clientX, y: clientY }),
      plotSize: { width: 200, height: 200 },
      ...overrides,
      ...props,
    }),
  );
  return { ...hook, onSelectionIntent };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useChartGesture", () => {
  it("starts in the first gesture's mode; a leading range keeps the plot a pointer (RM-143)", () => {
    expect(initialGestureMode(["range", "rect"])).toBe("pointer");
    expect(initialGestureMode(["rect", "range"])).toBe("rect");
    expect(initialGestureMode(["radial"])).toBe("radial");
    expect(initialGestureMode(["lasso"])).toBe("lasso");
    expect(initialGestureMode([])).toBe("pointer");
  });

  it("a mouse rect drag emits one replace intent; overlay + isDragging while in flight", () => {
    const { result, onSelectionIntent } = setup();
    act(() => result.current.handlers.plot.onPointerDown(pe(0, 0)));
    act(() => result.current.handlers.plot.onPointerMove(pe(55, 55)));
    // rAF-throttled: the move lands on the next frame — or on pointerup's flush.
    act(() => result.current.handlers.plot.onPointerUp(pe(55, 55)));
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    const intent = onSelectionIntent.mock.calls[0]?.[0];
    expect(intent?.gesture.kind).toBe("rect");
    expect(intent?.values).toEqual(["a", "b", "c"]);
    expect(intent?.mode).toBe("replace");
    expect(result.current.isDragging).toBe(false);
  });

  it("isDragging and a rect overlay while dragging", () => {
    const { result } = setup({ gestures: ["rect"] });
    act(() => result.current.handlers.plot.onPointerDown(pe(10, 10)));
    act(() => result.current.dispatch({ type: "pointerMove", point: { x: 40, y: 30 } }));
    expect(result.current.isDragging).toBe(true);
    expect(result.current.overlayGeometry).toEqual({ kind: "rect", x: 10, y: 10, w: 30, h: 20 });
  });

  it("Shift+drag → add; Ctrl/Cmd+drag → toggle", () => {
    const { result, onSelectionIntent } = setup();
    act(() => result.current.handlers.plot.onPointerDown(pe(0, 0, { shiftKey: true })));
    act(() => result.current.handlers.plot.onPointerUp(pe(55, 55)));
    expect(onSelectionIntent.mock.calls.at(-1)?.[0].mode).toBe("add");
    act(() => result.current.handlers.plot.onPointerDown(pe(0, 0, { metaKey: true })));
    act(() => result.current.handlers.plot.onPointerUp(pe(55, 55)));
    expect(onSelectionIntent.mock.calls.at(-1)?.[0].mode).toBe("toggle");
  });

  it("a gutter press is an axis range whatever the mode", () => {
    const { result, onSelectionIntent } = setup({ gestures: ["rect", "range"] });
    act(() => result.current.handlers.gutterX.onPointerDown(pe(0, 200)));
    act(() => result.current.handlers.gutterX.onPointerUp(pe(35, 200)));
    const intent = onSelectionIntent.mock.calls[0]?.[0];
    expect(intent?.gesture).toMatchObject({ kind: "range", axis: "x" });
    expect(intent?.values).toEqual(["a", "b"]);
  });

  it("ignores non-primary mouse buttons", () => {
    const { result, onSelectionIntent } = setup();
    act(() => result.current.handlers.plot.onPointerDown(pe(0, 0, { button: 2 })));
    act(() => result.current.handlers.plot.onPointerUp(pe(55, 55)));
    expect(onSelectionIntent).not.toHaveBeenCalled();
  });

  describe("touch", () => {
    const touch = (x: number, y: number, pointerId = 7) =>
      pe(x, y, { pointerType: "touch", pointerId });

    it(`a ${LONG_PRESS_MS} ms long-press arms a lasso`, () => {
      vi.useFakeTimers();
      const { result, onSelectionIntent } = setup({ gestures: ["rect"] });
      act(() => result.current.handlers.plot.onPointerDown(touch(0, 0)));
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      expect(result.current.state.phase).toBe("armed");
      expect(result.current.state.activeMode).toBe("lasso");
      for (const [x, y] of [
        [60, 0],
        [60, 60],
        [0, 60],
      ] as const) {
        act(() => result.current.handlers.plot.onPointerMove(touch(x, y)));
        act(() => {
          vi.advanceTimersByTime(20);
        });
      }
      act(() => result.current.handlers.plot.onPointerUp(touch(2, 3)));
      const intent = onSelectionIntent.mock.calls[0]?.[0];
      expect(intent?.gesture.kind).toBe("lasso");
      // The closed square (0,0)–(60,60) holds a (10,10), b (30,30), c (50,50).
      expect(intent?.values).toEqual(["a", "b", "c"]);
    });

    it("a tap is a click", () => {
      const { result, onSelectionIntent } = setup();
      act(() => result.current.handlers.plot.onPointerDown(touch(51, 50)));
      act(() => result.current.handlers.plot.onPointerUp(touch(51, 50)));
      expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
        values: ["c"],
        gesture: { kind: "click", category: "c" },
      });
    });

    it("a touch that moves before the long press is left to scroll / scrub", () => {
      vi.useFakeTimers();
      const { result, onSelectionIntent } = setup();
      act(() => result.current.handlers.plot.onPointerDown(touch(0, 0)));
      act(() => result.current.handlers.plot.onPointerMove(touch(30, 0)));
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS * 2);
      });
      act(() => result.current.handlers.plot.onPointerUp(touch(30, 0)));
      expect(result.current.state.phase).toBe("idle");
      expect(onSelectionIntent).not.toHaveBeenCalled();
    });

    it("a second finger cancels (two-finger gestures pass through)", () => {
      vi.useFakeTimers();
      const { result, onSelectionIntent } = setup();
      act(() => result.current.handlers.plot.onPointerDown(touch(0, 0, 1)));
      act(() => result.current.handlers.plot.onPointerDown(touch(50, 50, 2)));
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS * 2);
      });
      expect(result.current.state.phase).toBe("idle");
      expect(onSelectionIntent).not.toHaveBeenCalled();
    });
  });

  describe("explicit confirm", () => {
    it("accumulates a provisional set; commitIntent emits ONE replace intent", () => {
      const { result, onSelectionIntent } = setup({ confirm: "explicit" });
      // plain click on "a" → toggle in
      act(() => result.current.handlers.plot.onPointerDown(pe(10, 10)));
      act(() => result.current.handlers.plot.onPointerUp(pe(10, 10)));
      // Shift+drag over b, c → add
      act(() => result.current.handlers.plot.onPointerDown(pe(25, 25, { shiftKey: true })));
      act(() => result.current.handlers.plot.onPointerUp(pe(55, 55)));
      expect(onSelectionIntent).not.toHaveBeenCalled();
      expect(result.current.provisional?.values).toEqual(["a", "b", "c"]);
      // plain click on "b" again toggles it out
      act(() => result.current.handlers.plot.onPointerDown(pe(30, 30)));
      act(() => result.current.handlers.plot.onPointerUp(pe(30, 30)));
      expect(result.current.provisional?.values).toEqual(["a", "c"]);
      act(() => {
        result.current.commitIntent();
      });
      expect(onSelectionIntent).toHaveBeenCalledTimes(1);
      expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
        mode: "replace",
        values: ["a", "c"],
      });
      expect(result.current.provisional).toBeNull();
    });

    it("cancel drops the provisional set", () => {
      const { result, onSelectionIntent } = setup({ confirm: "explicit" });
      act(() => result.current.handlers.plot.onPointerDown(pe(10, 10)));
      act(() => result.current.handlers.plot.onPointerUp(pe(10, 10)));
      act(() => result.current.cancel());
      expect(result.current.provisional).toBeNull();
      act(() => {
        result.current.commitIntent();
      });
      expect(onSelectionIntent).not.toHaveBeenCalled();
    });
  });

  it("a controlled mode follows its prop", () => {
    const { result, rerender } = setup();
    expect(result.current.state.mode).toBe("rect");
    rerender({ mode: "lasso" });
    expect(result.current.state.mode).toBe("lasso");
  });
});
