"use client";

/**
 * gestures/use-pinch-gesture.ts — one pinch primitive for every chart that
 * zooms itself.
 *
 * Three inputs, one frame shape:
 *
 * - **Touch** — two touch pointers (Pointer Events, so the same code serves
 *   Android, iOS 13+ and touch screens on desktop). `scale` is the finger
 *   distance over the starting distance; `center` follows the midpoint, so a
 *   two-finger drag pans while it zooms.
 * - **Trackpad, Chromium / Firefox** — a trackpad pinch arrives as `wheel`
 *   with `ctrlKey` set (so does Ctrl + mouse wheel). A non-passive listener
 *   takes it; React's `onWheel` is passive and could not stop the browser's
 *   page zoom. The gesture ends after `wheelCommitDelay` ms of silence.
 * - **Trackpad, Safari** — `gesturestart` / `gesturechange` / `gestureend`
 *   with their own `scale`. Ignored while touch pointers are down: on iOS the
 *   same events shadow a touch pinch the pointer path already handles.
 *
 * `start` and `end` fire synchronously; `move` frames are coalesced to one per
 * animation frame (the latest wins). A one-finger touch, a plain wheel and
 * every mouse button are left alone — they stay the tooltip's, the page's
 * scroll and the selection layer's.
 */

import { type RefObject, useEffect, useRef } from "react";

export interface PinchPoint {
  x: number;
  y: number;
}

export interface PinchFrame {
  phase: "start" | "move" | "end";
  /** Current spread over the starting spread: > 1 = fingers apart (zoom in). */
  scale: number;
  /** The midpoint when the gesture started, in client px. */
  origin: PinchPoint;
  /** The midpoint now, in client px. */
  center: PinchPoint;
  source: "touch" | "trackpad";
}

export interface UsePinchGestureOptions {
  /** Bind the listeners. Default `true`. */
  enabled?: boolean;
  onPinch: (frame: PinchFrame) => void;
  /** Milliseconds of wheel silence that end a trackpad pinch. Default 200. */
  wheelCommitDelay?: number;
}

/** `exp(-deltaY × rate)` per ctrl-wheel event; a mouse notch (±100) is clamped first. */
export const WHEEL_PINCH_RATE = 0.01;
const WHEEL_DELTA_CAP = 50;
/** Two fingers closer than this at the start measure from this distance instead. */
const MIN_START_DISTANCE = 16;

/** Safari's non-standard `GestureEvent`. */
interface SafariGestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

interface Active {
  source: PinchFrame["source"];
  origin: PinchPoint;
  center: PinchPoint;
  scale: number;
  /** Touch: the starting finger distance. */
  distance: number;
}

function midpoint(a: PinchPoint, b: PinchPoint): PinchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: PinchPoint, b: PinchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function usePinchGesture(
  target: RefObject<Element | null>,
  { enabled = true, onPinch, wheelCommitDelay = 200 }: UsePinchGestureOptions,
): void {
  const onPinchRef = useRef(onPinch);
  onPinchRef.current = onPinch;

  useEffect(() => {
    const el = target.current as HTMLElement | null;
    if (!enabled || !el) return undefined;

    const pointers = new Map<number, PinchPoint>();
    let active: Active | null = null;
    let frame: number | null = null;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    const emit = (phase: PinchFrame["phase"], a: Active) =>
      onPinchRef.current({
        phase,
        scale: a.scale,
        origin: a.origin,
        center: a.center,
        source: a.source,
      });

    const cancelFrame = () => {
      if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = null;
    };
    const scheduleMove = () => {
      if (typeof requestAnimationFrame !== "function") {
        if (active) emit("move", active);
        return;
      }
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (active) emit("move", active);
      });
    };
    const begin = (next: Active) => {
      active = next;
      emit("start", next);
    };
    const finish = () => {
      const a = active;
      if (!a) return;
      cancelFrame();
      active = null;
      emit("end", a);
    };

    // ── touch ────────────────────────────────────────────────────────────
    const pair = (): [PinchPoint, PinchPoint] | null => {
      if (pointers.size < 2) return null;
      const [a, b] = pointers.values();
      return a && b ? [a, b] : null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (active || pointers.size !== 2) return;
      const p = pair();
      if (!p) return;
      const mid = midpoint(p[0], p[1]);
      begin({
        source: "touch",
        origin: mid,
        center: mid,
        scale: 1,
        distance: Math.max(MIN_START_DISTANCE, distance(p[0], p[1])),
      });
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (active?.source !== "touch") return;
      const p = pair();
      if (!p) return;
      active.center = midpoint(p[0], p[1]);
      active.scale = Math.max(MIN_START_DISTANCE, distance(p[0], p[1])) / active.distance;
      scheduleMove();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      if (active?.source === "touch" && pointers.size < 2) finish();
    };

    // ── trackpad: ctrl + wheel ──────────────────────────────────────────
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || pointers.size > 0) return;
      event.preventDefault();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const delta = Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, event.deltaY * lines));
      const point = { x: event.clientX, y: event.clientY };
      if (active && active.source !== "trackpad") return;
      if (!active)
        begin({ source: "trackpad", origin: point, center: point, scale: 1, distance: 1 });
      const a = active as Active | null;
      if (!a) return;
      a.scale *= Math.exp(-delta * WHEEL_PINCH_RATE);
      a.center = point;
      scheduleMove();
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelTimer = null;
        finish();
      }, wheelCommitDelay);
    };

    // ── trackpad: Safari gesture events ─────────────────────────────────
    const onGestureStart = (event: Event) => {
      if (pointers.size > 0 || active) return;
      event.preventDefault();
      const g = event as SafariGestureEvent;
      const point = { x: g.clientX, y: g.clientY };
      begin({ source: "trackpad", origin: point, center: point, scale: 1, distance: 1 });
    };
    const onGestureChange = (event: Event) => {
      if (pointers.size > 0 || active?.source !== "trackpad") return;
      event.preventDefault();
      const g = event as SafariGestureEvent;
      active.scale = g.scale > 0 ? g.scale : 1;
      active.center = { x: g.clientX, y: g.clientY };
      scheduleMove();
    };
    const onGestureEnd = (event: Event) => {
      if (pointers.size > 0 || active?.source !== "trackpad" || wheelTimer) return;
      event.preventDefault();
      finish();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      cancelFrame();
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [enabled, target, wheelCommitDelay]);
}
