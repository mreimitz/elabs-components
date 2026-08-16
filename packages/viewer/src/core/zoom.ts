/**
 * The zoom vocabulary — the stops, and how the chrome moves between them.
 *
 * Lives in `core/` rather than in the PDF adapter (where the stops started)
 * because zoom is now provider state: the shell's zoom control, the provider's
 * `zoomIn`/`zoomOut` and every adapter that scales its content all have to agree
 * on the same ladder, or "125%" in the toolbar and the scale the page rendered
 * at drift apart.
 */

import type { ZoomFit, ZoomLevel } from "./types";

/**
 * Zoom stops, in document scale.
 *
 * Discrete rather than continuous: a slider is imprecise with a pointer and
 * impossible with a keyboard at this size, and "somewhere near 137%" is not a
 * state a reader ever wants to be in. The ladder is the one from the original
 * PDF pager, unchanged, so existing screens land on the same numbers.
 */
export const VIEWER_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** 100% — the scale a document opens at. */
export const DEFAULT_ZOOM = 1;

/** Float slack, so `1.0000000000000002 > 1` does not skip a stop. */
const EPSILON = 1e-6;

/** Whether a zoom level is a fit mode rather than a fixed scale. */
export function isZoomFit(zoom: ZoomLevel): zoom is ZoomFit {
  return typeof zoom === "string";
}

/**
 * The next stop above or below `from`.
 *
 * Takes an arbitrary scale, not an index, because a fit mode resolves to
 * whatever the viewport made it (1.37, say) and the reader's next "zoom in" has
 * to land on a real stop above that — an index-based pager would jump back to
 * wherever the ladder was last parked.
 */
export function stepZoom(from: number, delta: 1 | -1): number {
  const steps = VIEWER_ZOOM_STEPS;
  const first = steps[0];
  const last = steps[steps.length - 1] as number;
  if (delta === 1) return steps.find((step) => step > from + EPSILON) ?? last;
  return [...steps].reverse().find((step) => step < from - EPSILON) ?? (first as number);
}

/** Whether there is a stop left in that direction — what disables the button. */
export function canStepZoom(from: number, delta: 1 | -1): boolean {
  const steps = VIEWER_ZOOM_STEPS;
  return delta === 1
    ? from < (steps[steps.length - 1] as number) - EPSILON
    : from > (steps[0] as number) + EPSILON;
}
