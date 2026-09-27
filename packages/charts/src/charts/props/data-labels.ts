/**
 * data-labels group — value labels drawn on a chart's marks (ADR 0042 §4,
 * RM-174). For the Bar part, Pie, Ring, Funnel, Waterfall, Treemap, Heatmap,
 * Unit and Dumbbell, but applied only by RM-193, after RM-191 has moved the
 * word-bag `labels` props to `messages`, so `labels` never means two things.
 *
 * `labels` takes a flag or a config. The config holds only `show` here, the
 * shape the ui `boolean-to-labels` alias transform produces (`true` becomes
 * `{ show: true }`); a family with more label options (Pie, Ring, Waterfall,
 * the Bar part) overrides the field with its own config.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

/** The value-label config every data-labels kind accepts. */
export interface ChartDataLabelsConfig {
  show?: boolean;
}

/** The data-labels members. */
export interface DataLabelsGroupProps {
  labels?: boolean | ChartDataLabelsConfig;
}

export const dataLabelsGroup = /* @__PURE__ */ definePropGroup<DataLabelsGroupProps>()({
  id: "data-labels",
  fields: {
    // No group default: the families disagree (ADR 0042 A.3), each in its own kind
    // `defaults` instead. Funnel shows values by default (`labels: true`), Treemap
    // does not (`labels: false`), Waterfall does (`labels: true`), and Heatmap
    // computes its default from the palette (`HEATMAP_CHART.normalize`, RM-193).
    labels: field.union({
      of: [field.boolean(), field.object({ fields: { show: field.boolean() } })],
      tier: "essential",
      description: "Show the value of each mark beside it.",
    }),
  },
});

/**
 * Reads a `labels` prop down to the one flag its paint path needs. The
 * `boolean-to-labels` alias transform (`showValues` → `labels`, RM-193) turns
 * a plain flag into `{ show: flag }`, so a family's own default only applies
 * when `labels` itself is unset — an explicit `{ show }` always wins, even
 * `{ show: false }`.
 */
export function isDataLabelsOn(
  labels: boolean | ChartDataLabelsConfig | undefined,
  fallback: boolean,
): boolean {
  if (labels === undefined) return fallback;
  return typeof labels === "boolean" ? labels : (labels.show ?? fallback);
}
