/**
 * LiveLineChart definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `LiveLineChart` (`charts/live-line-chart.tsx`); `lerpSpeed`'s is the
 * module constant `LERP_SPEED` (0.08), written as its value because that module is not pure.
 * No `ChartSpec` type renders it, and its rows are fixed `{ time, value }` points.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import type { LiveLineChartProps } from "../charts/live-line-chart";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

export const LIVE_LINE_CHART = /* @__PURE__ */ defineChart<LiveLineChartProps>()({
  id: "LiveLineChart",
  version: 1,
  label: "Live line chart",
  description: "A streaming value drawn as it arrives, over a moving time window.",
  specTypes: [],
  groups: [a11yGroup, frameSizeGroup],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: field.array({
      of: field.object({
        fields: {
          time: field.number({ required: true, unit: "s" }),
          value: field.number({ required: true }),
        },
      }),
      required: true,
      tier: "essential",
      description: "Streamed points: { time, value }, with time in unix seconds.",
    }),
    value: field.number({
      required: true,
      tier: "essential",
      description: "Latest value; the line eases towards it.",
    }),
    dataKey: field.string({
      tier: "advanced",
      description: "Key the value is published under in the chart context.",
    }),
    window: field.number({
      unit: "s",
      tier: "essential",
      description: "Visible time window, in seconds.",
    }),
    numXTicks: field.number({
      tier: "advanced",
      description: "Number of x-axis ticks, used to place the leading offset.",
    }),
    nowOffsetUnits: field.number({
      tier: "advanced",
      description: "Leading offset in x-tick units (0 puts now at the right edge).",
    }),
    exaggerate: field.boolean({
      tier: "advanced",
      description: "Fit the value axis tightly around the data.",
    }),
    lerpSpeed: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "How fast the line eases towards a new value (0–1).",
    }),
    paused: field.boolean({
      tier: "advanced",
      description: "Freeze the scrolling.",
    }),
    className: classNameField,
    status: chartStateGroup.fields.status,
  },
  codeOnly: ["children", "style"],
  defaults: {
    dataKey: "value",
    window: 30,
    numXTicks: 5,
    nowOffsetUnits: 0,
    exaggerate: false,
    lerpSpeed: 0.08,
    paused: false,
    status: DEFAULT_CHART_STATUS,
  },
  targets: [
    { id: "time", label: "Time", role: "dimension", from: { field: "time" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { field: "value" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children", "value"],
    hasStatus: false,
    itemRequiredKeys: ["time", "value"],
    itemNumericKeys: ["time", "value"],
  },
});
