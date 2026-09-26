/**
 * reference-marks group — reference lines and a trend line on a cartesian
 * chart (ADR 0042 §4, RM-174). Each member is the container-level form of the
 * part that paints it today: `referenceLines` holds `ReferenceLine` props,
 * `trendLine` holds `TrendLine` props. Distribution's own `referenceLines`
 * (value bands with `to`) overrides the field with its own.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ReferenceLineProps } from "../reference-line";
import type { TrendLineProps } from "../trend-line";
import { partialFieldFor } from "./typed-field";

/** The reference-marks members. */
export interface ReferenceMarksGroupProps {
  referenceLines?: readonly ReferenceLineProps[];
  trendLine?: TrendLineProps;
}

/** A series or y-axis id, as the axis parts take it. */
const axisId = /* @__PURE__ */ field.union({ of: [field.string(), field.number()] });

// No group defaults: no container declares either member yet.
export const referenceMarksGroup = /* @__PURE__ */ definePropGroup<ReferenceMarksGroupProps>()({
  id: "reference-marks",
  fields: {
    // A reducer `value` (a function of the rows) stays code-only.
    referenceLines: partialFieldFor<readonly ReferenceLineProps[]>()(
      field.array({
        of: field.object({
          fields: {
            value: field.union({
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
            }),
            of: field.string(),
            label: field.string(),
            labelPosition: field.enum({ values: ["start", "end"] }),
            yAxisId: axisId,
            strokeWidth: field.number({ unit: "px" }),
          },
        }),
        tier: "advanced",
        description:
          "Horizontal rules at a value or a statistic of the data, such as a target or the mean.",
      }),
    ),
    trendLine: field.object({
      fields: {
        dataKey: field.string({ required: true }),
        kind: field.enum({ values: ["linear", "log"] }),
        yAxisId: axisId,
        strokeWidth: field.number({ unit: "px" }),
      },
      tier: "advanced",
      description: "Least-squares trend line fitted to one series.",
    }),
  },
});
