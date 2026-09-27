/**
 * TreemapChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `TreemapChartBody` (`charts/treemap/treemap-chart.tsx`); `labelMinArea`'s default is
 * that module's own constant, written as its value because that module is not pure.
 * `aspectRatio` has no kind default despite the doc's "Default `16 / 9`": the destructuring
 * leaves it bare (`aspectRatio,`), so the component resolves it elsewhere.
 *
 * `palette` is a narrower `TreemapPalette` (`"mono" | "sequential" | "categorical"`), not
 * the full `ChartPalette` the shared palette group describes — a bespoke enum, not
 * `paletteGroup`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { chartStateGroup } from "../charts/props/chart-state";
import { interactionCommons, selectionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { valueFormatGroup } from "../charts/props/value-format";
import type { TreemapChartProps } from "../charts/treemap/treemap-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";
import { messagesGroup } from "../charts/props/messages";

/** `treemap-chart.tsx`'s own `DEFAULT_LABEL_MIN_AREA` — not exported, and that module
 * renders JSX, so the value is copied rather than imported. */
const DEFAULT_LABEL_MIN_AREA = 1200;

export const TREEMAP_CHART = /* @__PURE__ */ defineChart<TreemapChartProps>()({
  id: "TreemapChart",
  version: 1,
  label: "Treemap",
  description: "A nested hierarchy sized by one measure, as nested rectangles.",
  specTypes: ["treemap"],
  groups: [
    messagesGroup,
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    chartStateGroup,
  ],
  fields: {
    data: looseFieldFor<TreemapChartProps["data"]>()(
      field.object({
        fields: {
          name: field.string({ required: true }),
          value: field.number(),
        },
        open: true,
        required: true,
        tier: "essential",
        description: "The hierarchy. A leaf needs a value.",
      }),
    ),
    depth: field.enum({
      values: [1, 2],
      tier: "essential",
      description: "1 renders the root's children only; 2 adds group title bands.",
    }),
    palette: field.enum({
      values: ["mono", "sequential", "categorical"],
      tier: "essential",
      description: "mono: one shade. sequential: shade by value. categorical: one hue per group.",
    }),
    gap: field.number({ unit: "px", tier: "advanced", description: "Paper seam between tiles." }),
    labelMinArea: field.number({
      unit: "px",
      tier: "advanced",
      description: "Hide a tile's label below this area, in px².",
    }),
    labelOverflow: field.enum({
      values: ["ellipsis", "hide"],
      tier: "advanced",
      description: "A name too long for its tile: clip it, or hide unless it fully fits.",
    }),
    monoLeafColor: field.color({
      tier: "advanced",
      description: 'Override for palette "mono"\'s one leaf shade.',
    }),
    monoBandColor: field.color({
      tier: "advanced",
      description: "Override for a depth-2 group title band's fill.",
    }),
    otherThreshold: field.number({
      tier: "advanced",
      description: "Merge leaves under this share of their parent's total into “Other”.",
    }),
    drilldown: field.boolean({
      tier: "advanced",
      description: "Clicking a group's title band zooms into that group.",
    }),
    showValues: field.boolean({
      tier: "essential",
      description: "Print each labelled tile's value under its name.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    className: classNameField,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    legend: legendGroup.fields.legend,
  },
  codeOnly: [
    "style",
    "hideLeafLabel",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    depth: 2,
    palette: "mono",
    gap: 2,
    labelMinArea: DEFAULT_LABEL_MIN_AREA,
    labelOverflow: "ellipsis",
    otherThreshold: 0,
    drilldown: false,
    showValues: false,
    valueFormat: "compact",
  },
  targets: [],
  contract: {
    dataKind: "hierarchy",
    requiredProps: ["data"],
  },
});
