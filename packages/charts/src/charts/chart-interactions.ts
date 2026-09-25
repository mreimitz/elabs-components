/**
 * chart-interactions.ts — which interaction layers a chart mounts (RM-072,
 * RM-173).
 *
 * Split out of `chart-config-context.tsx`, which also imports React, so a
 * chart prop group can reference `ChartInteractions` without pulling React
 * into the pure definition layer. `chart-config-context.tsx` re-exports both
 * names, so every existing import keeps working unchanged.
 */

/**
 * Which interaction layers a chart mounts (RM-072) — the interaction policy
 * an embedding analytics host hands a visualization.
 *
 * - `passive` — hover feedback: `ChartTooltip`, `ChartTooltipDot`, every
 *   hand-mounted `ChartTooltipBox`, the Gantt bar tooltips and the `Sparkline`
 *   readout (RM-167).
 * - `active` — direct manipulation: `ChartBrush`, the `ChartDatapointLayer`
 *   keyboard targets, the navigator strip's handles and drag, pinch / wheel /
 *   keyboard zoom and its controls, pan and zoom on the density scatter, the
 *   choropleth and the tree, node drag, Gantt bar drag and keyboard edits, and
 *   the selection gestures (RM-167).
 * - `select` — committing a datapoint: `onDatapointClick` /
 *   `copyValueOnActivate`, and a selection gesture's intent. The layer stays;
 *   activation is a no-op.
 * - `edit` — reserved for an authoring host; no chart reads it yet.
 *
 * Every gesture owner reads the policy through `useChartInteractionPolicy`
 * (`chart-config-context.tsx`).
 */
export interface ChartInteractions {
  passive?: boolean;
  active?: boolean;
  select?: boolean;
  edit?: boolean;
}

export const DEFAULT_CHART_INTERACTIONS: Required<ChartInteractions> = {
  passive: true,
  active: true,
  select: true,
  edit: false,
};
