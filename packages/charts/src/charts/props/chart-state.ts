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
    // and Composed. Heatmap and Gantt took `loading` until RM-194; it is an
    // alias row until 7.0.0 (`false` is the same "ready").
    status: field.enum({
      values: ["loading", "ready"],
      default: DEFAULT_CHART_STATUS,
      tier: "advanced",
      description: "Show the loading skeleton until the data is ready.",
    }),
    // No group default: families word their empty state differently, each as a
    // kind default in its own definition (Heatmap: "No data" / "No data to
    // plot."; Choropleth: "No data" / "No region has data to map."). `action`
    // is a ReactNode, so it stays code-only.
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
