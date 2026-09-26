/**
 * BarValueAxis part definition (ADR 0042 §5, RM-175): the value axis of a horizontal
 * BarChart. Kind defaults match the destructuring of `BarValueAxis`
 * (`charts/bar-value-axis.tsx`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { BarValueAxisProps } from "../../charts/bar-value-axis";
import { valueFormatGroup } from "../../charts/props/value-format";
import { definePart } from "../define-chart";

export const BAR_VALUE_AXIS_PART = /* @__PURE__ */ definePart<BarValueAxisProps>()({
  id: "BarValueAxis",
  version: 1,
  label: "Bar value axis",
  description: "The value axis of a horizontal bar chart, above or below the bars.",
  groups: [],
  fields: {
    position: field.enum({
      values: ["top", "bottom"],
      tier: "essential",
      description: "Edge the axis is drawn on.",
    }),
    numTicks: field.number({
      tier: "advanced",
      description: "Tick count hint.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    title: field.string({
      tier: "essential",
      description: "Title of the axis.",
    }),
  },
  codeOnly: [],
  defaults: {
    position: "bottom",
  },
  targets: [],
});
