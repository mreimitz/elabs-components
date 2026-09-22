"use client";

/**
 * use-chart-gesture.ts — binds pointer input to the gesture reducer (RM-142).
 *
 * - Mouse / pen: pointerdown arms (with `setPointerCapture`, so a drag that
 *   leaves the plot keeps tracking), pointermove is rAF-throttled, pointerup
 *   settles the gesture and — in `immediate` confirm — emits ONE
 *   `ChartSelectionIntent` through `onSelectionIntent`.
 * - Touch: a tap is a click; a long press (400 ms, no travel) arms a LASSO
 *   (the associative BI suite's "press and drag" on touch); a touch that moves first is a scroll /
 *   tooltip scrub and is left alone; a second finger cancels (two-finger
 *   gestures belong to the navigator / zoom).
 * - Wheel is never bound — it passes through to zoom / scroll.
 * - `explicit` confirm: settled gestures accumulate a PROVISIONAL set (their
 *   own modes applied in turn); `commitIntent()` emits it as ONE `replace`
 *   intent, `cancel()` drops it.
 *
 * Handlers take a structural pointer event, so they bind as React props or as
 * native listeners alike (`ChartSelectionGestureLayer` binds them natively on
 * the plot `<g>`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createGestureState,
  type GestureEngineMode,
  type GestureEvent,
  type GesturePoint,
  type GestureRegion,
  type GestureState,
  gestureReducer,
  CLICK_SENSITIVITY,
} from "./gesture-machine";
import { type GestureAxis, normalizeRect, snapToClose, simplifyPath } from "./geometry";
import type { ChartMarkGeometry } from "./hit-test";
import { resolveSelectionIntent } from "./resolve-intent";
import type {
  ChartSelectionConfirm,
  ChartSelectionGesture,
  ChartSelectionHitRule,
  ChartSelectionIntent,
  ChartSelectionIntentHandler,
  ChartSelectionValue,
} from "./types";

/** A touch held this long without travel arms the lasso (the associative BI suite), ms. */
export const LONG_PRESS_MS = 400;

/** The subset of a (React or native) pointer event the engine reads. */
export interface GesturePointerEvent {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  currentTarget: EventTarget | null;
  preventDefault?: () => void;
}

export interface GesturePointerHandlers {
  onPointerDown: (event: GesturePointerEvent) => void;
  onPointerMove: (event: GesturePointerEvent) => void;
  onPointerUp: (event: GesturePointerEvent) => void;
  onPointerCancel: (event: GesturePointerEvent) => void;
}

/** The in-progress gesture in PLOT pixels, for `GestureOverlay`. */
export type GestureOverlayGeometry =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "band"; axis: "x" | "y"; from: number; to: number }
  | { kind: "lasso"; path: GesturePoint[]; closed: boolean }
  | { kind: "radial"; cx: number; cy: number; r: number };

export interface UseChartGestureOptions<TDatum = Record<string, unknown>> {
  /** Gestures the container enabled. The first one that draws is the initial mode. */
  gestures: readonly ChartSelectionGesture[];
  /** Fires with every intent (immediate) or on `commitIntent` (explicit). */
  onSelectionIntent?: ChartSelectionIntentHandler<TDatum>;
  confirm?: ChartSelectionConfirm;
  /** The field intents carry (`selectionField ?? xDataKey`). */
  field: string;
  hitRule?: ChartSelectionHitRule;
  xAxis?: GestureAxis;
  yAxis?: GestureAxis;
  /** Reads the registered marks at commit time. */
  getMarks: () => readonly ChartMarkGeometry<TDatum>[];
  seriesLabel?: (seriesKey: string) => string | undefined;
  /** Plot size, px — gesture points are clamped into it. */
  plotSize?: { width: number; height: number };
  /**
   * Client → plot pixels. Default: the inverse screen CTM of `getPlotElement()`
   * (or the event's `currentTarget`), which folds in the plot `<g>`'s margin
   * translate and any CSS scaling.
   */
  toPlotPoint?: (clientX: number, clientY: number, target: Element | null) => GesturePoint | null;
  getPlotElement?: () => Element | null;
  /** Controlled engine mode. */
  mode?: GestureEngineMode;
  /** Disable the whole engine (handlers become no-ops). */
  enabled?: boolean;
}

export interface UseChartGestureResult<TDatum = Record<string, unknown>> {
  state: GestureState;
  isDragging: boolean;
  overlayGeometry: GestureOverlayGeometry | null;
  handlers: {
    plot: GesturePointerHandlers;
    gutterX: GesturePointerHandlers;
    gutterY: GesturePointerHandlers;
  };
  setMode: (mode: GestureEngineMode) => void;
  /** Esc: drop the in-flight gesture and any provisional set. */
  cancel: () => void;
  /** `explicit` confirm: emit the provisional set as one `replace` intent. */
  commitIntent: () => ChartSelectionIntent<TDatum> | null;
  /** The provisional (explicit-confirm) intent, if any. */
  provisional: ChartSelectionIntent<TDatum> | null;
  /** Drive the reducer directly (keyboard rectangle, tests). */
  dispatch: (event: GestureEvent) => GestureState;
}

/** The engine mode a gesture list starts in. */
export function initialGestureMode(gestures: readonly ChartSelectionGesture[]): GestureEngineMode {
  for (const gesture of gestures) {
    if (gesture === "rect") return "rect";
    if (gesture === "lasso") return "lasso";
    if (gesture === "radial") return "radial";
    if (gesture === "range") return "range-x";
  }
  return "pointer";
}

function defaultToPlotPoint(
  clientX: number,
  clientY: number,
  target: Element | null,
): GesturePoint | null {
  if (!target) return null;
  const graphics = target as SVGGraphicsElement;
  const ctm = typeof graphics.getScreenCTM === "function" ? graphics.getScreenCTM() : null;
  if (ctm) {
    const inverse = ctm.inverse();
    return {
      x: inverse.a * clientX + inverse.c * clientY + inverse.e,
      y: inverse.b * clientX + inverse.d * clientY + inverse.f,
    };
  }
  const box = target.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

function valueKey(value: ChartSelectionValue): string {
  return value instanceof Date ? `d:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

/** Folds one settled intent into the provisional set under its own mode. */
export function accumulateProvisional<TDatum>(
  previous: ChartSelectionIntent<TDatum> | null,
  next: ChartSelectionIntent<TDatum>,
): ChartSelectionIntent<TDatum> | null {
  if (!previous || next.mode === "replace") return next;
  const values = new Map(previous.values.map((v) => [valueKey(v), v] as const));
  for (const v of next.values) {
    const key = valueKey(v);
    if (next.mode === "toggle" && values.has(key)) values.delete(key);
    else values.set(key, v);
  }
  if (values.size === 0) return null;
  const kept = new Set(values.keys());
  const datapoints = [...previous.datapoints, ...next.datapoints].filter(
    (p, i, all) =>
      p.category !== undefined &&
      kept.has(valueKey(p.category)) &&
      all.findIndex((q) => q.index === p.index && q.seriesKey === p.seriesKey) === i,
  );
  return { ...next, values: [...values.values()], datapoints };
}

export function useChartGesture<TDatum = Record<string, unknown>>(
  options: UseChartGestureOptions<TDatum>,
): UseChartGestureResult<TDatum> {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const enabled = options.enabled !== false;
  const confirm = options.confirm ?? "immediate";
  const startMode = options.mode ?? initialGestureMode(options.gestures);

  const stateRef = useRef<GestureState | null>(null);
  if (stateRef.current === null) stateRef.current = createGestureState(startMode, confirm);
  const [state, setState] = useState<GestureState>(stateRef.current);
  const [provisional, setProvisional] = useState<ChartSelectionIntent<TDatum> | null>(null);
  const provisionalRef = useRef<ChartSelectionIntent<TDatum> | null>(null);

  const emitSettled = useCallback((next: GestureState) => {
    const opts = optionsRef.current;
    const intent = resolveSelectionIntent<TDatum>(next, opts.getMarks(), {
      field: opts.field,
      xAxis: opts.xAxis,
      yAxis: opts.yAxis,
      hitRule: opts.hitRule,
      seriesLabel: opts.seriesLabel,
      source: "pointer",
    });
    if (next.phase === "committed") {
      if (intent) opts.onSelectionIntent?.(intent);
      return;
    }
    // Provisional (explicit confirm): accumulate, emit on commit.
    const folded = intent
      ? accumulateProvisional(provisionalRef.current, intent)
      : provisionalRef.current;
    provisionalRef.current = folded;
    setProvisional(folded);
  }, []);

  const dispatch = useCallback(
    (event: GestureEvent): GestureState => {
      const prev = stateRef.current as GestureState;
      const next = gestureReducer(prev, event);
      if (next === prev) return prev;
      stateRef.current = next;
      setState(next);
      const settled =
        (next.phase === "committed" || next.phase === "provisional") &&
        (prev.phase === "armed" || prev.phase === "dragging");
      if (settled) emitSettled(next);
      return next;
    },
    [emitSettled],
  );

  // Controlled mode / confirm follow their props.
  useEffect(() => {
    dispatch({ type: "setMode", mode: startMode });
  }, [dispatch, startMode]);
  useEffect(() => {
    dispatch({ type: "setConfirm", confirm });
  }, [confirm, dispatch]);

  // --- pointer plumbing -----------------------------------------------------

  const rafRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<GesturePoint | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const captureTargetRef = useRef<Element | null>(null);
  const touchRef = useRef<{
    pointerId: number;
    origin: GesturePoint;
    timer: ReturnType<typeof setTimeout> | null;
    armed: boolean;
    region: GestureRegion;
    modifiers: { shift: boolean; ctrlOrMeta: boolean };
    target: Element | null;
  } | null>(null);
  const touchCountRef = useRef(0);

  const toPoint = useCallback((event: GesturePointerEvent): GesturePoint | null => {
    const opts = optionsRef.current;
    const target = opts.getPlotElement?.() ?? (event.currentTarget as Element | null);
    const raw = (opts.toPlotPoint ?? defaultToPlotPoint)(event.clientX, event.clientY, target);
    if (!raw) return null;
    const size = opts.plotSize;
    if (!size) return raw;
    return {
      x: Math.max(0, Math.min(size.width, raw.x)),
      y: Math.max(0, Math.min(size.height, raw.y)),
    };
  }, []);

  const flushMove = useCallback(() => {
    rafRef.current = null;
    const point = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (point) dispatch({ type: "pointerMove", point });
  }, [dispatch]);

  const scheduleMove = useCallback(
    (point: GesturePoint) => {
      pendingMoveRef.current = point;
      if (rafRef.current !== null) return;
      if (typeof requestAnimationFrame === "function") {
        rafRef.current = requestAnimationFrame(flushMove);
      } else {
        flushMove();
      }
    },
    [flushMove],
  );

  const cancelFrame = useCallback(() => {
    if (rafRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = null;
    pendingMoveRef.current = null;
  }, []);

  const releaseCapture = useCallback(() => {
    const target = captureTargetRef.current;
    const id = activePointerRef.current;
    if (target && id !== null) {
      try {
        if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
      } catch {
        // Capture already gone (element unmounted) — nothing to release.
      }
    }
    captureTargetRef.current = null;
    activePointerRef.current = null;
  }, []);

  const capture = useCallback((event: GesturePointerEvent) => {
    const target = event.currentTarget as Element | null;
    activePointerRef.current = event.pointerId;
    captureTargetRef.current = target;
    try {
      target?.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic event (tests, a released pointer) has no capturable pointer.
    }
  }, []);

  const clearTouch = useCallback(() => {
    const touch = touchRef.current;
    if (touch?.timer) clearTimeout(touch.timer);
    touchRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cancelFrame();
    clearTouch();
    releaseCapture();
    provisionalRef.current = null;
    setProvisional(null);
    dispatch({ type: "cancel" });
  }, [cancelFrame, clearTouch, dispatch, releaseCapture]);

  const makeDown = useCallback(
    (region: GestureRegion) => (event: GesturePointerEvent) => {
      if (!optionsRef.current || optionsRef.current.enabled === false) return;
      const modifiers = { shift: event.shiftKey, ctrlOrMeta: event.ctrlKey || event.metaKey };
      if (event.pointerType === "touch") {
        touchCountRef.current += 1;
        if (touchCountRef.current > 1) {
          // Two fingers: navigator / zoom territory.
          cancel();
          return;
        }
        const point = toPoint(event);
        if (!point) return;
        const target = event.currentTarget as Element | null;
        const pointerId = event.pointerId;
        const timer = setTimeout(() => {
          const touch = touchRef.current;
          if (!touch || touch.armed) return;
          touch.armed = true;
          touch.timer = null;
          activePointerRef.current = pointerId;
          captureTargetRef.current = target;
          try {
            target?.setPointerCapture?.(pointerId);
          } catch {
            // see `capture`
          }
          dispatch({
            type: "pointerDown",
            point: touch.origin,
            modifiers: touch.modifiers,
            region: touch.region,
            mode: touch.region === "plot" ? "lasso" : undefined,
          });
        }, LONG_PRESS_MS);
        touchRef.current = {
          pointerId,
          origin: point,
          timer,
          armed: false,
          region,
          modifiers,
          target,
        };
        return;
      }
      if (event.button !== 0) return;
      const point = toPoint(event);
      if (!point) return;
      capture(event);
      dispatch({ type: "pointerDown", point, modifiers, region });
    },
    [cancel, capture, dispatch, toPoint],
  );

  const onPointerMove = useCallback(
    (event: GesturePointerEvent) => {
      if (event.pointerType === "touch") {
        const touch = touchRef.current;
        if (!touch || touch.pointerId !== event.pointerId) return;
        const point = toPoint(event);
        if (!point) return;
        if (!touch.armed) {
          if (Math.hypot(point.x - touch.origin.x, point.y - touch.origin.y) > CLICK_SENSITIVITY) {
            // Moved before the long press: a scroll / tooltip scrub, not ours.
            clearTouch();
          }
          return;
        }
        event.preventDefault?.();
        scheduleMove(point);
        return;
      }
      if (activePointerRef.current !== event.pointerId) return;
      const point = toPoint(event);
      if (point) scheduleMove(point);
    },
    [clearTouch, scheduleMove, toPoint],
  );

  const onPointerUp = useCallback(
    (event: GesturePointerEvent) => {
      if (event.pointerType === "touch") {
        touchCountRef.current = Math.max(0, touchCountRef.current - 1);
        const touch = touchRef.current;
        if (!touch || touch.pointerId !== event.pointerId) return;
        const point = toPoint(event) ?? touch.origin;
        if (!touch.armed) {
          // A tap: a click at the press point.
          clearTouch();
          dispatch({
            type: "pointerDown",
            point: touch.origin,
            modifiers: touch.modifiers,
            region: touch.region,
          });
          dispatch({ type: "pointerUp", point: touch.origin });
          return;
        }
        flushMove();
        clearTouch();
        releaseCapture();
        dispatch({ type: "pointerUp", point });
        return;
      }
      if (activePointerRef.current !== event.pointerId) return;
      const point = toPoint(event);
      if (rafRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafRef.current);
      }
      flushMove();
      releaseCapture();
      dispatch({ type: "pointerUp", point: point ?? undefined });
    },
    [clearTouch, dispatch, flushMove, releaseCapture, toPoint],
  );

  const onPointerCancel = useCallback(
    (event: GesturePointerEvent) => {
      if (event.pointerType === "touch") {
        touchCountRef.current = Math.max(0, touchCountRef.current - 1);
      }
      cancelFrame();
      clearTouch();
      releaseCapture();
      // Keep the provisional set — only the in-flight gesture is lost.
      dispatch({ type: "cancel" });
    },
    [cancelFrame, clearTouch, dispatch, releaseCapture],
  );

  useEffect(
    () => () => {
      cancelFrame();
      clearTouch();
    },
    [cancelFrame, clearTouch],
  );

  const handlers = useMemo(() => {
    const shared = { onPointerMove, onPointerUp, onPointerCancel };
    return {
      plot: { onPointerDown: makeDown("plot"), ...shared },
      gutterX: { onPointerDown: makeDown("gutter-x"), ...shared },
      gutterY: { onPointerDown: makeDown("gutter-y"), ...shared },
    };
  }, [makeDown, onPointerCancel, onPointerMove, onPointerUp]);

  const setMode = useCallback(
    (mode: GestureEngineMode) => {
      dispatch({ type: "setMode", mode });
    },
    [dispatch],
  );

  const commitIntent = useCallback((): ChartSelectionIntent<TDatum> | null => {
    const pending = provisionalRef.current;
    provisionalRef.current = null;
    setProvisional(null);
    dispatch({ type: "commit" });
    if (!pending) return null;
    const intent: ChartSelectionIntent<TDatum> = { ...pending, mode: "replace" };
    optionsRef.current.onSelectionIntent?.(intent);
    return intent;
  }, [dispatch]);

  const overlayGeometry = useMemo(() => gestureOverlayGeometry(state), [state]);

  return {
    state,
    isDragging: enabled && state.phase === "dragging",
    overlayGeometry: enabled ? overlayGeometry : null,
    handlers,
    setMode,
    cancel,
    commitIntent,
    provisional,
    dispatch,
  };
}

/** The pixel shape of a dragging gesture, or `null` when nothing is in flight. */
export function gestureOverlayGeometry(state: GestureState): GestureOverlayGeometry | null {
  if (state.phase !== "dragging" || !state.origin || !state.current) return null;
  const { origin, current } = state;
  switch (state.activeMode) {
    case "rect": {
      const r = normalizeRect(origin, current);
      return { kind: "rect", ...r };
    }
    case "range-x":
      return { kind: "band", axis: "x", from: origin.x, to: current.x };
    case "range-y":
      return { kind: "band", axis: "y", from: origin.y, to: current.y };
    case "lasso": {
      const snapped = snapToClose(simplifyPath(state.path));
      return { kind: "lasso", path: snapped.path, closed: snapped.closed };
    }
    case "radial":
      return {
        kind: "radial",
        cx: origin.x,
        cy: origin.y,
        r: Math.hypot(current.x - origin.x, current.y - origin.y),
      };
    default:
      return null;
  }
}
