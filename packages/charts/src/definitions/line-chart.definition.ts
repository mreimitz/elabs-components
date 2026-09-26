/**
 * LineChart definition (ADR 0042 §5, RM-175). Kind defaults match the destructuring
 * of `LineChartPlot` and the `LineChart` wrapper (`charts/line-chart.tsx`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS } from "../charts/chart-phase";
import type { LineChartProps } from "../charts/line-chart";
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
  focusOnHoverField,
  hoverCategoryField,
  loadingLabelField,
  nullsField,
  replayOnClickField,
  revealOnField,
  revealSignatureField,
  rowsField,
  tweenYDomainOnXDomainChangeField,
  xDataKeyField,
  xDomainSlotCountField,
  xScaleField,
  yDomainTweenDurationField,
  yDomainTweenField,
} from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

export const LINE_CHART = /* @__PURE__ */ defineChart<LineChartProps>()({
  id: "LineChart",
  version: 1,
  label: "Line chart",
  description: "One or more measures over continuous time, where the trend is the point.",
  specTypes: ["line"],
  groups: [
    a11yGroup,
    interactionCommons.group,
    selectionCommons.group,
    navigatorCommons.group,
    selectionGestureCommons.group,
    analyticsCommons.group,
    frameSizeGroup,
  ],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: rowsField,
    xDataKey: xDataKeyField,
    xScale: xScaleField,
    animationDuration: motionGroup.fields.animationDuration,
    animationEasing: animationEasingField,
    enterTransition: motionGroup.fields.enterTransition,
    revealSignature: revealSignatureField,
    revealOn: revealOnField,
    replayOnClick: replayOnClickField,
    aspectRatio: aspectRatioField,
    className: classNameField,
    status: chartStateGroup.fields.status,
    loadingLabel: loadingLabelField,
    yDomainTweenDuration: yDomainTweenDurationField,
    yDomainTween: yDomainTweenField,
    xDomainSlotCount: xDomainSlotCountField,
    tweenYDomainOnXDomainChange: tweenYDomainOnXDomainChangeField,
    nulls: nullsField,
    focusOnHover: focusOnHoverField,
    legend: legendGroup.fields.legend,
    annotations: annotationsField,
    tooltip: tooltipGroup.fields.tooltip,
    hoverCategory: hoverCategoryField,
  },
  codeOnly: [
    "children",
    "xDomain",
    "style",
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
    yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
    yDomainTween: true,
    tweenYDomainOnXDomainChange: false,
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
      from: { part: "Line", prop: "dataKey" },
      min: 1,
      max: null,
    },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    xKey: { prop: "xDataKey", default: "date", requireDate: true },
    numericProps: ["animationDuration", "yDomainTweenDuration"],
    seriesFromChildren: true,
  },
});
