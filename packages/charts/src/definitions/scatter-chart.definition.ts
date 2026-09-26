/**
 * ScatterChart definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `ScatterChartBase` and the `ScatterChart` wrapper
 * (`charts/scatter-chart.tsx`).
 *
 * `enterTransition = DEFAULT_CHART_ENTER_TRANSITION` is not a kind default here: its easing is
 * a cubic-bezier array, which the enter-transition field cannot describe, so the default
 * would not validate. The component keeps applying it.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import {
  analyticsCommons,
  selectionCommons,
  selectionGestureCommons,
} from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { motionGroup } from "../charts/props/motion";
import { tooltipGroup } from "../charts/props/tooltip";
import type { ScatterChartProps } from "../charts/scatter-chart";
import {
  animationEasingField,
  aspectRatioField,
  classNameField,
  revealSignatureField,
  rowsField,
  xDataKeyField,
} from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const SCATTER_CHART = /* @__PURE__ */ defineChart<ScatterChartProps>()({
  id: "ScatterChart",
  version: 1,
  label: "Scatter chart",
  description: "Two continuous measures per row: correlation, or the shape of a distribution.",
  specTypes: ["scatter"],
  groups: [
    a11yGroup,
    selectionCommons.group,
    selectionGestureCommons.group,
    analyticsCommons.group,
    frameSizeGroup,
  ],
  fields: {
    data: rowsField,
    xDataKey: xDataKeyField,
    xScale: field.enum({
      values: ["time", "linear"],
      tier: "advanced",
      description: "Scale of the x axis: time or linear numbers.",
    }),
    animationDuration: motionGroup.fields.animationDuration,
    animationEasing: animationEasingField,
    enterTransition: motionGroup.fields.enterTransition,
    revealSignature: revealSignatureField,
    aspectRatio: aspectRatioField,
    className: classNameField,
    status: chartStateGroup.fields.status,
    legend: legendGroup.fields.legend,
    tooltip: tooltipGroup.fields.tooltip,
  },
  codeOnly: [
    "children",
    "onPhaseChange",
    ...selectionCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
  ],
  defaults: {
    xDataKey: "date",
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    className: "",
    status: DEFAULT_CHART_STATUS,
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
      id: "series",
      label: "Series",
      role: "measure",
      from: { part: "Scatter", prop: "dataKey" },
      min: 1,
      max: null,
    },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    xKey: { prop: "xDataKey", default: "date", requireDate: false },
    numericProps: ["animationDuration"],
    seriesFromChildren: true,
  },
});
