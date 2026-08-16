/**
 * Pure geometry/snap helpers for Gantt pointer drag (P1 — emit-only editing).
 * No React, no DOM — unit-testable. The caller passes the grid `unitMs`
 * (from `gridUnitMs(viewMode)`) so this module has no dependency on gantt-bar.
 */

/** Pixels the pointer must move before a press is treated as a drag (vs a click). */
export const DRAG_THRESHOLD_PX = 4;

/**
 * Convert a horizontal pixel delta on the canvas to a snapped time delta (ms),
 * quantized to the view-mode grid unit so pointer drag steps match keyboard nudge.
 */
export function snapDeltaMs(
  deltaX: number,
  canvasWidth: number,
  domainMs: number,
  unitMs: number,
): number {
  if (canvasWidth <= 0 || domainMs <= 0 || unitMs <= 0) return 0;
  const rawMs = (deltaX / canvasWidth) * domainMs;
  return Math.round(rawMs / unitMs) * unitMs;
}

/** Inverse of `dateToX` — map a canvas x back to a (unsnapped) date. */
export function xToDate(x: number, domainStart: Date, domainEnd: Date, canvasWidth: number): Date {
  const total = domainEnd.getTime() - domainStart.getTime();
  if (canvasWidth <= 0) return new Date(domainStart.getTime());
  return new Date(domainStart.getTime() + (x / canvasWidth) * total);
}

export type DragMode = "move" | "resize-start" | "resize-end";

/**
 * Compute the proposed [start, end] for a drag, clamped so the bar keeps at
 * least one grid unit of width. Returns epoch-ms.
 */
export function applyDragDelta(
  mode: DragMode,
  origStartMs: number,
  origEndMs: number,
  deltaMs: number,
  unitMs: number,
): { start: number; end: number } {
  switch (mode) {
    case "move":
      return { start: origStartMs + deltaMs, end: origEndMs + deltaMs };
    case "resize-start":
      return { start: Math.min(origStartMs + deltaMs, origEndMs - unitMs), end: origEndMs };
    case "resize-end":
      return { start: origStartMs, end: Math.max(origEndMs + deltaMs, origStartMs + unitMs) };
  }
}
