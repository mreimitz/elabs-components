/**
 * Scatter part definition (ADR 0042 §5, RM-175): one series of a ScatterChart. Kind
 * defaults match the destructuring of `Scatter` (`charts/scatter.tsx`);
 * `sizeRange`'s is the value of `DEFAULT_SCATTER_SIZE_RANGE`, written as a value because that
 * module is not pure.
 *
 * `fill` and `stroke` have no default: ScatterChart picks the series colour from the palette
 * when neither is set. `trend = false` is the deprecated field's own default, which
 * `resolveProps` never fills.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import { paletteGroup } from "../../charts/props/palette";
import { seriesGroup } from "../../charts/props/series";
import { partialFieldFor } from "../../charts/props/typed-field";
import type { ScatterProps } from "../../charts/scatter";
import { markerShapeOptionField, yAxisIdField } from "../cartesian-fields";
import { definePart } from "../define-chart";

export const SCATTER_PART = /* @__PURE__ */ definePart<ScatterProps>()({
  id: "Scatter",
  version: 1,
  label: "Scatter series",
  description: "One series drawn as points, read from one field of each row.",
  groups: [],
  fields: {
    dataKey: seriesGroup.fields.dataKey,
    yAxisId: yAxisIdField,
    fill: field.color({
      tier: "essential",
      description: "Fill of the points. Unset: the palette colour.",
    }),
    stroke: field.color({
      tier: "advanced",
      description: "Ring colour of the points. Unset: the fill.",
    }),
    strokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of each point's ring.",
    }),
    ringGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between a point and its ring.",
    }),
    outlineWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of the outer outline.",
    }),
    outlineColor: field.color({
      tier: "advanced",
      description: "Colour of the outer outline.",
    }),
    radius: field.number({
      unit: "px",
      tier: "advanced",
      description: "Radius of each point.",
    }),
    animate: field.boolean({
      tier: "advanced",
      description: "Animate the points in.",
    }),
    fadeOnHover: field.boolean({
      tier: "advanced",
      description: "Fade the other points while one is hovered.",
    }),
    inactiveOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the faded points.",
    }),
    inactiveBlur: field.number({
      unit: "px",
      tier: "advanced",
      description: "Blur of the faded points.",
    }),
    enterBlur: field.number({
      unit: "px",
      tier: "advanced",
      description: "Blur the points animate in from.",
    }),
    showActiveHighlight: field.boolean({
      tier: "advanced",
      description: "Highlight the hovered point.",
    }),
    placement: field.enum({
      values: ["all", "ends", "first", "last"],
      tier: "advanced",
      description: "Which points get a marker.",
    }),
    pointSlot: field.string({
      tier: "advanced",
      description: "data-slot of each point's group.",
    }),
    shape: markerShapeOptionField,
    yGradient: field.union({
      of: [field.boolean(), field.object({ fields: { from: field.color(), to: field.color() } })],
      tier: "advanced",
      description: "Colour each point by its height, between two colours.",
    }),
    dropLines: field.enum({
      values: ["x", "y", "both", false],
      tier: "advanced",
      description: "Hairlines from each point to the x axis, the y axis, or both.",
    }),
    // A `format` function inside the config stays code-only.
    labelExtremes: partialFieldFor<ScatterProps["labelExtremes"]>()(
      field.object({
        fields: {
          by: field.enum({ values: ["y", "x"], required: true }),
          count: field.number(),
          labelKey: field.string(),
        },
        tier: "advanced",
        description: "Label the highest and lowest points and fade the rest.",
      }),
    ),
    fadedOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the points labelExtremes does not pick.",
    }),
    jitter: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Deterministic jitter across the row band, for category rows.",
    }),
    yType: field.enum({
      values: ["number", "category"],
      tier: "advanced",
      description: "Read the values as numbers, or as category rows.",
    }),
    // A predicate function stays code-only.
    highlightKey: partialFieldFor<ScatterProps["highlightKey"]>()(
      field.string({
        tier: "advanced",
        description: "Field whose truthy rows get a highlight ring.",
      }),
    ),
    sizeKey: field.string({
      tier: "advanced",
      description: "Field that sizes each point by area, as a bubble chart.",
    }),
    sizeRange: field.array({
      of: field.number({ unit: "px" }),
      min: 2,
      max: 2,
      tier: "advanced",
      description: "Smallest and largest bubble radius, in pixels.",
    }),
    colorBy: paletteGroup.fields.colorBy,
    shapeBy: field.object({
      fields: {
        key: field.string({ required: true }),
        shapes: field.array({ of: markerShapeOptionField }),
      },
      tier: "advanced",
      description: "Shape each point by the values of one field.",
    }),
    trend: field.enum({
      values: ["linear", "log", false],
      default: false,
      deprecated: { since: "5.4.0", replacement: "analytics", removeIn: "6.0.0" },
      tier: "advanced",
      description: "A least-squares trend line. Use the chart's trend analytic.",
    }),
    // A predicate `mode` and a `priority` function stay code-only.
    labels: partialFieldFor<ScatterProps["labels"]>()(
      field.object({
        fields: {
          key: field.string({ required: true }),
          mode: field.enum({ values: ["auto", "all"] }),
        },
        tier: "advanced",
        description: "Label the points from one field, skipping collisions.",
      }),
    ),
  },
  codeOnly: [],
  defaults: {
    strokeWidth: 2,
    ringGap: 2,
    outlineWidth: 0,
    radius: 5,
    animate: true,
    fadeOnHover: true,
    inactiveOpacity: 0.5,
    inactiveBlur: 2,
    enterBlur: 2,
    showActiveHighlight: true,
    dropLines: false,
    fadedOpacity: 0.35,
    yType: "number",
    sizeRange: [4, 22],
  },
  targets: [],
});
