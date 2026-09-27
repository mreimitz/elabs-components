/**
 * BumpChart definition (ADR 0042 §5, RM-176; frame-size + status RM-185). Kind
 * defaults match the destructuring of `BumpChart` (`charts/bump-chart.tsx`).
 * `palette`, `valueFormat` and `margin` have no kind default: `margin` is
 * renamed `marginProp` and merged against a variant-derived default inside
 * the component (`resolveChartMargin`), `palette`/`valueFormat` stay bare,
 * resolved elsewhere — never a literal destructuring default.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { interactionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { paletteGroup } from "../charts/props/palette";
import { valueFormatGroup } from "../charts/props/value-format";
import type { BumpChartProps } from "../charts/bump-chart";
import { classNameField, aspectRatioField } from "./cartesian-fields";
import { defineChart } from "./define-chart";
import { messagesGroup } from "../charts/props/messages";

/** `bump-chart.tsx`'s own constant — copied rather than imported, since that module is
 * not pure. */
const DEFAULT_MAX_ENTITIES = 10;

export const BUMP_CHART = /* @__PURE__ */ defineChart<BumpChartProps>()({
  id: "BumpChart",
  version: 1,
  label: "Bump chart",
  description: "Rank over discrete time periods — who is #1 changes.",
  specTypes: ["bump"],
  groups: [messagesGroup, a11yGroup, interactionCommons.group, frameSizeGroup],
  fields: {
    data: field.array({
      of: field.object({ fields: {}, open: true }),
      required: true,
      tier: "essential",
      description: "One row per (period, entity) pair.",
    }),
    period: field.string({
      required: true,
      tier: "essential",
      description: "Row field for the discrete period.",
    }),
    entity: field.string({
      required: true,
      tier: "essential",
      description: "Row field for the entity being ranked.",
    }),
    valueKey: field.string({
      tier: "essential",
      description: "Row field for the value ranks are derived from, when rankKey is absent.",
    }),
    rankKey: field.string({
      tier: "advanced",
      description: "Row field for an already-computed rank. Wins over a derived rank.",
    }),
    variant: field.enum({
      values: ["lines", "strip"],
      tier: "essential",
      description: "lines: one line per entity. strip: a fixed-row filmstrip.",
    }),
    highlightKey: field.string({
      tier: "advanced",
      description: "The hero entity, drawn in ink; every other entity draws mono.",
    }),
    showDelta: field.boolean({
      tier: "essential",
      description: "Show a rank-movement flag into the last period, per row.",
    }),
    maxEntities: field.number({
      tier: "advanced",
      description: "Cap on plotted entities, kept by final rank.",
    }),
    maxPeriods: field.number({
      tier: "advanced",
      description: "variant=strip only: cap on plotted periods, kept as the most recent.",
    }),
    palette: paletteGroup.fields.palette,
    valueFormat: valueFormatGroup.fields.valueFormat,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    margin: frameSizeGroup.fields.margin,
    status: chartStateGroup.fields.status,
    className: classNameField,
  },
  codeOnly: interactionCommons.codeOnly,
  defaults: {
    variant: "lines",
    showDelta: false,
    maxEntities: DEFAULT_MAX_ENTITIES,
    copyValueOnActivate: false,
    status: DEFAULT_CHART_STATUS,
  },
  targets: [
    { id: "period", label: "Period", role: "dimension", from: { prop: "period" }, min: 1, max: 1 },
    { id: "entity", label: "Entity", role: "dimension", from: { prop: "entity" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { prop: "valueKey" }, min: 0, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "period", "entity"],
    hasStatus: false,
    dynamicKeys: [{ prop: "period" }, { prop: "entity" }],
    keyProps: [
      { prop: "valueKey", numeric: true },
      { prop: "rankKey", numeric: true },
    ],
  },
});
