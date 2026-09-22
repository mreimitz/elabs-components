"use client";

/**
 * area-select.tsx — rectangle, lasso and radial selection inside the plot
 * (RM-144, ADR 0040 §3–5).
 *
 * The drawing, hit-testing and intent resolution are RM-142's engine
 * (`gesture-machine.ts`, `hit-test.ts`, `resolve-intent.ts`); this module is the
 * ARMING policy — which plot drag draws which shape:
 *
 * | engine mode        | plain drag | Shift+drag | Shift+Alt+drag |
 * | ------------------ | ---------- | ---------- | -------------- |
 * | `pointer`          | nothing    | rectangle¹ | lasso²         |
 * | `rect`             | rectangle  | rectangle  | lasso²         |
 * | `lasso`            | lasso      | lasso      | lasso          |
 * | `radial`           | radial     | radial     | lasso²         |
 *
 * ¹ when the container lists `"rect"` (the associative BI suite's Shift shortcut, generalised);
 * ² when it lists `"lasso"`. Shift still means ADD for the resulting intent
 * (the mode is resolved from the modifiers at pointerdown, as every gesture's is).
 *
 * - Hit rule: `selectionHitRule` — `overlap` (default: any part of a bar /
 *   cell inside) or `contain`; points are hit by their centre either way.
 * - Visible marks only: a mark clipped out of the plot (a navigator window, a
 *   scrolled category) is never in a rect / lasso intent.
 * - Radial is a lasso preset: a circle from the press point (centre) to the
 *   release point (radius), resolved as a 24-gon.
 * - Touch: a 400 ms long-press arms the lasso (`use-chart-gesture.ts`).
 * - Keyboard: the rectangle crosshair (`keyboard-rect.tsx`) is the keyboard
 *   equivalent of all three.
 *
 * Pie / treemap: slices and cells would register their centroid through
 * `useRegisterMarkGeometry` and need no code here — but neither family mounts
 * the gesture layer yet (no plot `<g>` + chart context), so they are a
 * follow-up, not part of this module.
 */

import type { GestureEngineMode } from "./gesture-machine";
import type { ChartSelectionGesture } from "./types";

/** The gestures that draw inside the plot. */
export const AREA_GESTURES: readonly ChartSelectionGesture[] = ["rect", "lasso", "radial"];

/** True when a container enabled any in-plot area gesture. */
export function hasAreaGesture(gestures: readonly ChartSelectionGesture[]): boolean {
  return gestures.some((gesture) => AREA_GESTURES.includes(gesture));
}

/**
 * The mode a PLOT pointerdown is forced into by its modifiers, or `undefined`
 * to keep the engine's own mode (see the table in this module's header).
 */
export function resolveAreaDragMode(
  mode: GestureEngineMode,
  modifiers: { shift: boolean; alt: boolean },
  gestures: readonly ChartSelectionGesture[],
): GestureEngineMode | undefined {
  if (modifiers.shift && modifiers.alt && gestures.includes("lasso")) return "lasso";
  if (modifiers.shift && mode === "pointer" && gestures.includes("rect")) return "rect";
  return undefined;
}
