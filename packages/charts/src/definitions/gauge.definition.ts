/**
 * Gauge definition (ADR 0042 §5, RM-176) — a surface, not a chart family: no
 * `ChartSpec` type, no runtime value contract. Kind defaults match the
 * destructuring of `GaugeInner`/its outer wrapper (`charts/gauge.tsx`).
 * `activeFillOpacity`/`inactiveFillOpacity` have no kind default: both are
 * resolved with `??` against a module constant inside the component, never a
 * literal destructuring default. `labels` has no kind default either: it is
 * shallow-merged against `DEFAULT_GAUGE_LABELS` inside the component, never
 * assigned that object as its own default.
 *
 * `formatOptions`, `enterTransition`, `remainingLabel` and `children` (defs
 * elements — gradients/patterns, the same convention as `PieChart`) are each a
 * rich config object or a function with no simple, honest field-vocabulary
 * shape — left to code, per ADR 0042's codeOnly escape hatch.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import type { GaugeProps } from "../charts/gauge";
import { defineSurface } from "./define-chart";

export const GAUGE = /* @__PURE__ */ defineSurface<GaugeProps>()({
  id: "Gauge",
  version: 1,
  label: "Gauge",
  description: "A single value on a radial notch dial, 0–100.",
  groups: [a11yGroup],
  fields: {
    value: field.number({
      min: 0,
      max: 100,
      required: true,
      tier: "essential",
      description: "Fill level, 0–100.",
    }),
    centerValue: field.number({
      required: true,
      tier: "essential",
      description: "The number shown at the dial's center.",
    }),
    totalNotches: field.number({ tier: "advanced", description: "Number of arc notches." }),
    spacing: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Percentage of the arc reserved for gaps between notches.",
    }),
    notchCornerRadius: field.number({
      unit: "px",
      tier: "advanced",
      description: "Notch corner fillet radius. 0 = sharp corners.",
    }),
    uniformWidth: field.boolean({
      tier: "advanced",
      description: "Rectangular notches, instead of tapered toward the center.",
    }),
    startAngle: field.number({ unit: "deg", tier: "advanced", description: "Dial start angle." }),
    endAngle: field.number({ unit: "deg", tier: "advanced", description: "Dial end angle." }),
    useGradient: field.boolean({
      tier: "advanced",
      description: "Interpolate notch color along the arc instead of a solid fill.",
    }),
    activeGradient: field.array({
      of: field.color(),
      tier: "advanced",
      description: "Two hex stops the active notches interpolate along.",
    }),
    inactiveGradient: field.array({
      of: field.color(),
      tier: "advanced",
      description:
        "Two hex stops the inactive notches interpolate along. Defaults to activeGradient.",
    }),
    defaultLabel: field.string({
      tier: "advanced",
      description: "Center label under the value, when no caption is computed.",
    }),
    prefix: field.string({ tier: "advanced", description: "Text before the center value." }),
    suffix: field.string({ tier: "advanced", description: "Text after the center value." }),
    inactiveFill: field.color({ tier: "advanced", description: "Inactive/track notch fill." }),
    activeFill: field.color({ tier: "advanced", description: "Active notch fill." }),
    inactiveFillOpacity: field.number({
      min: 0,
      max: 1,
      tier: "advanced",
      description: "Fill opacity for inactive/track notches.",
    }),
    activeFillOpacity: field.number({
      min: 0,
      max: 1,
      tier: "advanced",
      description: "Fill opacity for active notches.",
    }),
    className: field.string({ tier: "advanced", description: "Extra class names on the root." }),
    width: field.number({ unit: "px", tier: "advanced", description: "Explicit pixel width." }),
    height: field.number({ unit: "px", tier: "advanced", description: "Explicit pixel height." }),
    minWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Minimum width for the built-in responsive wrapper.",
    }),
    notchLengthPercent: field.number({
      min: 5,
      max: 100,
      tier: "advanced",
      description: "Radial depth of notches, as a % of the built-in default.",
    }),
    enterStaggerScale: field.number({
      tier: "advanced",
      description: "Scales notch stagger delays relative to default timing.",
    }),
    milestones: field.array({
      of: field.number(),
      tier: "advanced",
      description: "Values (0–100) marked with a dot and a halo-text number.",
    }),
    target: field.number({
      min: 0,
      max: 100,
      tier: "essential",
      description: "A radial tick crossing the notch band at this value.",
    }),
    thresholds: field.array({
      of: field.object({
        fields: {
          value: field.number({ required: true }),
          label: field.string({ required: true }),
        },
      }),
      tier: "advanced",
      description: "Named bands marked with short outer-rim ticks.",
    }),
    labels: field.object({
      fields: { target: field.string() },
      tier: "advanced",
      description: "Overrides the shipped English words the accessible text uses.",
    }),
  },
  codeOnly: ["formatOptions", "enterTransition", "remainingLabel", "children"],
  defaults: {
    totalNotches: 40,
    spacing: 25,
    notchCornerRadius: 0,
    uniformWidth: false,
    startAngle: 135,
    endAngle: 405,
    useGradient: false,
    defaultLabel: "Total",
    notchLengthPercent: 100,
    enterStaggerScale: 1,
    minWidth: 300,
  },
  targets: [],
});
