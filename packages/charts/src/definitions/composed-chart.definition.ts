/**
 * ComposedChart definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `ComposedChartPlot` and the `ComposedChart` wrapper
 * (`charts/composed-chart.tsx`). It renders the dual-axis spec type. Its bars are `SeriesBar`
 * children, which have no part definition yet.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import type { ComposedChartProps } from "../charts/composed-chart";
import { chartStateGroup } from "../charts/props/chart-state";
import {
  analyticsCommons,
  interactionCommons,
  navigatorCommons,
  selectionCommons,
  selectionGestureCommons,
} from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { motionGroup } from "../charts/props/motion";
import { tooltipGroup } from "../charts/props/tooltip";
import {
  animationEasingField,
  annotationsField,
  aspectRatioField,
  classNameField,
  hoverCategoryField,
  loadingLabelField,
  marginField,
  revealSignatureField,
  rowsField,
  xDataKeyField,
  xScaleField,
  yDomainTweenDurationField,
} from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const COMPOSED_CHART = /* @__PURE__ */ defineChart<ComposedChartProps>()({
  id: "ComposedChart",
  version: 1,
  label: "Composed chart",
  description: "Bars, lines and areas on one time axis, on one or two value axes.",
  specTypes: ["dual-axis"],
  groups: [
    a11yGroup,
    interactionCommons.group,
    selectionCommons.group,
    navigatorCommons.group,
    selectionGestureCommons.group,
    analyticsCommons.group,
  ],
  fields: {
    data: rowsField,
    xDataKey: xDataKeyField,
    xScale: xScaleField,
    margin: marginField,
    animationDuration: motionGroup.fields.animationDuration,
    animationEasing: animationEasingField,
    enterTransition: motionGroup.fields.enterTransition,
    revealSignature: revealSignatureField,
    // No default here: `ComposedChartPlot` leaves it unset (its shell applies one).
    yDomainTweenDuration: yDomainTweenDurationField,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    className: classNameField,
    status: chartStateGroup.fields.status,
    loadingLabel: loadingLabelField,
    barSize: field.number({
      unit: "px",
      tier: "advanced",
      description: "Target width of each bar, in pixels.",
    }),
    maxBarSize: field.number({
      unit: "px",
      tier: "advanced",
      description: "Widest a bar may be, in pixels.",
    }),
    barGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between grouped bar series, in pixels.",
    }),
    stacked: field.enum({
      values: [false, true, "percent"],
      tier: "essential",
      description: "Stack the bar series at each x, or stack them to 100%.",
    }),
    stackGap: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between stacked bar segments, in pixels.",
    }),
    insetBars: field.boolean({
      tier: "advanced",
      description: "Keep the first and last column inside the plot.",
    }),
    legend: legendGroup.fields.legend,
    yAxes: field.object({
      fields: {
        align: field.enum({ values: ["independent", "ticks"] }),
        proportional: field.boolean(),
        zero: field.enum({ values: ["both", "auto"] }),
      },
      tier: "advanced",
      description: "How two value axes relate: tick alignment, proportion and the zero line.",
    }),
    annotations: annotationsField,
    tooltip: tooltipGroup.fields.tooltip,
    hoverCategory: hoverCategoryField,
  },
  codeOnly: [
    "children",
    "onPhaseChange",
    "onHoverCategory",
    ...interactionCommons.codeOnly,
    ...selectionCommons.codeOnly,
    ...navigatorCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
  ],
  defaults: {
    xDataKey: "date",
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    className: "",
    status: DEFAULT_CHART_STATUS,
    barGap: 4,
    stacked: false,
    stackGap: 0,
    insetBars: true,
    tooltip: true,
  },
  targets: [
    {
      id: "x",
      label: "X axis",
      role: "dimension",
      from: { prop: "xDataKey" },
      min: 1,
      max: 1,
    },
    {
      id: "bars",
      label: "Bar series",
      role: "measure",
      from: { part: "SeriesBar", prop: "dataKey" },
      min: 0,
      max: null,
    },
    {
      id: "lines",
      label: "Line series",
      role: "measure",
      from: { part: "Line", prop: "dataKey" },
      min: 0,
      max: null,
    },
    {
      id: "areas",
      label: "Area series",
      role: "measure",
      from: { part: "Area", prop: "dataKey" },
      min: 0,
      max: null,
    },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: { prop: "xDataKey", default: "date", requireDate: true },
    numericProps: ["animationDuration"],
    seriesFromChildren: true,
  },
});
