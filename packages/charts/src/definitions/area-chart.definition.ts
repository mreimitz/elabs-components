/**
 * AreaChart definition (ADR 0042 §5, RM-175). Kind defaults match the destructuring
 * of `AreaChartPlot` and the `AreaChart` wrapper (`charts/area-chart.tsx`). It also renders the
 * stream variant (`offset="wiggle"`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import type { AreaChartProps } from "../charts/area-chart";
import { DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS } from "../charts/chart-phase";
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
import { defineChart } from "./define-chart";

export const AREA_CHART = /* @__PURE__ */ defineChart<AreaChartProps>()({
  id: "AreaChart",
  version: 1,
  label: "Area chart",
  description: "Measures over time with the area under each filled; stacked, or streamed.",
  specTypes: ["area", "stream"],
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
    offset: field.enum({
      values: ["none", "silhouette", "wiggle", "expand"],
      tier: "essential",
      description:
        "Stack every area on this baseline: none, centred, a stream wiggle, or stretched to 100%. Unset: no stacking.",
    }),
    seams: field.number({
      unit: "px",
      tier: "advanced",
      description: "Gap between stacked bands, in pixels (with offset set).",
    }),
    labelBands: field.boolean({
      tier: "advanced",
      description: "Label each stacked band with its series name at its widest point.",
    }),
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
      from: { part: "Area", prop: "dataKey" },
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
