/**
 * FunnelChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `FunnelChartBody` (`charts/funnel-chart.tsx`). `grid` is described only as a boolean:
 * the richer `{ bands?, bandColor?, lines?, lineColor?, lineOpacity?, lineWidth? }` form is
 * left to code, since none of its members has a kind default to verify against.
 *
 * `valueFormatGroup` itself is NOT listed in `groups` below (RM-183 review fix3): Funnel
 * takes only `valueFormat`/`currency`/`maxFractionDigits`, not the group's `locale`
 * (dropped — the formatter behind `valueFormat` always reads the ambient `useLocale()`
 * instead, see `FunnelChartProps`' docblock in `charts/funnel-chart.tsx`). Listing the
 * group would resurface `locale` as an effective field anyway (`planOf` merges in every
 * listed group's fields regardless of `fields`, `effective-fields.ts`) — the exact
 * silent-prop bug this review round closes — so the three kept members stay own fields
 * below, referencing the group's field objects directly, same pattern as `UnitChart`'s
 * partial `tooltipGroup`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { interactionCommons } from "../charts/props/commons";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import type { FunnelChartProps } from "../charts/funnel-chart";
import { looseFieldFor, partialFieldFor } from "../charts/props/typed-field";
import { valueFormatGroup } from "../charts/props/value-format";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const FUNNEL_CHART = /* @__PURE__ */ defineChart<FunnelChartProps>()({
  id: "FunnelChart",
  version: 1,
  label: "Funnel chart",
  description: "A sequential process with drop-off between stages.",
  specTypes: ["funnel"],
  groups: [a11yGroup, interactionCommons.group, frameSizeGroup, chartStateGroup],
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
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    empty: chartStateGroup.fields.empty,
    valueFormat: valueFormatGroup.fields.valueFormat,
    currency: valueFormatGroup.fields.currency,
    maxFractionDigits: valueFormatGroup.fields.maxFractionDigits,
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
    // Wave-2 review fix: `FunnelChartBody` destructures `grid: gridProp =
    // false` (`charts/funnel-chart.tsx`) — this default was missing here.
    grid: false,
  },
  targets: [
    { id: "stage", label: "Stage", role: "dimension", from: { field: "label" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { field: "value" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data"],
    hasStatus: true,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
});
