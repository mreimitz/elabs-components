"use client";

/**
 * keyboard-rect.tsx — the keyboard rectangle (RM-144, ADR 0040 §5).
 *
 * The report-builder suite's model, and the keyboard equivalent of the
 * rectangle, the lasso and the radial alike (a freehand path has no keyboard
 * form; a rectangle you steer does):
 *
 * - Tab reaches the plot's selection target — a real `<button>` over the plot
 *   in the gesture host, keyboard-only (`pointer-events: none`), outlined by
 *   `focus-ring` when focused.
 * - `S` enters rectangle mode: a crosshair appears at the plot centre (drawn in
 *   the gesture overlay, `aria-hidden`).
 * - Arrows move the crosshair one tick step (one category on a band axis);
 *   Shift ×10.
 * - HOLDING Space anchors the rectangle at the crosshair; arrows then grow it.
 * - RELEASING Space commits it with the modifier held at release: plain
 *   replace, Shift add, Ctrl / Cmd toggle. The polite live region announces
 *   the hit count ("12 points selected").
 * - Esc drops a rectangle being drawn, a second Esc (or leaving the target)
 *   leaves rectangle mode.
 *
 * The state is a pure reducer (`keyboardRectReducer`) so the tests drive it
 * without a DOM; `useKeyboardRect` binds it to key events.
 */

import { type KeyboardEvent, useCallback, useId, useReducer, useRef } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import { chartCssVars } from "../chart-context";
import type { GestureModifiers, GesturePoint } from "./gesture-machine";
import { normalizeRect } from "./geometry";
import { GESTURE_HALO_WIDTH, GESTURE_OUTLINE_WIDTH, GestureOverlay } from "./gesture-overlay";

export interface KeyboardRectState {
  active: boolean;
  cursor: GesturePoint;
  /** Where Space went down; `null` while only the crosshair moves. */
  anchor: GesturePoint | null;
}

export type KeyboardRectAction =
  | { type: "enter"; center: GesturePoint }
  | { type: "move"; dx: number; dy: number; bounds: { width: number; height: number } }
  | { type: "anchor" }
  | { type: "release" }
  | { type: "escape" }
  | { type: "exit" };

export const KEYBOARD_RECT_IDLE: KeyboardRectState = Object.freeze({
  active: false,
  cursor: { x: 0, y: 0 },
  anchor: null,
}) as KeyboardRectState;

export function keyboardRectReducer(
  state: KeyboardRectState,
  action: KeyboardRectAction,
): KeyboardRectState {
  switch (action.type) {
    case "enter":
      if (state.active) return state;
      return { active: true, cursor: action.center, anchor: null };
    case "move": {
      if (!state.active) return state;
      const x = Math.max(0, Math.min(action.bounds.width, state.cursor.x + action.dx));
      const y = Math.max(0, Math.min(action.bounds.height, state.cursor.y + action.dy));
      if (x === state.cursor.x && y === state.cursor.y) return state;
      return { ...state, cursor: { x, y } };
    }
    case "anchor":
      if (!state.active || state.anchor) return state;
      return { ...state, anchor: state.cursor };
    case "release":
      if (!state.anchor) return state;
      return { ...state, anchor: null };
    case "escape":
      if (state.anchor) return { ...state, anchor: null };
      return state.active ? KEYBOARD_RECT_IDLE : state;
    case "exit":
      return state.active ? KEYBOARD_RECT_IDLE : state;
    default:
      return state;
  }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function isSpace(event: { key: string; code?: string }) {
  return event.key === " " || event.key === "Spacebar" || event.code === "Space";
}

export interface UseKeyboardRectOptions {
  width: number;
  height: number;
  /** One arrow step on each axis, px. */
  step: { x: number; y: number };
  /**
   * Commits a rectangle (plot px) with the modifiers held at release; returns
   * the number of marks it hit.
   */
  onCommit: (origin: GesturePoint, current: GesturePoint, modifiers: GestureModifiers) => number;
  /** Speaks a message through the host's live region. */
  announce: (message: string) => void;
}

export interface UseKeyboardRectResult {
  state: KeyboardRectState;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
}

export function useKeyboardRect(options: UseKeyboardRectOptions): UseKeyboardRectResult {
  const { t } = useLocale();
  const [state, dispatch] = useReducer(keyboardRectReducer, KEYBOARD_RECT_IDLE);
  const live = useRef({ options, state, t });
  live.current = { options, state, t };

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const { options: opts, state: current, t: translate } = live.current;
    if (!current.active) {
      if ((event.key === "s" || event.key === "S") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        dispatch({ type: "enter", center: { x: opts.width / 2, y: opts.height / 2 } });
        opts.announce(translate("charts.selection.announce.rectMode"));
      }
      return;
    }
    if (isSpace(event)) {
      event.preventDefault();
      if (!event.repeat) dispatch({ type: "anchor" });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: "escape" });
      opts.announce(translate("charts.selection.announce.cancelled"));
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const factor = event.shiftKey ? 10 : 1;
    dispatch({
      type: "move",
      dx: arrow[0] * opts.step.x * factor,
      dy: arrow[1] * opts.step.y * factor,
      bounds: { width: opts.width, height: opts.height },
    });
  }, []);

  const onKeyUp = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const { options: opts, state: current, t: translate } = live.current;
    if (!isSpace(event)) return;
    // A button fires `click` on Space keyup — nothing to activate here.
    event.preventDefault();
    if (!current.anchor) return;
    const modifiers = { shift: event.shiftKey, ctrlOrMeta: event.ctrlKey || event.metaKey };
    dispatch({ type: "release" });
    const count = opts.onCommit(current.anchor, current.cursor, modifiers);
    opts.announce(
      count > 0
        ? translate("charts.selection.announce.points", { count })
        : translate("charts.selection.announce.none"),
    );
  }, []);

  const onBlur = useCallback(() => dispatch({ type: "exit" }), []);

  return { state, onKeyDown, onKeyUp, onBlur };
}

// ---------------------------------------------------------------------------
// SVG: the crosshair (and the rectangle being drawn)
// ---------------------------------------------------------------------------

export interface KeyboardRectCrosshairProps {
  state: KeyboardRectState;
  width: number;
  height: number;
}

/** The crosshair + the rectangle in progress, inside the plot `<g>`. `aria-hidden`. */
export function KeyboardRectCrosshair({ state, width, height }: KeyboardRectCrosshairProps) {
  if (!state.active) return null;
  const { x, y } = state.cursor;
  const rect = state.anchor ? normalizeRect(state.anchor, state.cursor) : null;
  const line = (stroke: string, strokeWidth: number) => (
    <>
      <line stroke={stroke} strokeWidth={strokeWidth} x1={x} x2={x} y1={0} y2={height} />
      <line stroke={stroke} strokeWidth={strokeWidth} x1={0} x2={width} y1={y} y2={y} />
    </>
  );
  return (
    <g
      aria-hidden="true"
      data-anchored={state.anchor ? "true" : "false"}
      data-slot="chart-selection-keyboard-crosshair"
      data-x={Math.round(x)}
      data-y={Math.round(y)}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      {line(chartCssVars.background, GESTURE_HALO_WIDTH)}
      {line(chartCssVars.foreground, GESTURE_OUTLINE_WIDTH)}
      {rect ? (
        <GestureOverlay
          geometry={{ kind: "rect", ...rect }}
          height={height}
          slot="chart-selection-keyboard-rect-shape"
          width={width}
        />
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// HTML: the focus target
// ---------------------------------------------------------------------------

export interface KeyboardRectTargetProps {
  controller: UseKeyboardRectResult;
  /** The plot box inside the gesture host, px. */
  box: { left: number; top: number; width: number; height: number };
}

/** The plot's keyboard selection target — one tab stop, keyboard-only. */
export function KeyboardRectTarget({ controller, box }: KeyboardRectTargetProps) {
  const { t } = useLocale();
  const hintId = useId();
  return (
    <button
      aria-describedby={hintId}
      aria-label={t("charts.selection.keyboardRect")}
      className="pointer-events-none absolute rounded-sm focus-ring"
      data-active={controller.state.active ? "true" : "false"}
      data-slot="chart-selection-keyboard-rect"
      onBlur={controller.onBlur}
      onKeyDown={controller.onKeyDown}
      onKeyUp={controller.onKeyUp}
      style={box}
      type="button"
    >
      <span className="sr-only" id={hintId}>
        {t("charts.selection.keyboardRectHint")}
      </span>
    </button>
  );
}
