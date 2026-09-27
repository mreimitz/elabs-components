/**
 * ChoroplethChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `ChoroplethChartBase` (`charts/choropleth/choropleth-chart.tsx`); `animationDuration`'s
 * default is that module's own constant, written as its value because that module is not
 * pure. `margin` has no kind default: renamed to `marginProp` and left unresolved in the
 * destructuring (merged internally), like every other family with this pattern.
 *
 * Only the plainly scalar props are modeled as fields. `scale`, `legend`, `fitToData`,
 * `inset`, `labels`, `overlayBy`, `symbols`, `zoomControls`, `translate` and `keyboardNav`
 * are each a rich, nested config (some a union with a deprecated scalar form) with no
 * simple, honest field-vocabulary shape — left to code, per ADR 0042's codeOnly escape
 * hatch, rather than guessed at.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { ChoroplethChartProps } from "../charts/choropleth/choropleth-chart";
import {
  annotationsField,
  aspectRatioField,
  classNameField,
  revealSignatureField,
} from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { messagesGroup } from "../charts/props/messages";

/** `choropleth-chart.tsx`'s own animation/zoom constants — not exported, and that module
 * renders JSX, so the values are copied rather than imported. */
const DEFAULT_CHOROPLETH_ANIMATION_DURATION_MS = 800;
const DEFAULT_INITIAL_ZOOM = {
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
} as const;

export const CHOROPLETH_CHART = /* @__PURE__ */ defineChart<ChoroplethChartProps>()({
  id: "ChoroplethChart",
  version: 1,
  label: "Choropleth map",
  description: "Regions shaded by a measure, on a real map projection.",
  specTypes: ["choropleth"],
  groups: [messagesGroup, a11yGroup, frameSizeGroup],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: looseFieldFor<ChoroplethChartProps["data"]>()(
      field.object({
        fields: {},
        open: true,
        required: true,
        tier: "essential",
        description: "A GeoJSON FeatureCollection.",
      }),
    ),
    animationDuration: field.number({
      unit: "ms",
      tier: "advanced",
      description: "Length of the entry animation, in milliseconds.",
    }),
    revealSignature: revealSignatureField,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    projectionScale: field.number({
      tier: "advanced",
      description: "Projection scale. Auto-calculated from width when unset.",
    }),
    hideNoData: field.boolean({
      tier: "essential",
      description: "Remove every region without data from the map.",
    }),
    annotations: annotationsField,
    emptyTitle: field.string({ tier: "advanced", description: "Title of the empty state." }),
    emptyMessage: field.string({ tier: "advanced", description: "Message of the empty state." }),
    center: field.array({
      of: field.number(),
      min: 2,
      max: 2,
      tier: "advanced",
      description: "Center coordinates: [longitude, latitude].",
    }),
    zoomEnabled: field.boolean({ tier: "essential", description: "Enable zoom and pan." }),
    zoomMin: field.number({ tier: "advanced", description: "Minimum zoom scale." }),
    zoomMax: field.number({ tier: "advanced", description: "Maximum zoom scale." }),
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    className: classNameField,
  },
  codeOnly: [
    "enterTransition",
    "scale",
    "legend",
    "fitToData",
    "inset",
    "labels",
    "overlayBy",
    "symbols",
    "zoomControls",
    "translate",
    "initialZoom",
    "children",
    "keyboardNav",
  ],
  defaults: {
    animationDuration: DEFAULT_CHOROPLETH_ANIMATION_DURATION_MS,
    center: [0, 20],
    zoomEnabled: false,
    zoomMin: 0.5,
    zoomMax: 4,
    initialZoom: DEFAULT_INITIAL_ZOOM,
    className: "",
    hideNoData: false,
    emptyTitle: "No data",
    emptyMessage: "No region has data to map.",
    status: DEFAULT_CHART_STATUS,
  },
  targets: [],
  contract: {
    dataKind: "feature-collection",
    requiredProps: ["data", "children"],
  },
});
