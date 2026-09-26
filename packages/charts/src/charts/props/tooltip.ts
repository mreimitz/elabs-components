/**
 * tooltip group — whether a chart shows its tooltip and what the tooltip keeps
 * clear of (ADR 0042 §4, RM-174). Applies to every chart kind; the passive
 * gate lives in `ChartTooltipBox`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ChartTooltipBoxProps } from "../tooltip/tooltip-box";
import { partialFieldFor } from "./typed-field";

/** The tooltip members. `tooltipAvoid` takes what `ChartTooltipBox` `avoid` takes. */
export interface TooltipGroupProps {
  tooltip?: boolean;
  tooltipAvoid?: ChartTooltipBoxProps["avoid"];
}

/** A rectangle in the chart container's own pixels. */
const avoidRect = /* @__PURE__ */ field.object({
  fields: {
    x: field.number({ required: true, unit: "px" }),
    y: field.number({ required: true, unit: "px" }),
    width: field.number({ required: true, unit: "px" }),
    height: field.number({ required: true, unit: "px" }),
  },
});

export const tooltipGroup = /* @__PURE__ */ definePropGroup<TooltipGroupProps>()({
  id: "tooltip",
  fields: {
    // Every family with the opt-out defaults it on: `{ tooltip = true, ...props }`
    // on Line (`line-chart.tsx:756`), Area, Bar, Scatter, Candlestick and
    // Composed; every other family always shows its tooltip.
    tooltip: field.boolean({
      default: true,
      tier: "essential",
      description: "Show the tooltip.",
    }),
    // Elements and refs, measured live, stay code-only.
    tooltipAvoid: partialFieldFor<ChartTooltipBoxProps["avoid"]>()(
      field.union({
        of: [avoidRect, field.array({ of: avoidRect })],
        tier: "advanced",
        description:
          "Areas the tooltip keeps clear of: { x, y, width, height } in the chart’s own pixels, or a list of them.",
      }),
    ),
  },
});
