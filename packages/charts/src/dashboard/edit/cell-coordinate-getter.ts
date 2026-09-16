/**
 * Keyboard coordinates for the edit layer (RM-078): dnd-kit's `KeyboardSensor` asks a
 * coordinate getter where the pointer goes next; this one moves one grid cell per arrow and
 * four with Shift, so a keyboard drag lands on the same cells a pointer drag snaps to.
 */
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";

/** Cells moved per arrow press with Shift held. */
export const DASHBOARD_EDIT_SHIFT_STEP = 4;

/** The pixel distance between the origins of two neighbouring cells (cell size plus gap). */
export interface CellPitch {
  width: number;
  height: number;
}

/** Cell delta for an arrow key (`event.key`), or `null` for any other key. */
export function arrowCellStep(key: string, shift: boolean): { dx: number; dy: number } | null {
  const n = shift ? DASHBOARD_EDIT_SHIFT_STEP : 1;
  switch (key) {
    case "ArrowRight":
      return { dx: n, dy: 0 };
    case "ArrowLeft":
      return { dx: -n, dy: 0 };
    case "ArrowDown":
      return { dx: 0, dy: n };
    case "ArrowUp":
      return { dx: 0, dy: -n };
    default:
      return null;
  }
}

/**
 * A `KeyboardCoordinateGetter` stepping `pitch()` pixels per arrow (×4 with Shift). `pitch`
 * is read on every key so a sheet resized mid-drag still snaps to its current cells.
 */
export function createCellCoordinateGetter(
  pitch: () => CellPitch | null,
): KeyboardCoordinateGetter {
  return (event, { currentCoordinates }) => {
    const step = arrowCellStep(event.key, event.shiftKey);
    const size = pitch();
    if (!step || !size) return undefined;
    event.preventDefault();
    return {
      x: currentCoordinates.x + step.dx * size.width,
      y: currentCoordinates.y + step.dy * size.height,
    };
  };
}
