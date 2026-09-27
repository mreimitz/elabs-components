/**
 * BarChart definition (ADR 0042 §5, RM-175). Kind defaults match the destructuring
 * of `BarChartPlot` and the `BarChart` wrapper (`charts/bar-chart.tsx`). It also renders the
 * diverging-bar spec type (`stacked="diverging"`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING } from "../charts/animation";
import type { BarChartProps } from "../charts/bar-chart";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import {
  analyticsCommons,
  categoryNavigatorCommons,
  interactionCommons,
  selectionCommons,
  selectionGestureCommons,
} from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { motionGroup } from "../charts/props/motion";
import { paletteGroup } from "../charts/props/palette";
import { tooltipGroup } from "../charts/props/tooltip";
import {
  annotationsField,
  aspectRatioField,
  classNameField,
  loadingLabelField,
  replayOnClickField,
  revealOnField,
  revealSignatureField,
  rowsField,
  xDataKeyField,
} from "./cartesian-fields";
import { defineChart } from "./define-chart";

const sortDirection = /* @__PURE__ */ field.enum({ values: ["asc", "desc"], required: true });

export const BAR_CHART = /* @__PURE__ */ defineChart<BarChartProps>()({
  id: "BarChart",
  version: 1,
  label: "Bar chart",
  description: "Compares values across categories, grouped, stacked or diverging.",
  specTypes: ["bar", "diverging-bar"],
  groups: [
    a11yGroup,
    paletteGroup,
    interactionCommons.group,
    selectionCommons.group,
    categoryNavigatorCommons.group,
    selectionGestureCommons.group,
    analyticsCommons.group,
    frameSizeGroup,
  ],
  fields: {
    data: rowsField,
    xDataKey: xDataKeyField,
    animationDuration: motionGroup.fields.animationDuration,
    animationEasing: motionGroup.fields.animationEasing,
    enterTransition: motionGroup.fields.enterTransition,
    revealSignature: revealSignatureField,
    revealOn: revealOnField,
    replayOnClick: replayOnClickField,
    aspectRatio: aspectRatioField,
    className: classNameField,
    status: chartStateGroup.fields.status,
    loadingLabel: loadingLabelField,
    barGap: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Gap between bar groups, as a fraction of the band width.",
    }),
    barWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Fixed bar width in pixels. Unset: bars fill the band.",
    }),
    orientation: field.enum({
      values: ["vertical", "horizontal"],
      tier: "essential",
      description: "Columns (vertical) or rows of bars (horizontal).",
    }),
    stacked: field.enum({
      values: [false, true, "percent", "diverging"],
      tier: "essential",
      description: "Group the series, stack them, stack them to 100%, or diverge from zero.",
    }),
    stackGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between stacked segments, in pixels.",
    }),
    divergingCenter: field.string({
      tier: "advanced",
      appliesWhen: { field: "stacked", equals: "diverging" },
      description: "With diverging stacks: the series that straddles zero.",
    }),
    stackOrder: field.enum({
      values: ["data", "asc", "desc"],
      tier: "advanced",
      description: "Segment order inside each stack.",
    }),
    showTotals: field.boolean({
      tier: "advanced",
      description: "Print each stack’s total just past its end.",
    }),
    sort: field.union({
      of: [
        field.enum({ values: ["none", "asc", "desc"] }),
        field.object({ fields: { by: field.string({ required: true }), dir: sortDirection } }),
      ],
      tier: "essential",
      description: "Row order: as given, by value, or { by, dir } by another column.",
    }),
    reverse: field.boolean({
      tier: "advanced",
      description: "Reverse the (sorted) row order.",
    }),
    groupBy: field.string({
      tier: "advanced",
      description: "Gather rows by this column, with a header per group.",
    }),
    track: field.union({
      of: [field.boolean(), field.object({ fields: { fill: field.string() } })],
      tier: "advanced",
      description: "Paint a track behind each bar to the axis maximum, optionally in another ink.",
    }),
    overlays: field.array({
      of: field.union({
        of: [
          field.object({
            fields: {
              kind: field.enum({ values: ["value"], required: true }),
              key: field.string({ required: true }),
              label: field.string(),
              marker: field.enum({ values: ["tick", "dot"] }),
            },
          }),
          field.object({
            fields: {
              kind: field.enum({ values: ["range"], required: true }),
              lowKey: field.string({ required: true }),
              highKey: field.string({ required: true }),
              label: field.string(),
              pattern: field.enum({ values: ["solid", "stripes"] }),
              opacity: field.number(),
            },
          }),
        ],
      }),
      tier: "advanced",
      description: "Value markers and range spans drawn on top of each bar.",
    }),
    comparison: field.object({
      fields: { key: field.string({ required: true }), label: field.string() },
      tier: "advanced",
      description: "A muted prior-period column behind each main column.",
    }),
    comparisonLabel: field.enum({
      values: ["value", "difference", "none"],
      tier: "advanced",
      description: "Label beside each comparison pair: the value, the difference, or none.",
    }),
    legend: legendGroup.fields.legend,
    annotations: annotationsField,
    tooltip: tooltipGroup.fields.tooltip,
  },
  codeOnly: [
    "children",
    "onPhaseChange",
    ...interactionCommons.codeOnly,
    ...selectionCommons.codeOnly,
    ...categoryNavigatorCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
  ],
  defaults: {
    xDataKey: "name",
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    animationEasing: DEFAULT_ANIMATION_EASING,
    className: "",
    status: DEFAULT_CHART_STATUS,
    barGap: 0.2,
    orientation: "vertical",
    stacked: false,
    stackGap: 0,
    stackOrder: "data",
    showTotals: false,
    sort: "none",
    reverse: false,
    track: false,
    comparisonLabel: "none",
    tooltip: true,
  },
  targets: [
    {
      id: "x",
      label: "Category",
      role: "dimension",
      from: { prop: "xDataKey" },
      min: 1,
      max: 1,
    },
    {
      id: "series",
      label: "Series",
      role: "measure",
      from: { part: "Bar", prop: "dataKey" },
      min: 1,
      max: null,
    },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: { prop: "xDataKey", default: "name", requireDate: false },
    numericProps: ["animationDuration", "barGap", "barWidth", "stackGap"],
    seriesFromChildren: true,
  },
});
