/**
 * UnitChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `UnitChartBody` (`charts/unit-chart.tsx`). `palette` has no kind default: the
 * component leaves it unset and resolves it internally (`resolvePalette` defaults to
 * `"categorical"`), and must be able to tell an explicit choice from an unset one.
 *
 * `UnitChartProps` extends `Omit<HTMLAttributes<HTMLDivElement>, "color">`, spread onto
 * the root `<div>` via `...rest` — the raw DOM attribute grab-bag (`onClick`, `aria-*`,
 * `tabIndex`, `style`, …) is real but not a documented, schema-worthy surface, so the
 * definition's props type omits it (keeping only `className`) rather than declaring
 * a codeOnly entry for each of those keys. No behaviour change: the component still
 * accepts and forwards every one of them.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { interactionCommons, selectionCommons } from "../charts/props/commons";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { tooltipGroup } from "../charts/props/tooltip";
import type { UnitChartProps } from "../charts/unit-chart";
import { valueFormatGroup } from "../charts/props/value-format";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

type UnitChartDefinitionProps = Omit<UnitChartProps, keyof HTMLAttributes<HTMLDivElement>> &
  Pick<UnitChartProps, "className">;

export const UNIT_CHART = /* @__PURE__ */ defineChart<UnitChartDefinitionProps>()({
  id: "UnitChart",
  version: 1,
  label: "Unit chart",
  description: "A total as discrete, countable units — a waffle, a field or tally rows.",
  specTypes: ["unit"],
  // RM-183 (F12): `tooltip` is an own field, not listed here — Unit takes
  // only `tooltip`, not `tooltipAvoid`, so `tooltipGroup` stays partial.
  groups: [
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    frameSizeGroup,
    chartStateGroup,
    valueFormatGroup,
  ],
  fields: {
    data: field.array({
      of: field.object({
        fields: {
          label: field.string({ required: true }),
          value: field.number({ required: true }),
          variant: field.enum({ values: ["solid", "outline"] }),
        },
      }),
      required: true,
      tier: "essential",
      description: "Series: one label and value per row.",
    }),
    layout: field.enum({
      values: ["waffle", "field", "rows"],
      required: true,
      tier: "essential",
      description: "How the units are arranged.",
    }),
    total: field.number({
      tier: "essential",
      description: "What 100% of the marks represents. Ignored by rows.",
    }),
    unit: field.number({
      tier: "advanced",
      description: "Value per mark — a unit of 2 draws one mark per two incidents.",
    }),
    unitLabel: field.string({
      tier: "advanced",
      description: "“one dot = one person in a hundred” style caption.",
    }),
    columns: field.number({ tier: "essential", description: "Grid columns for waffle." }),
    mark: field.enum({
      values: ["dot", "tick", "square"],
      tier: "advanced",
      description: "Mark shape for waffle/field.",
    }),
    palette: field.enum({
      values: ["categorical", "sequential", "diverging", "mono", "accent"],
      tier: "advanced",
      description: "Colour family. Past 6 series, an unset palette degrades to neutral.",
    }),
    showArithmetic: field.boolean({
      tier: "essential",
      description: "Show the footer arithmetic. Ignored by rows.",
    }),
    sort: field.enum({
      values: ["desc", "none"],
      tier: "advanced",
      description: "Sort series by value, descending, before laying out.",
    }),
    className: classNameField,
    margin: frameSizeGroup.fields.margin,
    plotHeight: frameSizeGroup.fields.plotHeight,
    status: chartStateGroup.fields.status,
    empty: chartStateGroup.fields.empty,
    tooltip: tooltipGroup.fields.tooltip,
    valueFormat: valueFormatGroup.fields.valueFormat,
    locale: valueFormatGroup.fields.locale,
    currency: valueFormatGroup.fields.currency,
    maxFractionDigits: valueFormatGroup.fields.maxFractionDigits,
  },
  codeOnly: [...selectionCommons.codeOnly, ...interactionCommons.codeOnly],
  defaults: {
    total: 100,
    unit: 1,
    columns: 10,
    mark: "dot",
    showArithmetic: true,
    sort: "none",
    tooltip: true,
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
    requiredProps: ["data", "layout"],
    hasStatus: true,
  },
});
