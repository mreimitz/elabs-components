"use client";

/**
 * gestures/use-window-zoom.ts — pinch, trackpad and keyboard zoom of a 1-D
 * navigator window (ADR 0040 §2's `NumericWindow`).
 *
 * The window is the one the navigator strip moves, so a chart zooms through
 * the same `xDomain` seam whether or not a strip is mounted. The hook owns no
 * state: it reads the window on screen and hands every proposed window to
 * `onChange` — `phase: "move"` while fingers are down, `"commit"` when they
 * lift (and for every discrete step).
 *
 * Keyboard: with the chart root itself focused, `+` / `=` zoom in, `-` zooms
 * out and `0` resets — the non-gesture path WCAG 2.5.1 asks for, alongside
 * the buttons `ChartZoomControls` shows once zoomed.
 *
 * While enabled the container claims two-finger gestures
 * (`CHART_ZOOM_TOUCH_ACTION`); the page keeps its vertical scroll.
 */

import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  type NumericExtent,
  type NumericWindow,
  pinchWindow,
  zoomWindow,
} from "../navigator/navigator-window";
import type { NavigatorChangeMeta } from "../navigator/types";
import { CHART_ZOOM_TOUCH_ACTION } from "./touch-action";
import { type PinchFrame, usePinchGesture } from "./use-pinch-gesture";

/** One button press or key zooms by this factor, around the window's centre. */
export const CHART_ZOOM_STEP = 1.5;

export interface UseWindowZoomOptions {
  enabled: boolean;
  /** The plot box root: pinches landing anywhere on it zoom; it takes the keys. */
  containerRef: RefObject<HTMLElement | null>;
  /** The plot margin — the window maps onto the root's inner horizontal range. */
  margin: { left: number; right: number };
  extent: NumericExtent;
  minSpan: number;
  /** The window on screen now: the full extent while not zoomed. */
  window: NumericWindow;
  onChange: (next: NumericWindow, meta: NavigatorChangeMeta) => void;
}

export interface UseWindowZoomResult {
  /** Scale the span by `factor` (< 1 zooms in) around the window's centre, as one commit. */
  zoomBy: (factor: number, source?: NavigatorChangeMeta["source"]) => void;
  /** Back to the full extent, as one commit. */
  reset: (source?: NavigatorChangeMeta["source"]) => void;
}

export function useWindowZoom({
  enabled,
  containerRef,
  margin,
  extent,
  minSpan,
  window,
  onChange,
}: UseWindowZoomOptions): UseWindowZoomResult {
  const live = useRef({ margin, extent, minSpan, window, onChange });
  live.current = { margin, extent, minSpan, window, onChange };

  const gesture = useRef<{ start: NumericWindow; range: [number, number] } | null>(null);

  const onPinch = useCallback(
    (frame: PinchFrame) => {
      const { margin: m, extent: e, minSpan: min, window: w, onChange: change } = live.current;
      if (frame.phase === "start") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        gesture.current = {
          start: w,
          range: [rect.left + m.left, rect.left + rect.width - m.right],
        };
        return;
      }
      const g = gesture.current;
      if (!g) return;
      const next = pinchWindow(
        g.start,
        frame.scale,
        frame.origin.x,
        frame.center.x,
        g.range,
        e,
        min,
      );
      if (frame.phase === "end") gesture.current = null;
      change(next, {
        phase: frame.phase === "end" ? "commit" : "move",
        source: frame.source === "touch" ? "touch" : "wheel",
      });
    },
    [containerRef],
  );

  usePinchGesture(containerRef, { enabled, onPinch });

  // A passive effect, not a layout one: a host's `containerRef` attaches in
  // the root's own commit, AFTER a descendant's layout effects on first mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return undefined;
    const previous = el.style.touchAction;
    el.style.touchAction = CHART_ZOOM_TOUCH_ACTION;
    return () => {
      el.style.touchAction = previous;
    };
  }, [containerRef, enabled]);

  const zoomBy = useCallback(
    (factor: number, source: NavigatorChangeMeta["source"] = "pointer") => {
      const { extent: e, minSpan: min, window: w, onChange: change } = live.current;
      change(zoomWindow(w, factor, e, min), { phase: "commit", source });
    },
    [],
  );

  const reset = useCallback((source: NavigatorChangeMeta["source"] = "pointer") => {
    const { extent: e, onChange: change } = live.current;
    change({ start: e[0], end: e[1] }, { phase: "commit", source });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== el || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "+" || event.key === "=") zoomBy(1 / CHART_ZOOM_STEP, "keyboard");
      else if (event.key === "-" || event.key === "_") zoomBy(CHART_ZOOM_STEP, "keyboard");
      else if (event.key === "0") reset("keyboard");
      else return;
      event.preventDefault();
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [containerRef, enabled, reset, zoomBy]);

  return { zoomBy, reset };
}
