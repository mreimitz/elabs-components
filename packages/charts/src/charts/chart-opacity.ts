/**
 * chart-opacity.ts — the selection dim opacity (RM-073, RM-173).
 *
 * Split out of `chart-selection.ts`, which also imports React, so a chart
 * prop group can reference `SELECTION_EXCLUDED_OPACITY` without pulling React
 * into the pure definition layer. `chart-selection.ts` re-exports it, so
 * every existing import keeps working unchanged.
 */

/**
 * Opacity of an excluded mark. Charts own this value but reuse the process
 * package's encoding (`GHOST_OPACITY` in
 * `@elabs-ai/components-process` `process-map/map-model.ts`) so a dashboard's
 * charts and its process map dim excluded values alike. No theme token is
 * minted for it (RM-069 decision 5); this is the one seam, never re-declared
 * per family.
 */
export const SELECTION_EXCLUDED_OPACITY = 0.35;
