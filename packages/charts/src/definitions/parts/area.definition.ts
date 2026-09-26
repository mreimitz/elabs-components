/**
 * Area part definition (ADR 0042 §5, RM-175): one series of an AreaChart or ComposedChart.
 * Kind defaults match the destructuring of `Area` (`charts/area.tsx`); the token
 * reference is the value of `chartCssVars.foreground`, written as a value because that module
 * is not pure.
 *
 * `fill` (`chartCssVars.linePrimary` in the destructuring) has no default here: the analytics
 * layer colours an Area without its own fill from the palette, so a filled-in default would
 * change that colour. `gradientToOpacity` has none either: unset means "depends on stacking".
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { AreaProps } from "../../charts/area";
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

export const AREA_PART = /* @__PURE__ */ definePart<AreaProps>()({
  id: "Area",
  version: 1,
  label: "Area series",
  description: "One series drawn as a filled area, read from one field of each row.",
  groups: [],
  fields: {
    dataKey: seriesGroup.fields.dataKey,
    yAxisId: yAxisIdField,
    fill: field.color({
      tier: "essential",
      description: "Colour of the area.",
    }),
    fillOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the area at its top.",
    }),
    stroke: field.color({
      tier: "advanced",
      description: "Colour of the top line. Unset: the fill.",
    }),
    strokeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Width of the top line.",
    }),
    curve: curveField,
    animate: field.boolean({
      tier: "advanced",
      description: "Animate the area in.",
    }),
    showLine: field.boolean({
      tier: "advanced",
      description: "Draw the top line.",
    }),
    showHighlight: field.boolean({
      tier: "advanced",
      description: "Highlight the hovered point.",
    }),
    gradientToOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity the fill fades to at the baseline. Unset: by stacking.",
    }),
    gradientSpan: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "How much of the height the fill gradient spans.",
    }),
    fadeEdges: fadeEdgesField,
    showMarkers: field.boolean({
      tier: "advanced",
      description: "Draw a marker on every point.",
    }),
    markers: markersField,
    symbols: symbolsField,
    dashFromIndex: field.number({
      tier: "advanced",
      description: "Draw the area dashed from this row on, as a projection.",
    }),
    dashArray: field.string({
      tier: "advanced",
      description: "SVG dash pattern of the dashed tail.",
    }),
    nulls: nullsField,
    loadingStroke: field.color({
      tier: "advanced",
      description: "Colour of the loading pulse.",
    }),
    loadingStrokeOpacity: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Opacity of the loading pulse.",
    }),
    loading: field.boolean({
      tier: "advanced",
      description: "Draw the area as a loading pulse.",
    }),
    loadingPulseMode: loadingPulseModeField,
    labelPeaks: field.boolean({
      tier: "advanced",
      description: "Label the area's peaks.",
    }),
    name: seriesGroup.fields.name,
    seriesLabel: seriesLabelField,
    valueLabels: valueLabelsField,
  },
  codeOnly: [],
  defaults: {
    fillOpacity: 0.4,
    strokeWidth: 2,
    curve: "monotone",
    animate: true,
    showLine: true,
    showHighlight: true,
    gradientSpan: 1,
    fadeEdges: false,
    showMarkers: false,
    dashArray: "6,4",
    loadingStroke: "var(--chart-foreground)",
    loadingStrokeOpacity: 0.5,
    labelPeaks: false,
  },
  targets: [],
});
