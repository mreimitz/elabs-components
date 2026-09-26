/**
 * DumbbellChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `DumbbellChartBase` (`charts/dumbbell-chart.tsx`); `markers`'s default is that
 * module's own constant, written as its value because that module is not pure. `palette`
 * and `valueFormat` have no kind default despite their doc comments: both stay bare in the
 * destructuring, resolved elsewhere.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { interactionCommons, selectionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { paletteGroup } from "../charts/props/palette";
import { valueFormatGroup } from "../charts/props/value-format";
import type { DumbbellChartProps } from "../charts/dumbbell-chart";
import { annotationsField, aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

/** `dumbbell-chart.tsx`'s own constant — not exported, and that module renders JSX, so the
 * value is copied rather than imported. */
const DEFAULT_MARKERS = { start: "hollow", end: "filled" } as const;

export const DUMBBELL_CHART = /* @__PURE__ */ defineChart<DumbbellChartProps>()({
  id: "DumbbellChart",
  version: 1,
  label: "Dumbbell chart",
  description: "A before/after pair per category, as two markers on one track.",
  specTypes: ["dumbbell"],
  groups: [a11yGroup, selectionCommons.group, interactionCommons.group, frameSizeGroup],
  fields: {
    data: field.array({
      of: field.object({ fields: {}, open: true }),
      required: true,
      tier: "essential",
      description: "One row per category.",
    }),
    category: field.string({
      required: true,
      tier: "essential",
      description: "Row field for the category label.",
    }),
    startKey: field.string({
      required: true,
      tier: "essential",
      description: "Row field for the “before” value.",
    }),
    endKey: field.string({
      required: true,
      tier: "essential",
      description: "Row field for the “after” value.",
    }),
    orientation: field.enum({
      values: ["horizontal", "vertical"],
      tier: "essential",
      description: "Rows or columns. Ignored by the slope variant.",
    }),
    variant: field.enum({
      values: ["dumbbell", "slope", "arrow", "dots"],
      tier: "essential",
      description: "dumbbell: one track per category. slope: two columns, one line per category.",
    }),
    extraKeys: field.array({
      of: field.string(),
      tier: "advanced",
      description: "Extra numeric keys drawn as small dots on the same track.",
    }),
    valueKeys: field.array({
      of: field.string(),
      tier: "advanced",
      description: "variant=dots only: numeric keys drawn as one dot per key.",
    }),
    range: field.boolean({
      tier: "advanced",
      description: "variant=dots only: draws a bar between the row's lowest and highest dot.",
    }),
    arrowWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "variant=arrow only: the arrow head's base width.",
    }),
    groupBy: field.string({
      tier: "advanced",
      description: "Buckets rows by this column, with a header before each group.",
    }),
    showDelta: field.boolean({
      tier: "essential",
      description: "Show a signed delta label at the end marker.",
    }),
    bothEndsLabeled: field.boolean({
      tier: "advanced",
      description: "variant=slope only: label the end of each line with its category too.",
    }),
    showValueAxis: field.boolean({
      tier: "advanced",
      description: "Draws light tick marks + value labels along the value scale.",
    }),
    sortBy: field.enum({
      values: ["start", "end", "delta", "deltaPercent", "data", "label", "none"],
      tier: "advanced",
      description: "How rows are sorted before rendering.",
    }),
    reverse: field.boolean({
      tier: "advanced",
      description: "Reverses the order sortBy resolves to.",
    }),
    palette: paletteGroup.fields.palette,
    valueFormat: valueFormatGroup.fields.valueFormat,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    className: classNameField,
    annotations: annotationsField,
    legend: legendGroup.fields.legend,
    startLabel: field.string({
      tier: "advanced",
      description: "legend's start-marker entry label, two-marker variants only.",
    }),
    endLabel: field.string({
      tier: "advanced",
      description: "legend's end-marker entry label, two-marker variants only.",
    }),
  },
  codeOnly: [
    "beads",
    "markers",
    "keyColors",
    "deltaLabelFormat",
    "delta",
    "valueLabelFormat",
    "referenceLine",
    "valueAxis",
    "rowColor",
    "analytics",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    orientation: "horizontal",
    variant: "dumbbell",
    markers: DEFAULT_MARKERS,
    range: false,
    showDelta: false,
    bothEndsLabeled: false,
    showValueAxis: false,
    sortBy: "none",
    reverse: false,
    copyValueOnActivate: false,
    status: DEFAULT_CHART_STATUS,
  },
  targets: [
    {
      id: "category",
      label: "Category",
      role: "dimension",
      from: { prop: "category" },
      min: 1,
      max: 1,
    },
    { id: "start", label: "Start", role: "measure", from: { prop: "startKey" }, min: 1, max: 1 },
    { id: "end", label: "End", role: "measure", from: { prop: "endKey" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "category", "startKey", "endKey"],
    hasStatus: false,
    dynamicKeys: [
      { prop: "category" },
      { prop: "startKey", numeric: true },
      { prop: "endKey", numeric: true },
    ],
    keyProps: [{ prop: "groupBy", numeric: false }],
  },
});
