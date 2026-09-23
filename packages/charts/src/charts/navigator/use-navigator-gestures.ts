"use client";

/**
 * use-navigator-gestures.ts — pointer and wheel gestures for `ChartNavigator`
 * (RM-140). One pointer path serves mouse, pen and touch:
 *
 * - drag the window → pan; drag a handle → move that edge;
 * - press outside the window → centre the window there (the canvas chart library' "click to
 *   locate"), then keep dragging it;
 * - wheel over the strip → pan (the dominant of `deltaX` / `deltaY`).
 *
 * `phase: "move"` updates are throttled to one per animation frame; releasing
 * the pointer (or the wheel going idle) emits one `phase: "commit"`.
 */

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { NavigatorChangeMeta } from "./types";
import {
  centreWindowOn,
  moveWindowEdge,
  type NumericExtent,
  type NumericWindow,
  pixelToValue,
  type PixelRange,
  sameNumericWindow,
  shiftWindow,
} from "./navigator-window";

export type NavigatorDragMode = "window" | "start" | "end";

export interface UseNavigatorGesturesOptions {
  /** The full extent on the value axis. */
  extent: NumericExtent;
  /** The main-axis pixel range the extent maps onto, in the surface's own coordinates. */
  range: PixelRange;
  /** The current window. */
  window: NumericWindow;
  minSpan: number;
  orientation: "horizontal" | "vertical";
  /** Receives every change; the caller clamps / rounds and stores it. */
  onChange: (window: NumericWindow, meta: NavigatorChangeMeta) => void;
  /** Milliseconds of wheel silence before the wheel pan commits. Default 200. */
  wheelCommitDelay?: number;
}

interface DragState {
  pointerId: number;
  mode: NavigatorDragMode;
  originValue: number;
  startWindow: NumericWindow;
  latest: NumericWindow;
  changed: boolean;
  source: NavigatorChangeMeta["source"];
}

const requestFrame = (cb: () => void): number =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 16) as unknown as number);

const cancelFrame = (id: number) => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else clearTimeout(id);
};

/** Pan fraction of the window span per 100 px of wheel delta. */
const WHEEL_PAN_PER_100PX = 0.1;

export function useNavigatorGestures({
  extent,
  range,
  window,
  minSpan,
  orientation,
  onChange,
  wheelCommitDelay = 200,
}: UseNavigatorGesturesOptions) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ window: NumericWindow; meta: NavigatorChangeMeta } | null>(null);
  const [dragging, setDragging] = useState<NavigatorDragMode | null>(null);

  // Latest inputs for the stable handlers below.
  const live = useRef({ extent, range, window, minSpan, orientation, onChange });
  live.current = { extent, range, window, minSpan, orientation, onChange };

  const flush = useCallback(() => {
    frameRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) live.current.onChange(pending.window, pending.meta);
  }, []);

  const scheduleMove = useCallback(
    (next: NumericWindow, source: NavigatorChangeMeta["source"]) => {
      pendingRef.current = { window: next, meta: { phase: "move", source } };
      if (frameRef.current == null) frameRef.current = requestFrame(flush);
    },
    [flush],
  );

  const commit = useCallback((next: NumericWindow, source: NavigatorChangeMeta["source"]) => {
    if (frameRef.current != null) {
      cancelFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = null;
    live.current.onChange(next, { phase: "commit", source });
  }, []);

  const valueAt = useCallback((event: { clientX: number; clientY: number }) => {
    const el = surfaceRef.current;
    const { extent: e, range: r, orientation: o } = live.current;
    if (!el) return e[0];
    const rect = el.getBoundingClientRect();
    const px = o === "vertical" ? event.clientY - rect.top : event.clientX - rect.left;
    return pixelToValue(px, e, r);
  }, []);

  const begin = useCallback(
    (
      event: ReactPointerEvent<Element>,
      mode: NavigatorDragMode,
      startWindow: NumericWindow,
      changed: boolean,
    ) => {
      const target = event.currentTarget as Element;
      try {
        target.setPointerCapture?.(event.pointerId);
      } catch {
        // A synthetic / already-released pointer cannot be captured — the drag still works.
      }
      dragRef.current = {
        pointerId: event.pointerId,
        mode,
        originValue: valueAt(event),
        startWindow,
        latest: startWindow,
        changed,
        source: event.pointerType === "touch" ? "touch" : "pointer",
      };
      setDragging(mode);
    },
    [valueAt],
  );

  /** Pointer down on the strip body: inside the window drags it, outside re-centres it first. */
  const onTrackPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      const value = valueAt(event);
      const { window: w, extent: e } = live.current;
      if (value >= w.start && value <= w.end) {
        begin(event, "window", w, false);
        return;
      }
      const centred = centreWindowOn(w, value, e);
      begin(event, "window", centred, !sameNumericWindow(centred, w));
      scheduleMove(centred, event.pointerType === "touch" ? "touch" : "pointer");
    },
    [begin, scheduleMove, valueAt],
  );

  /** Pointer down on a handle: drags that edge only. */
  const onHandlePointerDown = useCallback(
    (edge: "start" | "end", event: ReactPointerEvent<Element>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.stopPropagation();
      begin(event, edge, live.current.window, false);
    },
    [begin],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const { extent: e, minSpan: m } = live.current;
      const delta = valueAt(event) - drag.originValue;
      const next =
        drag.mode === "window"
          ? shiftWindow(drag.startWindow, delta, e)
          : moveWindowEdge(
              drag.startWindow,
              drag.mode,
              (drag.mode === "start" ? drag.startWindow.start : drag.startWindow.end) + delta,
              e,
              m,
            );
      if (sameNumericWindow(next, drag.latest)) return;
      drag.latest = next;
      drag.changed = true;
      scheduleMove(next, drag.source);
    },
    [scheduleMove, valueAt],
  );

  const end = useCallback(
    (event: ReactPointerEvent<Element>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragging(null);
      try {
        (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
      } catch {
        // Already released.
      }
      if (drag.changed) commit(drag.latest, drag.source);
    },
    [commit],
  );

  // Wheel pans. A native, non-passive listener: React's `onWheel` is passive,
  // so it could not stop the page from scrolling under the strip.
  const wheelRef = useRef<{ window: NumericWindow; timer: ReturnType<typeof setTimeout> | null }>({
    window,
    timer: null,
  });
  useEffect(() => {
    const el = surfaceRef.current;
    const state = wheelRef.current;
    if (!el) return undefined;
    const handleWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      const { window: w, extent: e } = live.current;
      const base = state.timer ? state.window : w;
      const span = base.end - base.start;
      const next = shiftWindow(base, (delta / 100) * WHEEL_PAN_PER_100PX * span, e);
      state.window = next;
      scheduleMove(next, "wheel");
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        commit(state.window, "wheel");
      }, wheelCommitDelay);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    };
  }, [commit, scheduleMove, wheelCommitDelay]);

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelFrame(frameRef.current);
    },
    [],
  );

  return {
    surfaceRef,
    dragging,
    onTrackPointerDown,
    onHandlePointerDown,
    /** Spread on every element that may capture the pointer (the track and each handle). */
    pointerHandlers: {
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
