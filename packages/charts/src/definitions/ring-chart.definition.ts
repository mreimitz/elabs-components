/**
 * RingChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `RingChartBase` (`charts/ring-chart.tsx`). Renders no `ChartSpec` type: `AutoChart`
 * has no ring-chart inference path today.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { interactionCommons, selectionCommons } from "../charts/props/commons";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { RingChartProps } from "../charts/ring-chart";
import { looseFieldFor, partialFieldFor } from "../charts/props/typed-field";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const RING_CHART = /* @__PURE__ */ defineChart<RingChartProps>()({
  id: "RingChart",
  version: 1,
  label: "Ring chart",
  description: "One proportion against its maximum, read as a single ring.",
  specTypes: [],
  // RM-183 (F28): Ring shares Pie's frame-size/chart-state groups at the prop
  // level, before the engine merge (RM-202). Not `valueFormatGroup` (RM-183
  // review fix3): Ring has no value-formatted on-chart text yet, so none of
  // that group's members would take effect — see `RingChartProps`' docblock.
  groups: [
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    frameSizeGroup,
    chartStateGroup,
  ],
  fields: {
    data: looseFieldFor<RingChartProps["data"]>()(
      field.array({
        of: field.object({
          fields: {
            label: field.string({ required: true }),
            value: field.number({ required: true }),
            maxValue: field.number({ required: true }),
          },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "Rings: a label, a value and its maximum per row.",
      }),
    ),
    size: field.number({ unit: "px", tier: "advanced", description: "Fixed pixel size." }),
    plotHeight: frameSizeGroup.fields.plotHeight,
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    empty: chartStateGroup.fields.empty,
    strokeWidth: field.number({
      unit: "px",
      tier: "essential",
      description: "Ring thickness.",
    }),
    ringGap: field.number({ unit: "px", tier: "advanced", description: "Gap between rings." }),
    baseInnerRadius: field.number({
      unit: "px",
      tier: "advanced",
      description: "Inner radius of the outermost ring.",
    }),
    animationDuration: field.number({
      unit: "ms",
      tier: "advanced",
      description: "Length of the entry animation, in milliseconds.",
    }),
    className: classNameField,
    startAngle: field.number({ tier: "advanced", description: "Start angle, in radians." }),
    endAngle: field.number({ tier: "advanced", description: "End angle, in radians." }),
    enterStaggerScale: field.number({
      tier: "advanced",
      description: "Scales the entry stagger delay between rings.",
    }),
    geometryScrubbing: field.boolean({
      tier: "advanced",
      description: "Animate ring geometry directly instead of fading between states.",
    }),
    labels: partialFieldFor<RingChartProps["labels"]>()(
      field.union({
        of: [
          field.enum({ values: ["outside"] }),
          field.object({ fields: { placement: field.enum({ values: ["outside", "none"] }) } }),
        ],
        tier: "advanced",
        description: "Where each ring’s label is drawn.",
      }),
    ),
  },
  codeOnly: [
    "children",
    "hoveredIndex",
    "onHoverChange",
    "enterTransition",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    strokeWidth: 12,
    ringGap: 6,
    baseInnerRadius: 60,
    className: "",
    startAngle: -Math.PI / 2,
    endAngle: (3 * Math.PI) / 2,
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    enterStaggerScale: 1,
    geometryScrubbing: false,
  },
  targets: [
    {
      id: "category",
      label: "Category",
      role: "dimension",
      from: { field: "label" },
      min: 1,
      max: 1,
    },
    { id: "value", label: "Value", role: "measure", from: { field: "value" }, min: 1, max: 1 },
    { id: "max", label: "Maximum", role: "measure", from: { field: "maxValue" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    itemRequiredKeys: ["label", "value", "maxValue"],
    itemNumericKeys: ["value", "maxValue"],
  },
});
