/**
 * HeatmapChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `HeatmapChartShell` (`charts/heatmap/heatmap-chart.tsx`); `steps`/`emptyMarkScale`'s
 * defaults are that module's own constants, written as their values because that module is
 * not pure. `mode` has no kind default: it is resolved with `??` inside the component
 * (from `variant`), never a literal destructuring default.
 *
 * `palette` is a narrower `HeatmapPalette` (`"sequential" | "diverging" | "mono"`), not the
 * full `ChartPalette` the shared palette group describes. `legend` (a boolean) and
 * `legendLabels` are this family's own legend shape, not `legendGroup`'s
 * `ContainerLegendProp`.
 *
 * RM-194 (ADR 0042 A.4, rows 17, 18, 20–22): `showLegend` → `legend`, `loading` → `status`
 * and `emptyTitle` / `emptyMessage` / `emptyAction` → `empty.*`, each an alias row until
 * 7.0.0. `status` and `empty` come from the `chart-state` group; the kind defaults keep what
 * the old names defaulted to (`legend` true, `status` "ready" for `loading` false, and the
 * family's own empty-state words).
 *
 * RM-196 (ADR 0042 A.6, rows 32–33): `x` → `xDataKey`, `y` → `yDataKey`. The TS props type
 * (`HeatmapChartProps`, `charts/heatmap/heatmap-chart.tsx`) keeps one of each pair required —
 * the field vocabulary has no "either required" shape, so `xDataKey`/`yDataKey` are declared
 * optional here (the old name can satisfy the pair) and the compile-time requirement lives on
 * the TS union alone.
 *
 * RM-193 (ADR 0042 A.3, row 14): `showValues` → `labels`. Unlike the other four rows,
 * `labels`'s default is not a literal — it follows `palette` (`true` only on `"diverging"`,
 * §8's "sign cannot ride on hue alone") — so `normalize` fills it once `palette` itself has
 * resolved. `useResolvedChartProps` calls a definition's `normalize` (when it declares one)
 * inside its own memo; `HeatmapChart` is the only definition that declares one today.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { dataLabelsGroup } from "../charts/props/data-labels";

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
import { messagesGroup } from "../charts/props/messages";

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
    messagesGroup,
    a11yGroup,
    selectionCommons.group,
    interactionCommons.group,
    selectionGestureCommons.group,
    categoryNavigatorCommons.group,
    frameSizeGroup,
    chartStateGroup,
    dataLabelsGroup,
  ],
  fields: {
    data: field.array({
      of: field.object({ fields: {}, open: true }),
      required: true,
      tier: "essential",
      description: "One row per cell.",
    }),
    // RM-196: not `required` here — the TS type requires one of `xDataKey`/`x` (see the
    // module docblock), a shape the field vocabulary cannot express.
    xDataKey: field.string({
      tier: "essential",
      description: "Row field holding the column value.",
    }),
    yDataKey: field.string({
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
    legend: field.boolean({
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
    margin: frameSizeGroup.fields.margin,
    revealOn: field.enum({
      values: ["mount", "inView"],
      tier: "advanced",
      description: "When the enter stagger plays.",
    }),
    className: classNameField,
  },
  codeOnly: [
    "rowHighlight",
    "style",
    ...selectionCommons.codeOnly,
    ...interactionCommons.codeOnly,
    ...selectionGestureCommons.codeOnly,
    ...categoryNavigatorCommons.codeOnly,
  ],
  defaults: {
    cellRadius: 4,
    empty: { title: "No data", message: "No data to plot." },
    emptyMarkScale: DEFAULT_EMPTY_MARK_SCALE,
    emptyValue: "quiet",
    highlight: "max",
    status: DEFAULT_CHART_STATUS,
    palette: "sequential",
    revealOn: "mount",
    legendLabels: "endpoints",
    legend: true,
    showValueHalo: true,
    steps: DEFAULT_HEATMAP_STEPS,
    variant: "matrix",
  },
  // RM-194 — ADR 0042 A.4 rows 17, 18, 20–22. RM-196 — ADR 0042 A.6 rows 32–33.
  aliases: [
    {
      from: "x",
      to: "xDataKey",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "y",
      to: "yDataKey",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "showLegend",
      to: "legend",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "loading",
      to: "status",
      transform: "loading-to-status",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "emptyTitle",
      to: "empty.title",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "emptyMessage",
      to: "empty.message",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    {
      from: "emptyAction",
      to: "empty.action",
      transform: "identity",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
    // RM-193 — ADR 0042 A.3, row 14. `showValues` becomes `labels`: `boolean-to-labels`.
    {
      from: "showValues",
      to: "labels",
      transform: "boolean-to-labels",
      precedence: "new-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
  ],
  // RM-193 — `labels`'s default follows `palette` (true only on "diverging"), so it can't
  // be a literal kind default; this runs once `palette` itself has resolved. An object with
  // no `show` key (`{}`, e.g. `boolean-to-labels`'s own output never produces this — a
  // caller writing `labels={{}}` directly does) carries no explicit on/off either, so it
  // falls back to the palette default the same as `labels` unset entirely (review fix:
  // previously `{}` short-circuited here and rendered off on a diverging palette).
  normalize(props, _ctx) {
    const { labels } = props;
    const hasExplicitShow =
      typeof labels === "boolean" ||
      (typeof labels === "object" && labels !== null && labels.show !== undefined);
    if (hasExplicitShow) return props;
    return { ...props, labels: props.palette === "diverging" };
  },
  targets: [
    { id: "x", label: "Column", role: "dimension", from: { prop: "xDataKey" }, min: 1, max: 1 },
    { id: "y", label: "Row", role: "dimension", from: { prop: "yDataKey" }, min: 1, max: 1 },
    { id: "value", label: "Value", role: "measure", from: { prop: "valueKey" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    // RM-196: the NEW names — after `useResolvedChartProps`/`resolveChartDoubleProps`
    // aliasing, `xDataKey`/`yDataKey` are always set whichever name the caller used.
    // `yDataKey` is required only on `variant="matrix"`: the real component ignores it
    // entirely on `variant="calendar"` (its own TSDoc says so), so the double must not
    // demand it there either. Every `onlyWhen` gate below carries `default: "matrix"` —
    // `variant`'s own real default — so an unset `variant` (the common case) is judged
    // as `"matrix"`, not exempted from every gated check.
    requiredProps: ["data", "xDataKey", "valueKey"],
    requiredPropsWhen: [
      { prop: "yDataKey", onlyWhen: { prop: "variant", equals: "matrix", default: "matrix" } },
    ],
    propNamedKeys: [
      { prop: "xDataKey", aliasOf: "x" },
      {
        prop: "yDataKey",
        aliasOf: "y",
        onlyWhen: { prop: "variant", equals: "matrix", default: "matrix" },
      },
      { prop: "valueKey" },
      {
        prop: "xDataKey",
        aliasOf: "x",
        onlyWhen: { prop: "variant", equals: "calendar", default: "matrix" },
        requireDate: true,
      },
    ],
  },
});
