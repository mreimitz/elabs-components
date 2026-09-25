/**
 * Where the pointer is and what drives it (mouse, finger, keyboard focus) —
 * one document-level record shared by every chart tooltip box.
 *
 * Why document-level, installed for a chart's whole life: the hover that
 * OPENS a tooltip has already happened by the time its box mounts, so a
 * listener attached by the box itself would always start one event late.
 *
 * Why touch events rather than pointer events for touch: once the browser
 * takes a vertical drag over as a page scroll it fires `pointercancel`, yet
 * `touchmove` keeps arriving and keeps moving the chart's own tooltip
 * (`use-chart-interaction.ts`). Reading the same stream keeps both in step.
 *
 * Nothing here renders: subscribers are told a new position exists and read
 * it when they next place (at most once per animation frame).
 */

import type { ChartTooltipPointerKind } from "./place-tooltip";

export interface TrackedPointer {
  clientX: number;
  clientY: number;
  kind: ChartTooltipPointerKind;
  /** Touch only: whether the finger is still on the screen. */
  down: boolean;
  target: EventTarget | null;
}

/**
 * Browsers fire compatibility mouse events after a tap. Mouse moves this soon
 * after a touch are those, not a real mouse, and must not turn a touch
 * placement into a mouse one.
 */
const COMPAT_MOUSE_WINDOW_MS = 1000;

const keyboardReplays = new WeakSet<Event>();

/**
 * Marks a synthetic pointer event the datapoint layer replays at a
 * keyboard-focused target (`chart-datapoint-layer.tsx`, the focus → hover
 * bridge), so the tooltip keeps clear of the focused target — not of a
 * pretend mouse at its centre.
 */
export function markKeyboardReplay<E extends Event>(event: E): E {
  keyboardReplays.add(event);
  return event;
}

let current: TrackedPointer | null = null;
let lastTouchAt = Number.NEGATIVE_INFINITY;
let retainCount = 0;
const listeners = new Set<() => void>();

function record(next: TrackedPointer) {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

function handleMouseLike(event: Event) {
  const mouse = event as MouseEvent;
  if (keyboardReplays.has(event)) {
    record({
      clientX: mouse.clientX,
      clientY: mouse.clientY,
      kind: "keyboard",
      down: false,
      target: event.target,
    });
    return;
  }
  if ((event as PointerEvent).pointerType === "touch") {
    return;
  }
  if (event.type.startsWith("mouse") && event.timeStamp - lastTouchAt < COMPAT_MOUSE_WINDOW_MS) {
    return;
  }
  record({
    clientX: mouse.clientX,
    clientY: mouse.clientY,
    kind: "mouse",
    down: false,
    target: event.target,
  });
}

function handleTouch(event: Event) {
  const touchEvent = event as TouchEvent;
  lastTouchAt = event.timeStamp;
  if (event.type === "touchend" || event.type === "touchcancel") {
    if (current?.kind === "touch") {
      record({ ...current, down: touchEvent.touches.length > 0 });
    }
    return;
  }
  const touch = touchEvent.touches[0];
  if (!touch) {
    return;
  }
  record({
    clientX: touch.clientX,
    clientY: touch.clientY,
    kind: "touch",
    down: true,
    target: event.target,
  });
}

const MOUSE_EVENTS = ["pointermove", "pointerdown", "mousemove"] as const;
const TOUCH_EVENTS = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;
const LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/**
 * Starts tracking (reference-counted) and returns the release. Installed on
 * first use, never at import time — the package has no side effects.
 */
export function retainPointerTracker(): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }
  if (retainCount === 0) {
    for (const type of MOUSE_EVENTS) {
      document.addEventListener(type, handleMouseLike, LISTENER_OPTIONS);
    }
    for (const type of TOUCH_EVENTS) {
      document.addEventListener(type, handleTouch, LISTENER_OPTIONS);
    }
  }
  retainCount += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    retainCount -= 1;
    if (retainCount === 0) {
      for (const type of MOUSE_EVENTS) {
        document.removeEventListener(type, handleMouseLike, LISTENER_OPTIONS);
      }
      for (const type of TOUCH_EVENTS) {
        document.removeEventListener(type, handleTouch, LISTENER_OPTIONS);
      }
      current = null;
      lastTouchAt = Number.NEGATIVE_INFINITY;
    }
  };
}

/** Calls `listener` after every recorded move; returns the unsubscribe. */
export function subscribePointer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The last recorded pointer, or `null` before the first one. */
export function readPointer(): TrackedPointer | null {
  return current;
}
