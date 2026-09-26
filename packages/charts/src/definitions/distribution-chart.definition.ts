/**
 * DistributionChart definition (ADR 0042 §5, RM-176). Kind defaults match the
 * destructuring of `DistributionChart` (`charts/distribution/distribution-chart.tsx`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import {
  analyticsCommons,
  interactionCommons,
  selectionGestureCommons,
} from "../charts/props/commons";
import { paletteGroup } from "../charts/props/palette";
import { valueFormatGroup } from "../charts/props/value-format";
import type { DistributionChartProps } from "../charts/distribution/distribution-chart";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const DISTRIBUTION_CHART = /* @__PURE__ */ defineChart<DistributionChartProps>()({
  id: "DistributionChart",
  version: 1,
  label: "Distribution chart",
  description: "The spread of one numeric column, as a histogram, box, violin or strip.",
  specTypes: ["histogram", "box", "strip"],
  groups: [
    a11yGroup,
    interactionCommons.group,
    selectionGestureCommons.group,
    analyticsCommons.group,
  ],
  fields: {
    data: field.array({
      of: field.object({ fields: {}, open: true }),
      required: true,
      tier: "essential",
      description: "One row per observation.",
    }),
    valueKey: field.string({
      required: true,
      tier: "essential",
      description: "The numeric column.",
    }),
    groupKey: field.string({
      tier: "essential",
      description: "The grouping column. Omit for a single, ungrouped distribution.",
    }),
    kind: field.enum({
      values: ["histogram", "box", "violin", "strip"],
      required: true,
      tier: "essential",
      description: "Which mark to draw.",
    }),
    orientation: field.enum({
      values: ["horizontal", "vertical"],
      tier: "essential",
      description: "Which screen axis the value runs along.",
    }),
    bins: field.union({
      of: [field.number(), field.array({ of: field.number() })],
      tier: "advanced",
      description: "Histogram only: a bin count hint, or the full ordered edge list.",
    }),
    bandwidth: field.number({ tier: "advanced", description: "Violin only: KDE bandwidth." }),
    showMedian: field.boolean({ tier: "essential", description: "Draw the median." }),
    showOutliers: field.boolean({
      tier: "essential",
      description: "Box only: hollow marks beyond 1.5× IQR.",
    }),
    unit: field.number({
      tier: "advanced",
      description: "Histogram only: records per rung, drawn as countable rungs.",
    }),
    unitLabel: field.string({
      tier: "advanced",
      description: "Legend for unit, e.g. “one rung = 5 tickets”.",
    }),
    palette: paletteGroup.fields.palette,
    valueFormat: valueFormatGroup.fields.valueFormat,
    currency: valueFormatGroup.fields.currency,
    className: classNameField,
  },
  codeOnly: [
    "referenceLines",
    "style",
    ...interactionCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
    ...analyticsCommons.codeOnly,
  ],
  defaults: {
    orientation: "horizontal",
    showMedian: true,
    showOutliers: true,
  },
  targets: [
    { id: "value", label: "Value", role: "measure", from: { prop: "valueKey" }, min: 1, max: 1 },
    { id: "group", label: "Group", role: "dimension", from: { prop: "groupKey" }, min: 0, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "valueKey", "kind"],
    keyProps: [
      { prop: "valueKey", numeric: true },
      { prop: "groupKey", numeric: false },
    ],
  },
});
