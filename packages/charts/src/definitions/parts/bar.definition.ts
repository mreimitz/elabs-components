/**
 * Bar part definition (ADR 0042 §5, RM-175): one series of a BarChart. Kind defaults
 * match the destructuring of `BarInner` (`charts/bar.tsx`).
 *
 * `fill` has no default: BarChart checks whether each Bar set its own fill before handing
 * out palette colours, so a filled-in default would change the colours. `stackGap` and
 * `zeroLine` have none either: unset means "inherit from the chart" and "automatic".
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { BarProps } from "../../charts/bar";
import { paletteGroup } from "../../charts/props/palette";
import { seriesGroup } from "../../charts/props/series";
import { partialFieldFor } from "../../charts/props/typed-field";
import { valueFormatGroup } from "../../charts/props/value-format";
import { yAxisIdField } from "../cartesian-fields";
import { definePart } from "../define-chart";

export const BAR_PART = /* @__PURE__ */ definePart<BarProps>()({
  id: "Bar",
  version: 1,
  label: "Bar series",
  description: "One series of bars in a bar chart, read from one field of each row.",
  groups: [],
  fields: {
    dataKey: seriesGroup.fields.dataKey,
    yAxisId: yAxisIdField,
    fill: field.color({
      tier: "essential",
      description: "Fill of the bars: a colour, gradient or pattern url.",
    }),
    stroke: field.color({
      tier: "advanced",
      description: "Colour of the tooltip dot, when the fill is a gradient or pattern.",
    }),
    fillStyle: field.enum({
      values: ["solid", "hatch"],
      tier: "advanced",
      description: "Solid fill, or an outlined hairline hatch.",
    }),
    lineCap: field.union({
      of: [field.enum({ values: ["round", "butt"] }), field.number({ unit: "px" })],
      tier: "advanced",
      description: "Bar ends: round, butt, or a corner radius in pixels.",
    }),
    animate: field.boolean({
      tier: "advanced",
      description: "Animate the bars in.",
    }),
    animationType: field.enum({
      values: ["grow", "fade"],
      tier: "advanced",
      description: "Grow the bars in, or fade them in.",
    }),
    fadedOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the other bars while one is hovered.",
    }),
    staggerDelay: field.number({
      unit: "s",
      tier: "advanced",
      description: "Delay between bars as they animate in. Unset: computed.",
    }),
    stackGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap around this series' stacked segments. Unset: the chart's.",
    }),
    groupGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between grouped bars.",
    }),
    // A `filter` function inside the spec stays code-only.
    showValues: partialFieldFor<BarProps["showValues"]>()(
      field.union({
        of: [
          field.boolean(),
          field.enum({ values: ["outside", "inside"] }),
          field.object({
            fields: {
              placement: field.enum({ values: ["inside", "outside", "auto"] }),
              visibility: field.enum({ values: ["always", "hover"] }),
            },
          }),
        ],
        tier: "essential",
        description: "Print each bar's value beside or inside it.",
      }),
    ),
    valueFormat: valueFormatGroup.fields.valueFormat,
    unit: field.number({
      tier: "advanced",
      description: "Draw each bar as a stack of rungs, one per this much value.",
    }),
    // A predicate function stays code-only.
    highlightKey: partialFieldFor<BarProps["highlightKey"]>()(
      field.union({
        of: [field.string(), field.number()],
        tier: "advanced",
        description: "The one category drawn in ink as the hero bar.",
      }),
    ),
    palette: paletteGroup.fields.palette,
    zeroLine: field.boolean({
      tier: "advanced",
      description: "Hairline at zero. Unset: shown when any bar is negative.",
    }),
  },
  codeOnly: [],
  defaults: {
    fillStyle: "solid",
    lineCap: "round",
    animate: true,
    animationType: "grow",
    fadedOpacity: 0.3,
    groupGap: 4,
  },
  targets: [],
});
