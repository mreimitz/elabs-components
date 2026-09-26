/**
 * frame-size group — how tall the plot is and how much room surrounds it
 * (ADR 0042 §4, RM-174). Applies to every chart kind.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { Margin } from "../chart-margin";
import type { ChartPlotHeight, Responsive } from "../responsive";

/**
 * The frame-size members. `margin` also takes one number for every side,
 * because Radar does (`margin?: number`, `radar-chart.tsx`); every other
 * family takes per-side values (`margin?: Partial<Margin>`).
 */
export interface FrameSizeGroupProps {
  plotHeight?: Responsive<ChartPlotHeight>;
  margin?: number | Partial<Margin>;
}

export const frameSizeGroup = /* @__PURE__ */ definePropGroup<FrameSizeGroupProps>()({
  id: "frame-size",
  fields: {
    // No group default: `DEFAULT_CHART_PLOT_HEIGHT` (`responsive.ts`) is the
    // default only of the families whose box was 2 : 1; the others size
    // their plot in their own way, so each kind keeps its own default.
    plotHeight: field.responsive({
      of: field.union({
        of: [
          field.number({ unit: "px" }),
          field.object({ fields: { aspect: field.number({ required: true }) } }),
        ],
      }),
      breakpoints: ["medium", "narrow"],
      tier: "essential",
      description:
        "Height of the plot: pixels, or { aspect } as width divided by height. Set { base, medium, narrow } to vary it by breakpoint.",
    }),
    // No group default: the families' margins differ (only 6 of the 11
    // `DEFAULT_MARGIN` copies are identical), and Radar's is a number:
    // `margin = 60` (`radar-chart.tsx:233`).
    margin: field.union({
      of: [
        field.number({ unit: "px" }),
        field.object({
          fields: {
            top: field.number({ unit: "px" }),
            right: field.number({ unit: "px" }),
            bottom: field.number({ unit: "px" }),
            left: field.number({ unit: "px" }),
          },
        }),
      ],
      tier: "advanced",
      description: "Space around the plot, in pixels: one number for every side, or per side.",
    }),
  },
});
