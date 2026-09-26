/**
 * cartesian-fields — the fields the cartesian chart definitions and their series parts share
 * (ADR 0042 §5, RM-175). One field per prop that several definitions describe the same way,
 * so a description is written once.
 *
 * A field here has no default unless every definition that uses it defaults the prop to the
 * same value. A family's own default is a kind default in its definition, matching its
 * destructuring. Where a prop group has a field for the prop but the family cannot list the
 * whole group (it lacks a member, or the group's type is wider than the family's), the
 * definition reuses the group's field object directly; those are not repeated here.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { ChartAnnotation } from "../charts/annotations/annotation-types";
import type { ChartHoverCategory } from "../charts/chart-hover-link";
import type { ChartValueLabels } from "../charts/labels/use-chart-labels";
import type { LineProps } from "../charts/line";
import { looseFieldFor, partialFieldFor } from "../charts/props/typed-field";
import type { TypedField } from "../charts/props/typed-field";
import { valueFormatGroup } from "../charts/props/value-format";

// ── Container fields ─────────────────────────────────────────────────────────

/** `data` of the row-based families: one open object per x value. */
export const rowsField = /* @__PURE__ */ field.array({
  of: field.object({ fields: {}, open: true }),
  required: true,
  tier: "essential",
  description: "Rows to plot: one object per x value.",
});

export const xDataKeyField = /* @__PURE__ */ field.string({
  tier: "essential",
  description: "Field of each row that holds the x value.",
});

export const xScaleField = /* @__PURE__ */ field.enum({
  values: ["time", "band", "linear"],
  tier: "advanced",
  description: "Scale of the x axis: time, one band per row, or linear numbers.",
});

/** `margin` as the cartesian families take it: per side only (`Partial<Margin>`). */
export const marginField = /* @__PURE__ */ field.object({
  fields: {
    top: field.number({ unit: "px" }),
    right: field.number({ unit: "px" }),
    bottom: field.number({ unit: "px" }),
    left: field.number({ unit: "px" }),
  },
  tier: "advanced",
  description: "Space around the plot, in pixels, per side.",
});

/**
 * `animationEasing` with no default: the motion group's field defaults it, but only Bar
 * defaults it in its destructuring; every other family leaves it unset.
 */
export const animationEasingField = /* @__PURE__ */ field.string({
  tier: "advanced",
  description: "CSS easing function of the entry animation.",
});

/**
 * `revealSignature` with no default: the motion group's field defaults it to `""`, which no
 * cartesian family's destructuring does.
 */
export const revealSignatureField = /* @__PURE__ */ field.string({
  tier: "advanced",
  description: "Changing this value replays the entry animation.",
});

export const revealOnField = /* @__PURE__ */ field.enum({
  values: ["mount", "inView"],
  tier: "advanced",
  description: "Start the entry animation on mount, or when the chart scrolls into view.",
});

export const replayOnClickField = /* @__PURE__ */ field.boolean({
  tier: "advanced",
  description: "Replay the entry animation when the chart is clicked.",
});

export const aspectRatioField = /* @__PURE__ */ field.string({
  tier: "advanced",
  description: "CSS aspect ratio of the chart box.",
});

export const classNameField = /* @__PURE__ */ field.string({
  tier: "advanced",
  description: "Extra class names on the chart root.",
});

export const loadingLabelField = /* @__PURE__ */ field.string({
  tier: "advanced",
  description: "Text shown while the chart is loading.",
});

export const yDomainTweenDurationField = /* @__PURE__ */ field.number({
  unit: "ms",
  tier: "advanced",
  description: "Length of the value-axis tween when the domain changes, in milliseconds.",
});

export const yDomainTweenField = /* @__PURE__ */ field.boolean({
  tier: "advanced",
  description: "Tween the value axis when its domain changes.",
});

export const xDomainSlotCountField = /* @__PURE__ */ field.number({
  tier: "advanced",
  description: "Number of x slots the domain spans, for streaming data.",
});

export const tweenYDomainOnXDomainChangeField = /* @__PURE__ */ field.boolean({
  tier: "advanced",
  description: "Also tween the value axis when the x domain changes.",
});

export const nullsField = /* @__PURE__ */ field.enum({
  values: ["gap", "zero", "connect"],
  tier: "advanced",
  description: "How a missing value draws: a gap, a zero, or a line across it.",
});

export const focusOnHoverField = /* @__PURE__ */ field.boolean({
  tier: "advanced",
  description: "Dim the other series while one is hovered.",
});

/**
 * `annotations`: each entry's `kind` is described and the rest is left to code, because a
 * text note's `text` is a `ReactNode` and an `x` may be a `Date`.
 */
export const annotationsField = /* @__PURE__ */ looseFieldFor<readonly ChartAnnotation[]>()(
  field.array({
    of: field.object({
      fields: {
        kind: field.enum({ values: ["text", "range", "line", "row"], required: true }),
      },
      open: true,
    }),
    tier: "advanced",
    description: "Notes, ranges and reference lines in data units, in reading order.",
  }),
);

/** `hoverCategory`: a category held hovered from outside. A `Date` category stays code-only. */
export const hoverCategoryField = /* @__PURE__ */ partialFieldFor<ChartHoverCategory>()(
  field.union({
    of: [field.string(), field.number()],
    nullable: true,
    tier: "advanced",
    description: "Category shown as hovered, set by a linked chart.",
  }),
);

// ── Series-part fields ───────────────────────────────────────────────────────

export const yAxisIdField = /* @__PURE__ */ field.union({
  of: [field.string(), field.number()],
  tier: "advanced",
  description: "Value axis this belongs to, when the chart has several.",
});

const curveEnum = /* @__PURE__ */ field.enum({
  values: ["linear", "monotone", "natural", "step", "step-before", "step-after"],
  tier: "advanced",
  description: "Curve between points.",
});

/**
 * The `curve` field's type, as an interface so a declaration file can name it. Spelled out,
 * the prop's d3 curve factory type is not portable: two `@types/d3-shape` versions resolve in
 * this package, and the one `CurveFactory` comes from is not a direct dependency.
 */
export interface CurveField extends TypedField<typeof curveEnum, LineProps["curve"]> {
  readonly kind: "enum";
}

/** `curve`: the named curves. A d3 curve factory stays code-only. */
export const curveField: CurveField =
  /* @__PURE__ */ partialFieldFor<LineProps["curve"]>()(curveEnum);

export const fadeEdgesField = /* @__PURE__ */ field.enum({
  values: [true, false, "left", "right"],
  tier: "advanced",
  description: "Fade the series out at both edges, one edge, or neither.",
});

const markerShapeField = /* @__PURE__ */ field.enum({
  values: ["circle", "square", "triangle", "diamond", "cross", "star", "plus", "hexagon"],
});

/** `markers`: the look of the point markers (`SeriesPointMarkerStyle`). */
export const markersField = /* @__PURE__ */ field.object({
  fields: {
    fill: field.string(),
    stroke: field.string(),
    strokeWidth: field.number({ unit: "px" }),
    ringGap: field.number({ unit: "px" }),
    outlineWidth: field.number({ unit: "px" }),
    outlineColor: field.string(),
    radius: field.number({ unit: "px" }),
    fadeOnHover: field.boolean(),
    inactiveOpacity: field.number(),
    inactiveBlur: field.number({ unit: "px" }),
    enterBlur: field.number({ unit: "px" }),
    showActiveHighlight: field.boolean(),
    shape: markerShapeField,
  },
  tier: "advanced",
  description: "Look of the point markers.",
});

/** `symbols`: marker symbols drawn on the series (`SeriesSymbolsSpec`). */
export const symbolsField = /* @__PURE__ */ field.object({
  fields: {
    placement: field.enum({ values: ["all", "ends", "first", "last"] }),
    shape: markerShapeField,
    style: field.enum({ values: ["filled", "hollow"] }),
    size: field.number({ unit: "px" }),
  },
  tier: "advanced",
  description: "Symbols drawn on the series’ points: where, which shape and how.",
});

export const markerShapeOptionField = /* @__PURE__ */ field.enum({
  values: ["circle", "square", "triangle", "diamond", "cross", "star", "plus", "hexagon"],
  tier: "advanced",
  description: "Shape of each marker.",
});

export const seriesLabelField = /* @__PURE__ */ field.responsive({
  of: field.enum({ values: ["end", "key", "none"] }),
  breakpoints: ["medium", "narrow"],
  tier: "advanced",
  description: "Name the series with a label at its end, a key entry, or not at all.",
});

/** `valueLabels`: value labels on the series' points (`ChartValueLabels`). */
export const valueLabelsField = /* @__PURE__ */ partialFieldFor<ChartValueLabels>()(
  field.object({
    fields: {
      placement: field.enum({ values: ["first", "last", "all", "peaks"], required: true }),
      count: field.number(),
      minGap: field.number({ unit: "px" }),
      outline: field.boolean(),
      matchColor: field.boolean(),
      format: valueFormatGroup.fields.valueFormat,
    },
    tier: "advanced",
    description: "Value labels on the series’ points: which ones, and how they print.",
  }),
);

export const loadingPulseModeField = /* @__PURE__ */ field.enum({
  values: ["loop", "exit", "enter"],
  tier: "advanced",
  description: "How the loading pulse runs: looping, on exit or on enter.",
});
