/**
 * WaterfallChart definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `WaterfallChart` (`charts/waterfall-chart.tsx`); the three fills are its
 * module constants, written as their values because that module is not pure.
 *
 * `height` is the deprecated alias of `plotHeight`: described as a deprecated field (it
 * validates with a warning, and is never filled), not as an alias row, because the component
 * reads it itself today and logs its own warning.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { analyticsCommons, interactionCommons, selectionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { valueFormatGroup } from "../charts/props/value-format";
import type { WaterfallChartProps } from "../charts/waterfall-chart";
import { annotationsField, classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";
import { messagesGroup } from "../charts/props/messages";

const endpointFields = {
  show: /* @__PURE__ */ field.boolean(),
  label: /* @__PURE__ */ field.string(),
} as const;

export const WATERFALL_CHART = /* @__PURE__ */ defineChart<WaterfallChartProps>()({
  id: "WaterfallChart",
  version: 1,
  label: "Waterfall chart",
  description: "How a starting total becomes an ending total, one signed step at a time.",
  specTypes: ["waterfall"],
  groups: [
    messagesGroup,
    a11yGroup,
    frameSizeGroup,
    interactionCommons.group,
    analyticsCommons.group,
    selectionCommons.group,
  ],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: field.array({
      of: field.object({
        fields: {
          label: field.string({ required: true }),
          value: field.number({ required: true }),
          kind: field.enum({ values: ["step", "total", "subtotal"] }),
        },
        open: true,
      }),
      required: true,
      tier: "essential",
      description: "Steps from the first total to the last: one row per bar.",
    }),
    orientation: field.enum({
      values: ["vertical", "horizontal"],
      tier: "essential",
      description: "Columns (vertical) or rows of bars (horizontal).",
    }),
    showValues: field.boolean({
      tier: "essential",
      description: "Print the signed value on each step.",
    }),
    connectors: field.enum({
      values: [true, false, "thin", "thick"],
      tier: "advanced",
      description: "Hairline from each step’s end to the next step’s start: none, thin or thick.",
    }),
    dataFormat: field.enum({
      values: ["differences", "runningTotals"],
      tier: "essential",
      description: "Whether each row’s value is a signed change or the running total.",
    }),
    subtotalBy: field.string({
      tier: "advanced",
      description: "Insert a subtotal after each run of rows sharing this field’s value.",
    }),
    subtotalLabel: field.string({
      tier: "advanced",
      description: "Label of an inserted subtotal: a template with {group}. Needs subtotalBy.",
    }),
    sort: field.enum({
      values: ["data", "increasesFirst", "decreasesFirst"],
      tier: "advanced",
      description: "Order of the steps within each subtotal group.",
    }),
    start: field.object({
      fields: endpointFields,
      tier: "advanced",
      description: "Show or relabel the first column.",
    }),
    end: field.object({
      fields: endpointFields,
      tier: "advanced",
      description: "Show or relabel the last column.",
    }),
    zoomToDifferences: field.boolean({
      tier: "advanced",
      description: "Drop the zero baseline when the totals dwarf the steps.",
    }),
    labels: field.object({
      fields: {
        totals: field.enum({ values: ["all", "totalsOnly"], required: true }),
        differences: field.enum({ values: ["absolute", "percent", "none"] }),
        placement: field.enum({ values: ["inside", "outside"] }),
        matchColor: field.boolean(),
      },
      tier: "advanced",
      description: "Which rows carry a value label, and how the differences read.",
    }),
    grid: field.boolean({
      tier: "advanced",
      description: "Draw the value-axis gridlines.",
    }),
    positiveFill: field.color({
      tier: "advanced",
      description: "Fill of an increasing step.",
    }),
    negativeFill: field.color({
      tier: "advanced",
      description: "Fill of a decreasing step.",
    }),
    totalFill: field.color({
      tier: "advanced",
      description: "Fill of a total row.",
    }),
    unit: field.number({
      tier: "advanced",
      description: "Draw each bar as a stack of rungs, one per this much value.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    callouts: field.array({
      of: field.object({
        fields: { label: field.string({ required: true }), note: field.string({ required: true }) },
      }),
      tier: "advanced",
      description: "The steps that explain the bridge, named on the chart with a note.",
    }),
    height: field.number({
      unit: "px",
      tier: "advanced",
      deprecated: { since: "5.0.0", replacement: "plotHeight", removeIn: "6.0.0" },
      description: "Height of the plot in pixels. Use plotHeight.",
    }),
    className: classNameField,
    annotations: annotationsField,
    status: chartStateGroup.fields.status,
  },
  codeOnly: [...interactionCommons.codeOnly, ...selectionCommons.codeOnly],
  defaults: {
    connectors: true,
    dataFormat: "differences",
    grid: true,
    // Rises and falls wear the theme's first two series colours — the same pair a
    // two-series BarChart draws — so a bridge reads in the theme's own chart colours.
    negativeFill: "var(--chart-2)",
    orientation: "vertical",
    positiveFill: "var(--chart-1)",
    showValues: true,
    sort: "data",
    totalFill: "var(--chart-foreground)",
    status: DEFAULT_CHART_STATUS,
  },
  targets: [
    { id: "step", label: "Step", role: "dimension", from: { field: "label" }, min: 1, max: 1 },
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
