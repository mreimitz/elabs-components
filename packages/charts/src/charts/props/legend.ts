/**
 * legend group — the legend of a chart kind that has one (ADR 0042 §4,
 * RM-174). Membership is the capability: a kind without this group has no
 * legend. A family whose legend config has more options (Choropleth's corner
 * positions) overrides the `legend` field with its own.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ContainerLegendProp } from "../legend/container-legend-types";
import { partialFieldFor } from "./typed-field";

/** The legend members. `legend` is the shape every container legend engine reads. */
export interface LegendGroupProps {
  legend?: ContainerLegendProp;
  legendShowValue?: boolean;
}

export const legendGroup = /* @__PURE__ */ definePropGroup<LegendGroupProps>()({
  id: "legend",
  fields: {
    // No group default: Heatmap keeps its own default of `true` as a kind
    // default (`showLegend = true`, `heatmap/heatmap-chart.tsx:1146`); the
    // other families leave `legend` unset. The config's `title` is a
    // ReactNode, so it stays code-only.
    legend: partialFieldFor<ContainerLegendProp>()(
      field.union({
        of: [
          field.boolean(),
          field.object({
            fields: {
              position: field.responsive({
                of: field.enum({ values: ["top", "bottom", "left", "right", "none"] }),
                breakpoints: ["medium", "narrow"],
              }),
              layout: field.responsive({
                of: field.enum({ values: ["row", "stack", "split"] }),
                breakpoints: ["medium", "narrow"],
              }),
              interactive: field.enum({ values: ["hover", "toggle", "none"] }),
              values: field.boolean(),
            },
          }),
        ],
        tier: "essential",
        description: "Show or hide the legend, or configure where and how it is drawn.",
      }),
    ),
    // No family declares it yet, so it has no default.
    legendShowValue: field.boolean({
      tier: "advanced",
      description: "Show each legend entry with its value.",
    }),
  },
});
