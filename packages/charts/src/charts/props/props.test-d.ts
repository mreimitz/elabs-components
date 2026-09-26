/**
 * Type tests for the chart prop groups (RM-174). Nothing here runs: the file
 * is checked by `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`,
 * whose `include` is all of `src`), and vitest never collects a `*.test-d.ts`.
 * A failing `expectTypeOf` or an `@ts-expect-error` that stops being an error
 * fails that command.
 *
 * Per group:
 * - the field keys equal the group's props, every one of them;
 * - the default keys are exactly the members today's families agree on, and
 *   each is optional (no group member is deprecated yet);
 * - the default values are today's, literally.
 *
 * Per commons entry: the group's field keys plus `codeOnly` equal the mixin's
 * keys, with no key in both, and the group has no defaults.
 */

import { expectTypeOf } from "vitest";

import {
  field,
  type FieldFor,
  type FieldValue,
  type NormalizedValue,
} from "@elabs-ai/components-ui/definition";

import type { ChartAnalyticsProps } from "../analytics/types";
import type { ChartInteractionProps } from "../chart-datapoint";
import type { ChartStatus } from "../chart-phase";
import type { ChartSelectionProps } from "../chart-selection";
import type { LineProps } from "../line";
import type { LineChartProps } from "../line-chart";
import type { ChartCategoryNavigatorProps, ChartNavigatorProps } from "../navigator/types";
import type { PieChartProps } from "../pie-chart";
import type { ChartSelectionGestureProps } from "../selection/types";
import type { XAxisProps } from "../x-axis";
import { axisGroup, type AxisGroupProps } from "./axis";
import { chartStateGroup, type ChartEmptyState, type ChartStateGroupProps } from "./chart-state";
import {
  analyticsCommons,
  categoryNavigatorCommons,
  interactionCommons,
  navigatorCommons,
  selectionCommons,
  selectionGestureCommons,
} from "./commons";
import { dataLabelsGroup, type DataLabelsGroupProps } from "./data-labels";
import { frameSizeGroup, type FrameSizeGroupProps } from "./frame-size";
import { legendGroup, type LegendGroupProps } from "./legend";
import { messagesGroup, type MessagesGroupProps } from "./messages";
import { motionGroup, type MotionGroupProps } from "./motion";
import { paletteGroup, type PaletteGroupProps } from "./palette";
import { referenceMarksGroup, type ReferenceMarksGroupProps } from "./reference-marks";
import { seriesGroup, type SeriesGroupProps } from "./series";
import { tooltipGroup, type TooltipGroupProps } from "./tooltip";
import { looseFieldFor, partialFieldFor } from "./typed-field";
import { valueFormatGroup, type ValueFormatGroupProps } from "./value-format";

type OptionalKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never;
}[keyof T];

// ── motion ───────────────────────────────────────────────────────────────────

expectTypeOf(motionGroup.id).toEqualTypeOf<"motion">();
expectTypeOf<keyof typeof motionGroup.fields>().toEqualTypeOf<keyof MotionGroupProps>();
expectTypeOf(motionGroup.defaults).toEqualTypeOf<{
  readonly animationDuration: 1100;
  readonly animationEasing: "cubic-bezier(0.85, 0, 0.15, 1)";
  readonly enterStaggerScale: 1;
  readonly revealSignature: "";
}>();
expectTypeOf<keyof typeof motionGroup.defaults>().toExtend<OptionalKeys<MotionGroupProps>>();

// ── frame-size ───────────────────────────────────────────────────────────────

expectTypeOf(frameSizeGroup.id).toEqualTypeOf<"frame-size">();
expectTypeOf<keyof typeof frameSizeGroup.fields>().toEqualTypeOf<keyof FrameSizeGroupProps>();
expectTypeOf<keyof typeof frameSizeGroup.defaults>().toBeNever();

// ── legend ───────────────────────────────────────────────────────────────────

expectTypeOf(legendGroup.id).toEqualTypeOf<"legend">();
expectTypeOf<keyof typeof legendGroup.fields>().toEqualTypeOf<keyof LegendGroupProps>();
expectTypeOf<keyof typeof legendGroup.defaults>().toBeNever();

// ── tooltip ──────────────────────────────────────────────────────────────────

expectTypeOf(tooltipGroup.id).toEqualTypeOf<"tooltip">();
expectTypeOf<keyof typeof tooltipGroup.fields>().toEqualTypeOf<keyof TooltipGroupProps>();
expectTypeOf(tooltipGroup.defaults).toEqualTypeOf<{ readonly tooltip: true }>();
expectTypeOf<keyof typeof tooltipGroup.defaults>().toExtend<OptionalKeys<TooltipGroupProps>>();

// ── palette ──────────────────────────────────────────────────────────────────

expectTypeOf(paletteGroup.id).toEqualTypeOf<"palette">();
expectTypeOf<keyof typeof paletteGroup.fields>().toEqualTypeOf<keyof PaletteGroupProps>();
expectTypeOf<keyof typeof paletteGroup.defaults>().toBeNever();

// ── value-format ─────────────────────────────────────────────────────────────

expectTypeOf(valueFormatGroup.id).toEqualTypeOf<"value-format">();
expectTypeOf<keyof typeof valueFormatGroup.fields>().toEqualTypeOf<keyof ValueFormatGroupProps>();
expectTypeOf<keyof typeof valueFormatGroup.defaults>().toBeNever();

// ── chart-state ──────────────────────────────────────────────────────────────

expectTypeOf(chartStateGroup.id).toEqualTypeOf<"chart-state">();
expectTypeOf<keyof typeof chartStateGroup.fields>().toEqualTypeOf<keyof ChartStateGroupProps>();
// `DEFAULT_CHART_STATUS` is declared `: ChartStatus`, so its literal ("ready") is not in the type.
expectTypeOf(chartStateGroup.defaults).toEqualTypeOf<{ readonly status: ChartStatus }>();
expectTypeOf<keyof typeof chartStateGroup.defaults>().toExtend<
  OptionalKeys<ChartStateGroupProps>
>();
// The empty state's field describes the serializable part: `action` (a ReactNode) is code-only.
expectTypeOf<FieldValue<typeof chartStateGroup.fields.empty>>().toEqualTypeOf<
  NormalizedValue<ChartEmptyState>
>();

// ── data-labels ──────────────────────────────────────────────────────────────

expectTypeOf(dataLabelsGroup.id).toEqualTypeOf<"data-labels">();
expectTypeOf<keyof typeof dataLabelsGroup.fields>().toEqualTypeOf<keyof DataLabelsGroupProps>();
expectTypeOf<keyof typeof dataLabelsGroup.defaults>().toBeNever();

// ── axis ─────────────────────────────────────────────────────────────────────

expectTypeOf(axisGroup.id).toEqualTypeOf<"axis">();
expectTypeOf<keyof typeof axisGroup.fields>().toEqualTypeOf<keyof AxisGroupProps>();
expectTypeOf(axisGroup.defaults).toEqualTypeOf<{ readonly tickCount: "auto" }>();
expectTypeOf<keyof typeof axisGroup.defaults>().toExtend<OptionalKeys<AxisGroupProps>>();

// ── series ───────────────────────────────────────────────────────────────────

expectTypeOf(seriesGroup.id).toEqualTypeOf<"series">();
expectTypeOf<keyof typeof seriesGroup.fields>().toEqualTypeOf<keyof SeriesGroupProps>();
expectTypeOf<keyof typeof seriesGroup.defaults>().toBeNever();
expectTypeOf(seriesGroup.fields.dataKey.required).toEqualTypeOf<true>();

// ── reference-marks ──────────────────────────────────────────────────────────

expectTypeOf(referenceMarksGroup.id).toEqualTypeOf<"reference-marks">();
expectTypeOf<keyof typeof referenceMarksGroup.fields>().toEqualTypeOf<
  keyof ReferenceMarksGroupProps
>();
expectTypeOf<keyof typeof referenceMarksGroup.defaults>().toBeNever();

// ── messages ─────────────────────────────────────────────────────────────────

expectTypeOf(messagesGroup.id).toEqualTypeOf<"messages">();
expectTypeOf<keyof typeof messagesGroup.fields>().toEqualTypeOf<keyof MessagesGroupProps>();
expectTypeOf<keyof typeof messagesGroup.defaults>().toBeNever();

// ── commons ──────────────────────────────────────────────────────────────────

type CommonsKeys<C extends { group: { fields: object }; codeOnly: readonly string[] }> =
  | keyof C["group"]["fields"]
  | C["codeOnly"][number];
type CommonsOverlap<C extends { group: { fields: object }; codeOnly: readonly string[] }> = Extract<
  keyof C["group"]["fields"],
  C["codeOnly"][number]
>;

expectTypeOf<CommonsKeys<typeof interactionCommons>>().toEqualTypeOf<keyof ChartInteractionProps>();
expectTypeOf<CommonsOverlap<typeof interactionCommons>>().toBeNever();
expectTypeOf<keyof typeof interactionCommons.group.defaults>().toBeNever();

expectTypeOf<CommonsKeys<typeof selectionCommons>>().toEqualTypeOf<keyof ChartSelectionProps>();
expectTypeOf<CommonsOverlap<typeof selectionCommons>>().toBeNever();
expectTypeOf<keyof typeof selectionCommons.group.defaults>().toBeNever();

expectTypeOf<CommonsKeys<typeof categoryNavigatorCommons>>().toEqualTypeOf<
  keyof ChartCategoryNavigatorProps
>();
expectTypeOf<CommonsOverlap<typeof categoryNavigatorCommons>>().toBeNever();
expectTypeOf<keyof typeof categoryNavigatorCommons.group.defaults>().toBeNever();

expectTypeOf<CommonsKeys<typeof navigatorCommons>>().toEqualTypeOf<keyof ChartNavigatorProps>();
expectTypeOf<CommonsOverlap<typeof navigatorCommons>>().toBeNever();
expectTypeOf<keyof typeof navigatorCommons.group.defaults>().toBeNever();

expectTypeOf<CommonsKeys<typeof selectionGestureCommons>>().toEqualTypeOf<
  keyof ChartSelectionGestureProps
>();
expectTypeOf<CommonsOverlap<typeof selectionGestureCommons>>().toBeNever();
expectTypeOf<keyof typeof selectionGestureCommons.group.defaults>().toBeNever();

expectTypeOf<CommonsKeys<typeof analyticsCommons>>().toEqualTypeOf<keyof ChartAnalyticsProps>();
expectTypeOf<CommonsOverlap<typeof analyticsCommons>>().toBeNever();
expectTypeOf<keyof typeof analyticsCommons.group.defaults>().toBeNever();

// ── Today's families already match the group fields they will adopt ─────────
// A group field extends `FieldFor<Family, K>` exactly when a definition for
// that family could take the member from the group (the ui base's
// `groupFieldsNotMatchingProps` check).

expectTypeOf(motionGroup.fields.animationDuration).toExtend<
  FieldFor<LineChartProps, "animationDuration">
>();
expectTypeOf(motionGroup.fields.animationEasing).toExtend<
  FieldFor<LineChartProps, "animationEasing">
>();
expectTypeOf(motionGroup.fields.enterTransition).toExtend<
  FieldFor<LineChartProps, "enterTransition">
>();
expectTypeOf(motionGroup.fields.revealSignature).toExtend<
  FieldFor<LineChartProps, "revealSignature">
>();
expectTypeOf(motionGroup.fields.enterStaggerScale).toExtend<
  FieldFor<PieChartProps, "enterStaggerScale">
>();
expectTypeOf(frameSizeGroup.fields.plotHeight).toExtend<FieldFor<LineChartProps, "plotHeight">>();
expectTypeOf(legendGroup.fields.legend).toExtend<FieldFor<LineChartProps, "legend">>();
expectTypeOf(tooltipGroup.fields.tooltip).toExtend<FieldFor<LineChartProps, "tooltip">>();
expectTypeOf(chartStateGroup.fields.status).toExtend<FieldFor<LineChartProps, "status">>();
expectTypeOf(axisGroup.fields.tickCount).toExtend<FieldFor<XAxisProps, "tickCount">>();
expectTypeOf(seriesGroup.fields.dataKey).toExtend<FieldFor<LineProps, "dataKey">>();
expectTypeOf(seriesGroup.fields.name).toExtend<FieldFor<LineProps, "name">>();
expectTypeOf(navigatorCommons.group.fields.scrollbar).toExtend<
  FieldFor<LineChartProps, "scrollbar">
>();
// …and a narrower family type does not: Line's `margin` has no number form,
// so the kind overrides `margin` until it widens.
expectTypeOf(frameSizeGroup.fields.margin).not.toExtend<FieldFor<LineChartProps, "margin">>();

// ── typed-field: the helpers check their claim ───────────────────────────────

interface Probe {
  a?: string;
  b?: () => void;
}

// A description of part of the prop: fine, the callback `b` stays code-only.
partialFieldFor<Probe>()(field.object({ fields: { a: field.string() } }));
// A description that admits a value the prop rejects: an error.
// @ts-expect-error — `a` is a string, not a number
partialFieldFor<Probe>()(field.object({ fields: { a: field.number() } }));
// A description that accepts every value of the prop: fine.
looseFieldFor<Probe>()(field.object({ fields: {}, open: true }));
// A description that rejects a value the prop accepts: an error.
// @ts-expect-error — the prop's `a` may be any string, the description allows only "x"
looseFieldFor<Probe>()(field.object({ fields: { a: field.enum({ values: ["x"] }) }, open: true }));
