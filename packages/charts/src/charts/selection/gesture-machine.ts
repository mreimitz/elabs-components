/**
 * gesture-machine.ts — the selection gesture engine's pure reducer (RM-142).
 *
 * One state machine for every gesture a container can enable:
 *
 *   idle ──pointerDown──▶ armed ──move > clickSensitivity──▶ dragging
 *     ▲                    │ pointerUp (a click)               │ pointerUp
 *     │                    ▼                                   ▼
 *     └──cancel──── provisional ◀──(explicit confirm)──── ────┤
 *                          │ commit                            │ (immediate)
 *                          ▼                                   ▼
 *                      committed ◀─────────────────────────────┘
 *
 * - The selection MODE (`replace` / `add` / `toggle`) is resolved ONCE, at
 *   pointerdown, from the modifiers held then (`resolveMode`) — releasing Shift
 *   mid-drag does not change what the drag means.
 * - A pointerdown in an axis GUTTER forces an axis range on that axis
 *   (`range-x` / `range-y`) whatever the engine's mode — the associative BI suite's "drag along the
 *   axis" gesture.
 * - `pointer` mode never drags: a travel past `CLICK_SENSITIVITY` turns the
 *   press into a no-op (the tooltip / pan path owns it), a short press is a
 *   click.
 * - `cancel` (Esc, pointercancel, lost capture) returns to `idle` from ANY
 *   phase.
 *
 * Pure: no React, no DOM. `use-chart-gesture.ts` binds pointer events to it;
 * the canvas layer and the (parked) dashboard driver can drive it directly.
 */

import type { ChartSelectionConfirm, ChartSelectionMode } from "./types";

/** What a drag draws. `pointer` = click-only. */
export type GestureEngineMode = "pointer" | "range-x" | "range-y" | "rect" | "lasso" | "radial";

export type GesturePhase = "idle" | "armed" | "dragging" | "provisional" | "committed";

/** Where a pointerdown landed: the plot, or the x / y axis gutter. */
export type GestureRegion = "plot" | "gutter-x" | "gutter-y";

/** A position in PLOT pixels (origin at the plot's top-left). */
export interface GesturePoint {
  x: number;
  y: number;
}

export interface GestureModifiers {
  shift: boolean;
  ctrlOrMeta: boolean;
}

export interface GestureState {
  /** The engine's configured mode (what a plot drag draws). */
  mode: GestureEngineMode;
  /** The mode of the gesture in flight — `mode`, or a gutter's forced axis range. */
  activeMode: GestureEngineMode;
  phase: GesturePhase;
  /** Where the gesture started (pointerdown), plot pixels. */
  origin: GesturePoint | null;
  /** The latest pointer position, plot pixels. */
  current: GesturePoint | null;
  /** Every sampled position since pointerdown (the lasso's raw path). */
  path: GesturePoint[];
  /** Modifiers held at pointerdown. */
  modifiers: GestureModifiers;
  confirm: ChartSelectionConfirm;
  /** The selection mode resolved at pointerdown; `null` before any press. */
  selectionMode: ChartSelectionMode | null;
  /** True when the finished gesture never left `clickSensitivity` — a click, not a drag. */
  isClick: boolean;
  /** Largest distance from `origin` seen so far, px. */
  travel: number;
  region: GestureRegion;
}

export type GestureEvent =
  | {
      type: "pointerDown";
      point: GesturePoint;
      modifiers: GestureModifiers;
      region: GestureRegion;
      /** Force this gesture's mode (a touch long-press arms `lasso`). */
      mode?: GestureEngineMode;
    }
  | { type: "pointerMove"; point: GesturePoint }
  | { type: "pointerUp"; point?: GesturePoint }
  | { type: "cancel" }
  | { type: "setMode"; mode: GestureEngineMode }
  | { type: "setConfirm"; confirm: ChartSelectionConfirm }
  | { type: "commit" };

/** Below this travel (px) a press-release is a click, not a drag (the report-builder BI suite / picasso.js). */
export const CLICK_SENSITIVITY = 4;

export const NO_MODIFIERS: GestureModifiers = Object.freeze({ shift: false, ctrlOrMeta: false });

/**
 * Modifier → selection mode (ADR 0040 §4): Ctrl/Cmd = toggle (wins over
 * Shift), Shift = add, plain = replace — except in `explicit` confirm, where a
 * plain gesture toggles into the provisional set (the associative BI suite).
 */
export function resolveMode(
  modifiers: GestureModifiers,
  confirm: ChartSelectionConfirm = "immediate",
): ChartSelectionMode {
  if (modifiers.ctrlOrMeta) return "toggle";
  if (modifiers.shift) return "add";
  return confirm === "explicit" ? "toggle" : "replace";
}

export function createGestureState(
  mode: GestureEngineMode = "rect",
  confirm: ChartSelectionConfirm = "immediate",
): GestureState {
  return {
    mode,
    activeMode: mode,
    phase: "idle",
    origin: null,
    current: null,
    path: [],
    modifiers: NO_MODIFIERS,
    confirm,
    selectionMode: null,
    isClick: false,
    travel: 0,
    region: "plot",
  };
}

function modeForRegion(mode: GestureEngineMode, region: GestureRegion): GestureEngineMode {
  if (region === "gutter-x") return "range-x";
  if (region === "gutter-y") return "range-y";
  return mode;
}

function toIdle(state: GestureState): GestureState {
  return {
    ...createGestureState(state.mode, state.confirm),
  };
}

function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The phase a released gesture lands in under the confirm mode. */
function settledPhase(confirm: ChartSelectionConfirm): GesturePhase {
  return confirm === "explicit" ? "provisional" : "committed";
}

/**
 * The reducer. Returns the SAME object for an event that changes nothing, so a
 * `useReducer` caller bails out of re-rendering.
 */
export function gestureReducer(state: GestureState, event: GestureEvent): GestureState {
  switch (event.type) {
    case "setMode": {
      if (event.mode === state.mode && state.phase === "idle") return state;
      return { ...toIdle(state), mode: event.mode, activeMode: event.mode };
    }
    case "setConfirm": {
      if (event.confirm === state.confirm) return state;
      return { ...toIdle(state), confirm: event.confirm };
    }
    case "cancel": {
      if (state.phase === "idle") return state;
      return toIdle(state);
    }
    case "pointerDown": {
      // A press while armed/dragging (a second pointer) is ignored; from idle,
      // provisional (accumulating) or committed it starts a new gesture.
      if (state.phase === "armed" || state.phase === "dragging") return state;
      return {
        ...state,
        activeMode: event.mode ?? modeForRegion(state.mode, event.region),
        phase: "armed",
        origin: event.point,
        current: event.point,
        path: [event.point],
        modifiers: event.modifiers,
        selectionMode: resolveMode(event.modifiers, state.confirm),
        isClick: false,
        travel: 0,
        region: event.region,
      };
    }
    case "pointerMove": {
      if (state.phase !== "armed" && state.phase !== "dragging") return state;
      const origin = state.origin ?? event.point;
      const travel = Math.max(state.travel, distance(origin, event.point));
      if (state.phase === "armed") {
        if (travel <= CLICK_SENSITIVITY || state.activeMode === "pointer") {
          // Still a potential click (or pointer mode, which never drags).
          return { ...state, current: event.point, travel };
        }
        return {
          ...state,
          phase: "dragging",
          current: event.point,
          path: [...state.path, event.point],
          travel,
        };
      }
      return {
        ...state,
        current: event.point,
        path: state.activeMode === "lasso" ? [...state.path, event.point] : state.path,
        travel,
      };
    }
    case "pointerUp": {
      if (state.phase === "armed") {
        const point = event.point ?? state.current ?? state.origin;
        const travel =
          point && state.origin ? Math.max(state.travel, distance(state.origin, point)) : 0;
        if (travel > CLICK_SENSITIVITY) {
          // Pointer mode moved too far to be a click: the press was a pan /
          // hover, never a selection.
          if (state.activeMode === "pointer" || !point) return toIdle(state);
          // A drawing mode released far from its origin with no move sampled
          // in between (a throttled frame never landed): still a drag.
          return {
            ...state,
            phase: settledPhase(state.confirm),
            current: point,
            path: [...state.path, point],
            isClick: false,
            travel,
          };
        }
        return {
          ...state,
          phase: settledPhase(state.confirm),
          current: point ?? state.current,
          isClick: true,
          travel,
        };
      }
      if (state.phase === "dragging") {
        const point = event.point ?? state.current;
        const path =
          state.activeMode === "lasso" && event.point ? [...state.path, event.point] : state.path;
        return {
          ...state,
          phase: settledPhase(state.confirm),
          current: point,
          path,
          isClick: false,
        };
      }
      return state;
    }
    case "commit": {
      if (state.phase !== "provisional") return state;
      return { ...state, phase: "committed" };
    }
    default:
      return state;
  }
}

/** True while a press is in flight (hover tooltips are suppressed while dragging). */
export function isGestureActive(state: GestureState): boolean {
  return state.phase === "armed" || state.phase === "dragging";
}
