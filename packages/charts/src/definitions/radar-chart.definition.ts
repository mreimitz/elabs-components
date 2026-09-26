/**
 * RadarChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `RadarChartInner`/its outer wrapper (`charts/radar-chart.tsx`). No interaction or
 * selection commons: `RadarChartProps` has neither — only hover state, which is codeOnly.
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
import { defineChart } from "./define-chart";

export const RADAR_CHART = /* @__PURE__ */ defineChart<RadarChartProps>()({
  id: "RadarChart",
  version: 1,
  label: "Radar chart",
  description: "A few series across several metrics, read as overlapping polygons.",
  specTypes: ["radar"],
  // RM-183 (F33): `margin` stays a kind override (a plain number, not the
  // shared frame-size shape) — `frameSizeGroup` is never listed here.
  groups: [a11yGroup, chartStateGroup, valueFormatGroup],
  fields: {
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
    margin: field.number({ unit: "px", tier: "advanced", description: "Margin around the chart." }),
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
    locale: valueFormatGroup.fields.locale,
    currency: valueFormatGroup.fields.currency,
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
