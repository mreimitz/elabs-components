/**
 * Line part definition (ADR 0042 §5, RM-175): one series of a LineChart or ComposedChart.
 * Kind defaults match the destructuring of `Line` (`charts/line.tsx`); the token
 * references are the values of `chartCssVars`, written as values because that module is not
 * pure. `stroke`'s default is also every container's fallback for an unset stroke.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { LineProps } from "../../charts/line";
import { seriesGroup } from "../../charts/props/series";
import {
  curveField,
  fadeEdgesField,
  loadingPulseModeField,
  markersField,
  nullsField,
  seriesLabelField,
  symbolsField,
  valueLabelsField,
  yAxisIdField,
} from "../cartesian-fields";
import { definePart } from "../define-chart";

export const LINE_PART = /* @__PURE__ */ definePart<LineProps>()({
  id: "Line",
  version: 1,
  label: "Line series",
  description: "One series drawn as a line, read from one field of each row.",
  groups: [],
  fields: {
    dataKey: seriesGroup.fields.dataKey,
    yAxisId: yAxisIdField,
    stroke: field.color({
      tier: "essential",
      description: "Colour of the line.",
    }),
    strokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of the line.",
    }),
    curve: curveField,
    animate: field.boolean({
      tier: "advanced",
      description: "Animate the line in.",
    }),
    fadeEdges: fadeEdgesField,
    showHighlight: field.boolean({
      tier: "advanced",
      description: "Highlight the hovered point.",
    }),
    showMarkers: field.boolean({
      tier: "advanced",
      description: "Draw a marker on every point.",
    }),
    markers: markersField,
    symbols: symbolsField,
    nulls: nullsField,
    outline: field.union({
      of: [field.boolean(), field.number({ unit: "px" })],
      tier: "advanced",
      description: "A background-coloured outline around the line, or its width.",
    }),
    labelPeaks: field.union({
      of: [
        field.number(),
        field.object({
          fields: { count: field.number({ required: true }), minGap: field.number() },
        }),
      ],
      tier: "advanced",
      description: "Label this many peaks, or { count, minGap }.",
    }),
    name: seriesGroup.fields.name,
    seriesLabel: seriesLabelField,
    valueLabels: valueLabelsField,
    dashFromIndex: field.number({
      tier: "advanced",
      description: "Draw the line dashed from this row on, as a projection.",
    }),
    dashArray: field.string({
      tier: "advanced",
      description: "SVG dash pattern of the dashed tail.",
    }),
    dashStroke: field.color({
      tier: "advanced",
      description: "Colour of the dashed tail. Unset: the line's.",
    }),
    loading: field.boolean({
      tier: "advanced",
      description: "Draw the line as a loading pulse.",
    }),
    loadingStroke: field.color({
      tier: "advanced",
      description: "Colour of the loading pulse.",
    }),
    loadingStrokeOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the loading pulse.",
    }),
    loadingPulseMode: loadingPulseModeField,
    seriesIndex: field.number({
      tier: "advanced",
      description: "Position in the series order. Unset: the child order.",
    }),
  },
  codeOnly: ["markerStyle", "onLoadingPulseCycleComplete"],
  defaults: {
    stroke: "var(--chart-line-primary)",
    strokeWidth: 2.5,
    curve: "monotone",
    animate: true,
    fadeEdges: true,
    showHighlight: true,
    showMarkers: false,
    outline: false,
    dashArray: "6,4",
    loadingStroke: "var(--chart-foreground)",
    loadingStrokeOpacity: 0.5,
  },
  targets: [],
});
