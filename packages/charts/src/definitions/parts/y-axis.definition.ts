/**
 * YAxis part definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `YAxisInner` (`charts/y-axis.tsx`). `tickCount` reuses the axis group's
 * field, whose `"auto"` default is the value `resolveAxisTickTarget` already assumes.
 * `valueFormat` has no default: ComposedChart checks whether the caller set it.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import { axisGroup } from "../../charts/props/axis";
import { partialFieldFor } from "../../charts/props/typed-field";
import { valueFormatGroup } from "../../charts/props/value-format";
import type { YAxisProps } from "../../charts/y-axis";
import { yAxisIdField } from "../cartesian-fields";
import { definePart } from "../define-chart";

/** A domain end: a number in data units, or `"auto"` for the data-derived end. */
const domainBound = /* @__PURE__ */ field.union({
  of: [field.number(), field.enum({ values: ["auto"] })],
});

export const Y_AXIS_PART = /* @__PURE__ */ definePart<YAxisProps>()({
  id: "YAxis",
  version: 1,
  label: "Y axis",
  description: "The value axis beside a cartesian chart's plot, on the left or the right.",
  groups: [],
  fields: {
    yAxisId: yAxisIdField,
    orientation: field.enum({
      values: ["left", "right"],
      tier: "essential",
      description: "Side of the plot the tick labels sit on.",
    }),
    numTicks: field.number({
      tier: "advanced",
      description: "Tick count hint; wins over tickCount.",
    }),
    tickCount: axisGroup.fields.tickCount,
    ticks: field.array({
      of: field.number(),
      tier: "advanced",
      description: "Exactly these tick values.",
    }),
    domain: field.array({
      of: domainBound,
      min: 2,
      max: 2,
      tier: "advanced",
      description: "Pin either end of the value domain, or auto.",
    }),
    scale: field.enum({
      values: ["linear", "log", "sqrt"],
      tier: "advanced",
      description: "How values map to pixels.",
    }),
    titlePlacement: field.enum({
      values: ["inside", "outside"],
      tier: "advanced",
      description: "Title in the margin (outside) or inside the plot.",
    }),
    labelPlacement: field.enum({
      values: ["inside", "outside"],
      tier: "advanced",
      description: "Tick labels in the margin (outside) or above their grid lines.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    currency: valueFormatGroup.fields.currency,
    unit: field.string({
      tier: "advanced",
      description: "Unit text appended to the tick(s) unitOn names.",
    }),
    unitOn: field.enum({
      values: ["last", "first", "all"],
      tier: "advanced",
      description: "Which ticks carry the unit.",
    }),
    matchSeriesColor: field.boolean({
      tier: "advanced",
      description: "Colour the labels like the axis' one series.",
    }),
    // A ReactNode caption stays code-only.
    sideLabel: partialFieldFor<YAxisProps["sideLabel"]>()(
      field.string({
        tier: "advanced",
        description: "Caption naming the scale above the ticks, or auto.",
      }),
    ),
  },
  codeOnly: ["title", "formatValue"],
  defaults: {
    orientation: "left",
    titlePlacement: "outside",
    labelPlacement: "outside",
    unitOn: "last",
    matchSeriesColor: false,
  },
  targets: [],
});
