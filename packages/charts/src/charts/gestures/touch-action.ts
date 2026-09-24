/**
 * gestures/touch-action.ts — the one `touch-action` policy for chart roots.
 *
 * A chart used to set `touch-action: none` on its root, which switched off the
 * browser's own gestures wherever a finger landed: a full-width chart on a
 * phone trapped page scroll and swallowed pinch-zoom, and nothing replaced
 * either. The effective `touch-action` of a touch is the INTERSECTION of every
 * element from the target up, so a root only ever narrows it:
 *
 * - {@link CHART_TOUCH_ACTION} — every chart root. Vertical page scroll and
 *   the browser's pinch-zoom pass through; a horizontal one-finger scrub stays
 *   with the chart (the tooltip). A browser that does not know `pinch-zoom`
 *   (iOS Safari) drops the declaration and falls back to `auto`, which is also
 *   fine: the tooltip reads touch events, which keep firing during a scroll.
 * - {@link CHART_ZOOM_TOUCH_ACTION} — a root whose chart zooms itself
 *   (`usePinchGesture`): the chart takes the pinch, the page keeps its scroll.
 * - {@link CHART_DRAG_TOUCH_ACTION} — a surface that owns every drag direction
 *   (the long-press lasso, a pan-in-2-D plot, a draggable network node).
 */

export const CHART_TOUCH_ACTION = "pan-y pinch-zoom";

export const CHART_ZOOM_TOUCH_ACTION = "pan-y";

export const CHART_DRAG_TOUCH_ACTION = "none";
