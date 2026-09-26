/**
 * palette group — which colours a chart's marks draw from (ADR 0042 §4,
 * RM-174). Applies to every chart kind. There is one `ChartPalette`; a family
 * that accepts only some ramps narrows it with `Extract<ChartPalette, …>` and
 * overrides the `palette` field with its own.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ChartColorBy, ChartPalette } from "../chart-context";
import { partialFieldFor } from "./typed-field";

/** The palette members. */
export interface PaletteGroupProps {
  palette?: ChartPalette;
  colorBy?: ChartColorBy;
}

export const paletteGroup = /* @__PURE__ */ definePropGroup<PaletteGroupProps>()({
  id: "palette",
  fields: {
    // No group default: the families disagree. Tree and Treemap default to
    // `"mono"` (`tree-chart.tsx:929`, `treemap/treemap-chart.tsx:207`), Heatmap
    // to `"sequential"` (`heatmap/heatmap-chart.tsx:1142`), and the others
    // leave it unset, which is not the same as passing `"categorical"`.
    palette: field.enum({
      values: ["categorical", "sequential", "diverging", "mono", "accent"],
      tier: "essential",
      description: "Colour ramp the marks draw from.",
    }),
    // `colors` (a category → colour map) is not described: the field
    // vocabulary has no record kind, so it stays code-only for now.
    colorBy: partialFieldFor<ChartColorBy>()(
      field.object({
        fields: {
          key: field.string({ required: true }),
          scale: field.enum({ values: ["categorical", "sequential", "diverging"] }),
          steps: field.number(),
        },
        tier: "advanced",
        description: "Colour the marks by the values of one data field.",
      }),
    ),
  },
});
