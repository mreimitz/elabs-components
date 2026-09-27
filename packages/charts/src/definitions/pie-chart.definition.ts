/**
 * PieChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `PieChartBase` (`charts/pie-chart.tsx`).
 *
 * `sort` has no kind default here: the component resolves an unset `sort` to `"none"`
 * itself (`effectiveSort = sortProp ?? "none"`) rather than defaulting it in its
 * destructuring, so filling it as a kind default would change what `resolveProps`
 * hands back for a caller who left it unset. `labels`/`legend`/`groupSmall` are
 * left to code: each is a config object with a `ReactNode`-shaped or open member.
 *
 * `valueFormatGroup` itself is NOT listed in `groups` below: the members stay own
 * fields referencing the group's field objects (same pattern as `UnitChart`'s partial
 * `tooltipGroup`). RM-187 made `locale` real — the formatters behind these members now
 * take the chart's own `locale` over the `LocaleProvider`'s — so it is listed too.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { interactionCommons, selectionCommons } from "../charts/props/commons";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import type { PieChartProps } from "../charts/pie-chart";
import { looseFieldFor, partialFieldFor } from "../charts/props/typed-field";
import { valueFormatGroup } from "../charts/props/value-format";
import { classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

export const PIE_CHART = /* @__PURE__ */ defineChart<PieChartProps>()({
  id: "PieChart",
  version: 1,
  label: "Pie chart",
  description: "Parts of a whole across a few categories, read as proportions of the total.",
  specTypes: ["pie"],
  groups: [
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    frameSizeGroup,
    chartStateGroup,
  ],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    data: looseFieldFor<PieChartProps["data"]>()(
      field.array({
        of: field.object({
          fields: {
            label: field.string({ required: true }),
            value: field.number({ required: true }),
          },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "Slices: one label and value per row.",
      }),
    ),
    size: field.number({ unit: "px", tier: "advanced", description: "Fixed pixel size." }),
    plotHeight: frameSizeGroup.fields.plotHeight,
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    empty: chartStateGroup.fields.empty,
    valueFormat: valueFormatGroup.fields.valueFormat,
    currency: valueFormatGroup.fields.currency,
    maxFractionDigits: valueFormatGroup.fields.maxFractionDigits,
    locale: valueFormatGroup.fields.locale,
    innerRadius: field.number({
      unit: "px",
      tier: "essential",
      description: "Inner radius: 0 is a full pie, greater than 0 is a donut.",
    }),
    align: field.enum({
      values: ["start", "center"],
      tier: "advanced",
      description: "Where the pie sits when narrower than its box.",
    }),
    padAngle: field.number({
      tier: "advanced",
      description: "Gap between slices, in radians.",
    }),
    cornerRadius: field.number({
      unit: "px",
      tier: "advanced",
      description: "Corner rounding of each slice.",
    }),
    startAngle: field.number({ tier: "advanced", description: "Start angle, in radians." }),
    endAngle: field.number({ tier: "advanced", description: "End angle, in radians." }),
    className: classNameField,
    hoverOffset: field.number({
      unit: "px",
      tier: "advanced",
      description: "How far the hovered slice pushes outward.",
    }),
    enterStaggerScale: field.number({
      tier: "advanced",
      description: "Scales the entry stagger delay between slices.",
    }),
    geometryScrubbing: field.boolean({
      tier: "advanced",
      description: "Animate slice geometry directly instead of fading between states.",
    }),
    radiusKey: field.string({
      tier: "advanced",
      description: "Row field that varies each slice’s outer radius (a rose chart).",
    }),
    seams: field.number({
      tier: "advanced",
      description: "Hairline seams drawn between slices, 0 for none.",
    }),
    half: field.boolean({
      tier: "advanced",
      description: "Draw a half pie (180°) instead of a full circle.",
    }),
    sort: field.enum({
      values: ["desc", "none"],
      tier: "advanced",
      description: "Order slices by value, descending, or keep the given order.",
    }),
    legend: legendGroup.fields.legend,
    labels: partialFieldFor<PieChartProps["labels"]>()(
      field.object({
        fields: {
          show: field.array({
            of: field.enum({ values: ["label", "value", "percent"] }),
            required: true,
          }),
          matchColor: field.boolean(),
          minAngle: field.number(),
        },
        tier: "advanced",
        description: "Which facts each slice label states, and how it is painted.",
      }),
    ),
  },
  codeOnly: [
    "children",
    "hoveredIndex",
    "onHoverChange",
    "enterTransition",
    "referenceRings",
    "groupSmall",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    innerRadius: 0,
    padAngle: 0,
    cornerRadius: 0,
    startAngle: -Math.PI / 2,
    endAngle: (3 * Math.PI) / 2,
    className: "",
    hoverOffset: 10,
    enterStaggerScale: 1,
    geometryScrubbing: false,
    seams: 0,
    half: false,
    align: "start",
  },
  targets: [
    {
      id: "category",
      label: "Category",
      role: "dimension",
      from: { field: "label" },
      min: 1,
      max: 1,
    },
    { id: "value", label: "Value", role: "measure", from: { field: "value" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: true,
    itemRequiredKeys: ["label", "value"],
    itemNumericKeys: ["value"],
  },
});
