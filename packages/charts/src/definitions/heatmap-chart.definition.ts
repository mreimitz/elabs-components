/**
 * HeatmapChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `HeatmapChartShell` (`charts/heatmap/heatmap-chart.tsx`); `steps`/`emptyMarkScale`'s
 * defaults are that module's own constants, written as their values because that module is
 * not pure. `mode` and `showValues` have no kind default: both are resolved with `??`
 * inside the component (`mode` from `variant`, `showValues` from `palette`), never a
 * literal destructuring default.
 *
 * `palette` is a narrower `HeatmapPalette` (`"sequential" | "diverging" | "mono"`), not the
 * full `ChartPalette` the shared palette group describes. `showLegend`/`legendLabels` are
 * this family's own legend shape, not `legendGroup`'s `ContainerLegendProp`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import {
  categoryNavigatorCommons,
  interactionCommons,
  selectionCommons,
  selectionGestureCommons,
} from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { valueFormatGroup } from "../charts/props/value-format";
import type { HeatmapChartProps } from "../charts/heatmap/heatmap-chart";
import { partialFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

/** `heatmap-chart.tsx`/`heatmap-cell.tsx`'s own constants — copied rather than imported,
 * since neither module is pure. */
const DEFAULT_HEATMAP_STEPS = 5;
const DEFAULT_EMPTY_MARK_SCALE = 0.6;

export const HEATMAP_CHART = /* @__PURE__ */ defineChart<HeatmapChartProps>()({
  id: "HeatmapChart",
  version: 1,
  label: "Heatmap",
  description: "A value across two discrete axes, shaded per cell.",
  specTypes: ["heatmap", "calendar"],
  groups: [
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    selectionGestureCommons.group,
    categoryNavigatorCommons.group,
  ],
  fields: {
    data: field.array({
      of: field.object({ fields: {}, open: true }),
      required: true,
      tier: "essential",
      description: "One row per cell.",
    }),
    x: field.string({
      required: true,
      tier: "essential",
      description: "Row field holding the column value.",
    }),
    y: field.string({
      required: true,
      tier: "essential",
      description: "Row field holding the row value. Ignored by the calendar variant.",
    }),
    valueKey: field.string({
      required: true,
      tier: "essential",
      description: "Row field holding the number.",
    }),
    mode: field.enum({
      values: ["cell", "dot"],
      tier: "advanced",
      description: "cell: shade encodes the value. dot: dot area encodes the value.",
    }),
    variant: field.enum({
      values: ["matrix", "calendar"],
      tier: "essential",
      description: "matrix: x/y grid. calendar: x as an ISO date, laid out as a year grid.",
    }),
    palette: field.enum({
      values: ["sequential", "diverging", "mono"],
      tier: "essential",
      description: "Which ordered ramp the values are drawn from.",
    }),
    steps: field.number({
      tier: "advanced",
      description: "Countable ramp steps. 0 asks for a continuous ramp.",
    }),
    showValues: field.boolean({
      tier: "essential",
      description: "Print each cell's value on it, as halo text.",
    }),
    highlight: partialFieldFor<HeatmapChartProps["highlight"]>()(
      field.enum({
        values: ["max", "none"],
        tier: "advanced",
        description: "Which cell gets the dashed peak ring.",
      }),
    ),
    showValueHalo: field.boolean({
      tier: "advanced",
      description: "Halo behind a mode=cell value label.",
    }),
    emptyMarkScale: field.number({
      tier: "advanced",
      description: "Side of the no-data outline, as a fraction of the cell's shorter side.",
    }),
    emptyValue: field.enum({
      values: ["quiet", "blank"],
      tier: "advanced",
      description:
        "quiet: a hairline outline for null, a pinprick for a measured 0. blank: neither.",
    }),
    xOrder: field.array({ of: field.string(), tier: "advanced", description: "Column order." }),
    yOrder: field.array({ of: field.string(), tier: "advanced", description: "Row order." }),
    cellRadius: field.number({
      unit: "px",
      tier: "advanced",
      description: "Corner radius of a mode=cell square.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    showLegend: field.boolean({
      tier: "essential",
      description: "Show the ramp key below the plot.",
    }),
    legendLabels: field.enum({
      values: ["endpoints", "ranges"],
      tier: "advanced",
      description: "endpoints: lo/hi bracket the strip. ranges: one from–to label per swatch.",
    }),
    xAxisLabel: field.string({
      tier: "advanced",
      description: "A visible title for the column axis.",
    }),
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    revealOn: field.enum({
      values: ["mount", "inView"],
      tier: "advanced",
      description: "When the enter stagger plays.",
    }),
    loading: field.boolean({
      tier: "essential",
      description: "Layout-shaped skeleton instead of the data.",
    }),
    emptyMessage: field.string({
      tier: "advanced",
      description: "Supporting sentence of the empty state.",
    }),
    emptyTitle: field.string({ tier: "advanced", description: "Title of the empty state." }),
    className: classNameField,
  },
  codeOnly: [
    "rowHighlight",
    "margin",
    "emptyAction",
    "style",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
    ...categoryNavigatorCommons.codeOnly,
  ],
  defaults: {
    cellRadius: 4,
    emptyMessage: "No data to plot.",
    emptyTitle: "No data",
    emptyMarkScale: DEFAULT_EMPTY_MARK_SCALE,
    emptyValue: "quiet",
    highlight: "max",
    loading: false,
    palette: "sequential",
    revealOn: "mount",
    legendLabels: "endpoints",
    showLegend: true,
    showValueHalo: true,
    steps: DEFAULT_HEATMAP_STEPS,
    variant: "matrix",
  },
  targets: [
    { id: "x", label: "Column", role: "dimension", from: { prop: "x" }, min: 1, max: 1 },
    { id: "y", label: "Row", role: "dimension", from: { prop: "y" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { prop: "valueKey" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "x", "y", "valueKey"],
    propNamedKeys: [
      { prop: "x" },
      { prop: "y", onlyWhen: { prop: "variant", equals: "matrix" } },
      { prop: "valueKey" },
      { prop: "x", onlyWhen: { prop: "variant", equals: "calendar" }, requireDate: true },
    ],
  },
});
