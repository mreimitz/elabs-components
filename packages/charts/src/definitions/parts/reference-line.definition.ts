/**
 * ReferenceLine part definition (ADR 0042 §5, RM-175): a horizontal rule at a value or a
 * statistic of the data. Kind defaults match the destructuring of `ReferenceLine`
 * (`charts/reference-line.tsx`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import { partialFieldFor } from "../../charts/props/typed-field";
import type { ReferenceLineProps } from "../../charts/reference-line";
import { yAxisIdField } from "../cartesian-fields";
import { definePart } from "../define-chart";

export const REFERENCE_LINE_PART = /* @__PURE__ */ definePart<ReferenceLineProps>()({
  id: "ReferenceLine",
  version: 1,
  label: "Reference line",
  description: "A horizontal rule at a value or a statistic of the data, such as a target.",
  groups: [],
  fields: {
    // A reducer function stays code-only.
    value: partialFieldFor<ReferenceLineProps["value"]>()(
      field.union({
        required: true,
        of: [
          field.number(),
          field.enum({ values: ["mean", "median", "min", "max", "sum"] }),
          field.object({ fields: { percentile: field.number({ required: true }) } }),
          field.object({
            fields: {
              stddev: field.number({ required: true }),
              around: field.enum({ values: ["mean", "median"] }),
              sample: field.boolean(),
            },
          }),
        ],
        tier: "essential",
        description: "Where the line sits: a value, or a statistic of the series.",
      }),
    ),
    of: field.string({
      tier: "essential",
      description: "Series the statistic is computed from, or all.",
    }),
    // `AnalyticLabelMode` is `(string & {})`-widened, which the field vocabulary reads as an object.
    label: partialFieldFor<ReferenceLineProps["label"]>()(
      field.string({
        tier: "essential",
        description: "Label: computation, value, none, or your own text.",
      }),
    ),
    labelPosition: field.enum({
      values: ["start", "end"],
      tier: "advanced",
      description: "End of the line the label sits at.",
    }),
    yAxisId: yAxisIdField,
    strokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of the line.",
    }),
  },
  codeOnly: [],
  defaults: {
    labelPosition: "end",
    strokeWidth: 1.5,
  },
  targets: [],
});
