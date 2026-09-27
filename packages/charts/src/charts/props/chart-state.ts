/**
 * chart-state group — whether a chart's data has arrived, and what it shows
 * when there is nothing to plot (ADR 0042 §4, RM-174). Applies to every chart
 * kind. `status` is the charts loading alias of the conventions; no fourth
 * loading name is minted, and the ui `status` tone group is never applied to
 * a chart kind (ADR 0042 §9).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import type { ReactNode } from "react";

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../chart-phase";
import type { ChartStatus } from "../chart-phase";
import { partialFieldFor } from "./typed-field";

/** What a chart shows when it has nothing to plot. */
export interface ChartEmptyState {
  title?: string;
  message?: string;
  /** Typically the control that undoes the filter which emptied the chart. */
  action?: ReactNode;
}

/** The chart-state members. */
export interface ChartStateGroupProps {
  /** Show the loading skeleton until the data is ready. */
  status?: ChartStatus;
  /** Title and message shown when there is nothing to plot. */
  empty?: ChartEmptyState;
}

export const chartStateGroup = /* @__PURE__ */ definePropGroup<ChartStateGroupProps>()({
  id: "chart-state",
  fields: {
    // `status = DEFAULT_CHART_STATUS` on Line (`line-chart.tsx:453`), Area, Bar
    // and Composed; Heatmap and Gantt say it as `loading` today, whose default
    // `false` is the same "ready".
    status: field.enum({
      values: ["loading", "ready"],
      default: DEFAULT_CHART_STATUS,
      tier: "advanced",
      description: "Show the loading skeleton until the data is ready.",
    }),
    // No group default: the two families with an empty state say different
    // things. Heatmap: "No data" / "No data to plot."
    // (`heatmap/heatmap-chart.tsx:1134-1135`); Choropleth: "No data" / "No
    // region has data to map." (`choropleth/choropleth-chart.tsx:1226-1227`).
    // `action` is a ReactNode, so it stays code-only.
    empty: partialFieldFor<ChartEmptyState>()(
      field.object({
        fields: {
          title: field.string(),
          message: field.string(),
        },
        tier: "advanced",
        description: "Title and message shown when there is nothing to plot.",
      }),
    ),
  },
});
