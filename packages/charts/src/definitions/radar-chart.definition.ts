/**
 * RadarChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `RadarChartInner`/its outer wrapper (`charts/radar-chart.tsx`). No interaction or
 * selection commons: `RadarChartProps` has neither — only hover state, which is codeOnly.
 *
 * `valueFormatGroup` itself is NOT listed in `groups` below: the members stay own
 * fields referencing the group's field objects (same pattern as `UnitChart`'s partial
 * `tooltipGroup`). RM-183 took only `valueFormat`/`currency` (`useContainerLegend`'s
 * value column had no seam for the rest); RM-187 added that seam, so `locale` and
 * `maxFractionDigits` are listed too — both reach the legend's value column.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import type { RadarChartProps } from "../charts/radar-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { valueFormatGroup } from "../charts/props/value-format";
import { classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

export const RADAR_CHART = /* @__PURE__ */ defineChart<RadarChartProps>()({
  id: "RadarChart",
  version: 1,
  label: "Radar chart",
  description: "A few series across several metrics, read as overlapping polygons.",
  specTypes: ["radar"],
  // RM-183 (F33): `frameSizeGroup` adds `margin` (`plotHeight` was already an
  // own field referencing the group, below).
  groups: [a11yGroup, frameSizeGroup, chartStateGroup],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: looseFieldFor<RadarChartProps["data"]>()(
      field.array({
        of: field.object({
          fields: { label: field.string({ required: true }) },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "Series: one polygon per row, with a value per metric.",
      }),
    ),
    metrics: field.array({
      of: field.object({
        fields: {
          key: field.string({ required: true }),
          label: field.string({ required: true }),
        },
      }),
      required: true,
      tier: "essential",
      description: "Axes of the radar, in order.",
    }),
    size: field.number({ unit: "px", tier: "advanced", description: "Fixed pixel size." }),
    levels: field.number({
      tier: "essential",
      description: "Number of concentric grid circles.",
    }),
    margin: frameSizeGroup.fields.margin,
    animate: field.boolean({ tier: "advanced", description: "Enable entry animation." }),
    enterDurationMs: field.number({
      unit: "ms",
      tier: "advanced",
      description: "Entry animation budget.",
    }),
    staggerScale: field.number({
      tier: "advanced",
      description: "Scales the entry stagger delay between series.",
    }),
    motionReplayKey: field.string({
      tier: "advanced",
      description: "Changes to replay the entry animation.",
    }),
    className: classNameField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    legend: legendGroup.fields.legend,
    status: chartStateGroup.fields.status,
    empty: chartStateGroup.fields.empty,
    valueFormat: valueFormatGroup.fields.valueFormat,
    currency: valueFormatGroup.fields.currency,
    locale: valueFormatGroup.fields.locale,
    maxFractionDigits: valueFormatGroup.fields.maxFractionDigits,
  },
  codeOnly: ["children", "hoveredIndex", "onHoverChange", "enterTransition"],
  defaults: {
    levels: 5,
    margin: 60,
    animate: true,
    enterDurationMs: DEFAULT_ANIMATION_DURATION_MS,
    staggerScale: 1,
    motionReplayKey: "",
    className: "",
  },
  targets: [
    {
      id: "category",
      label: "Series",
      role: "dimension",
      from: { field: "label" },
      min: 1,
      max: 1,
    },
    {
      id: "metrics",
      label: "Metrics",
      role: "measure",
      from: { prop: "metrics" },
      min: 1,
      max: 1,
    },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "metrics", "children"],
    hasStatus: true,
    itemRequiredKeys: ["label", "values"],
  },
});
