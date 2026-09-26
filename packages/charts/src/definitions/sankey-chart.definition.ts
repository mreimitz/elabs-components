/**
 * SankeyChart definition (ADR 0042 §5, RM-176; a11y + chart-state, RM-184). Kind defaults
 * match the destructuring of `SankeyChart` (`charts/sankey/sankey-chart.tsx`). `margin` has
 * no kind default: the destructuring renames it to `marginProp` and merges it with the
 * module's own `DEFAULT_MARGIN` inside the component body — never a literal destructuring
 * default — so filling it as a kind default would change what a caller who left it unset
 * gets back from `resolveProps`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { SankeyChartProps } from "../charts/sankey/sankey-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField, revealSignatureField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

export const SANKEY_CHART = /* @__PURE__ */ defineChart<SankeyChartProps>()({
  id: "SankeyChart",
  version: 1,
  label: "Sankey diagram",
  description: "Flow between named nodes, as weighted, flowing links.",
  specTypes: [],
  groups: [a11yGroup, chartStateGroup],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: looseFieldFor<SankeyChartProps["data"]>()(
      field.object({
        fields: {
          nodes: field.array({
            of: field.object({
              fields: { name: field.string({ required: true }) },
              open: true,
            }),
            required: true,
          }),
          links: field.array({
            of: field.object({
              fields: {
                source: field.number({ required: true }),
                target: field.number({ required: true }),
                value: field.number({ required: true }),
              },
              open: true,
            }),
            required: true,
          }),
        },
        required: true,
        tier: "essential",
        description: "Nodes and the weighted links between them.",
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
    nodeWidth: field.number({ unit: "px", tier: "advanced", description: "Node width." }),
    nodePadding: field.number({ unit: "px", tier: "advanced", description: "Node padding." }),
    className: classNameField,
    mode: field.enum({
      values: ["aggregate", "threads"],
      tier: "advanced",
      description: "aggregate: one edge per node pair. threads: one polyline per record's path.",
    }),
  },
  codeOnly: ["margin", "enterTransition", "children", "hoveredNodeIndex", "onNodeHoverChange"],
  defaults: {
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    nodeWidth: 16,
    nodePadding: 24,
    className: "",
    mode: "aggregate",
  },
  targets: [],
  contract: {
    dataKind: "sankey",
    requiredProps: ["data", "children"],
  },
});
