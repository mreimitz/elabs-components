/**
 * FunnelChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `FunnelChartBody` (`charts/funnel-chart.tsx`). `grid` is described only as a boolean:
 * the richer `{ bands?, bandColor?, lines?, lineColor?, lineOpacity?, lineWidth? }` form is
 * left to code, since none of its members has a kind default to verify against.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { interactionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import type { FunnelChartProps } from "../charts/funnel-chart";
import { looseFieldFor, partialFieldFor } from "../charts/props/typed-field";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const FUNNEL_CHART = /* @__PURE__ */ defineChart<FunnelChartProps>()({
  id: "FunnelChart",
  version: 1,
  label: "Funnel chart",
  description: "A sequential process with drop-off between stages.",
  specTypes: ["funnel"],
  groups: [a11yGroup, interactionCommons.group],
  fields: {
    data: looseFieldFor<FunnelChartProps["data"]>()(
      field.array({
        of: field.object({
          fields: {
            label: field.string({ required: true }),
            value: field.number({ required: true }),
          },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "Stages, from first to last.",
      }),
    ),
    orientation: field.enum({
      values: ["horizontal", "vertical"],
      tier: "essential",
      description: "Stages laid out as rows or as columns.",
    }),
    color: field.color({ tier: "advanced", description: "Fill of every stage without its own." }),
    layers: field.number({ tier: "advanced", description: "Halo ring layers around each stage." }),
    className: classNameField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    showPercentage: field.boolean({
      tier: "essential",
      description: "Print each stage’s share of the first stage.",
    }),
    showValues: field.boolean({ tier: "essential", description: "Print each stage’s value." }),
    showLabels: field.boolean({ tier: "essential", description: "Print each stage’s label." }),
    staggerDelay: field.number({ tier: "advanced", description: "Entry delay between stages." }),
    gap: field.number({ unit: "px", tier: "advanced", description: "Gap between stages." }),
    edges: field.enum({
      values: ["curved", "straight"],
      tier: "advanced",
      description: "Stage silhouette: curved or straight sides.",
    }),
    labelLayout: field.enum({
      values: ["spread", "grouped"],
      tier: "advanced",
      description: "Label/value/percent spread apart or grouped together.",
    }),
    labelOrientation: field.enum({
      values: ["vertical", "horizontal"],
      tier: "advanced",
      description: "Reading direction of the stage labels.",
    }),
    labelAlign: field.enum({
      values: ["center", "start", "end"],
      tier: "advanced",
      description: "Alignment of the stage labels.",
    }),
    showConversion: field.enum({
      values: [false, "between", "margin"],
      tier: "advanced",
      description:
        "Show the stage-to-stage conversion rate: none, between stages or as a margin note.",
    }),
    grid: partialFieldFor<FunnelChartProps["grid"]>()(
      field.boolean({ tier: "advanced", description: "Draw a reference grid behind the funnel." }),
    ),
    legend: legendGroup.fields.legend,
    seriesLabel: field.string({
      tier: "advanced",
      description: "Name of the measure, used in the legend and accessible description.",
    }),
  },
  codeOnly: [
    "hoveredIndex",
    "onHoverChange",
    "formatPercentage",
    "formatValue",
    "enterTransition",
    "renderPattern",
    "style",
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    orientation: "horizontal",
    color: "var(--chart-1)",
    layers: 3,
    showPercentage: true,
    showValues: true,
    showLabels: true,
    staggerDelay: 0.12,
    gap: 4,
    edges: "curved",
    labelLayout: "spread",
    labelAlign: "center",
    showConversion: false,
  },
  targets: [
    { id: "stage", label: "Stage", role: "dimension", from: { field: "label" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { field: "value" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data"],
    hasStatus: false,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
});
