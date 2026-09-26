/**
 * Grid part definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `Grid` (`charts/grid.tsx`); the token references are the values of
 * `chartCssVars` and the shimmer defaults are that module's constants, written as their
 * values because those modules are not pure. `CHART_HAIRLINE_WIDTH` is a pure constant.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import type { GridProps } from "../../charts/grid";
import { partialFieldFor } from "../../charts/props/typed-field";
import { yAxisIdField } from "../cartesian-fields";
import { definePart } from "../define-chart";

export const GRID_PART = /* @__PURE__ */ definePart<GridProps>()({
  id: "Grid",
  version: 1,
  label: "Grid",
  description: "Gridlines behind a cartesian chart's plot, with optional highlighted rows.",
  groups: [],
  fields: {
    mode: field.enum({
      values: ["lines", "ticks", "off"],
      tier: "essential",
      description: "Full gridlines, short ticks only, or none.",
    }),
    horizontal: field.boolean({
      tier: "essential",
      description: "Draw the horizontal (row) lines.",
    }),
    vertical: field.boolean({
      tier: "essential",
      description: "Draw the vertical (column) lines.",
    }),
    numTicksRows: field.number({
      tier: "advanced",
      description: "Row line count. Unset: follows the y axis.",
    }),
    numTicksColumns: field.number({
      tier: "advanced",
      description: "Column line count.",
    }),
    rowTickValues: field.array({
      of: field.number(),
      tier: "advanced",
      description: "Exactly these row values.",
    }),
    stroke: field.color({
      tier: "advanced",
      description: "Line colour.",
    }),
    loadingStroke: field.color({
      tier: "advanced",
      description: "Line colour while the chart is loading.",
    }),
    strokeOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Line opacity.",
    }),
    strokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Line width.",
    }),
    strokeDasharray: field.string({
      tier: "advanced",
      description: "SVG dash pattern of the lines.",
    }),
    highlightRowValues: field.array({
      of: field.number(),
      tier: "advanced",
      description: "Row values drawn as highlighted lines.",
    }),
    highlightRowStroke: field.color({
      tier: "advanced",
      description: "Colour of a highlighted row.",
    }),
    highlightRowStrokeOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of a highlighted row.",
    }),
    highlightRowStrokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of a highlighted row.",
    }),
    highlightRowStrokeDasharray: field.string({
      tier: "advanced",
      description: "SVG dash pattern of a highlighted row.",
    }),
    // A time column's `Date` values stay code-only: numbers only.
    highlightColumnValues: partialFieldFor<GridProps["highlightColumnValues"]>()(
      field.array({
        of: field.number(),
        tier: "advanced",
        description: "Column values drawn as highlighted lines.",
      }),
    ),
    highlightColumnStroke: field.color({
      tier: "advanced",
      description: "Colour of a highlighted column.",
    }),
    highlightColumnStrokeOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of a highlighted column.",
    }),
    highlightColumnStrokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of a highlighted column.",
    }),
    highlightColumnStrokeDasharray: field.string({
      tier: "advanced",
      description: "SVG dash pattern of a highlighted column.",
    }),
    fadeHorizontal: field.boolean({
      tier: "advanced",
      description: "Fade the row lines out towards the plot's ends.",
    }),
    fadeVertical: field.boolean({
      tier: "advanced",
      description: "Fade the column lines out towards the plot's ends.",
    }),
    yAxisId: yAxisIdField,
    shimmer: field.boolean({
      tier: "advanced",
      description: "Run a shimmer along the lines while loading.",
    }),
    shimmerStroke: field.color({
      tier: "advanced",
      description: "Colour of the shimmer.",
    }),
    shimmerLength: field.number({
      unit: "px",
      tier: "advanced",
      description: "Length of the shimmer.",
    }),
    shimmerSpeed: field.number({
      tier: "advanced",
      description: "Speed of the shimmer, as a multiple.",
    }),
    shimmerSync: field.boolean({
      tier: "advanced",
      description: "Run the shimmer on every line at once.",
    }),
  },
  codeOnly: ["highlightRowLabel", "highlightColumnLabel"],
  defaults: {
    mode: "lines",
    horizontal: true,
    vertical: false,
    numTicksColumns: 10,
    stroke: "var(--chart-grid)",
    strokeOpacity: 1,
    strokeWidth: CHART_HAIRLINE_WIDTH,
    strokeDasharray: "4,4",
    highlightRowStroke: "var(--chart-foreground-muted)",
    highlightRowStrokeOpacity: 1,
    highlightRowStrokeWidth: 1,
    highlightRowStrokeDasharray: "0",
    highlightColumnStroke: "var(--chart-foreground-muted)",
    highlightColumnStrokeOpacity: 1,
    highlightColumnStrokeWidth: 1,
    highlightColumnStrokeDasharray: "0",
    fadeHorizontal: true,
    fadeVertical: false,
    shimmer: false,
    shimmerStroke: "color-mix(in oklch, var(--foreground) 68%, transparent)",
    shimmerLength: 140,
    shimmerSpeed: 1,
    shimmerSync: false,
  },
  targets: [],
});
