/**
 * Sparkline definition (ADR 0042 §5, RM-176) — a surface, not a chart family: no
 * `ChartSpec` type, no runtime value contract. Kind defaults match the
 * destructuring of `Sparkline` (`sparkline/sparkline.tsx`). `emphasizeLast` has
 * no kind default: it is computed from `variant` (`variant === "bar"`), never a
 * literal. `labels` has no kind default either: each of its members is merged
 * with its own shipped English word via `??` inside the component, never
 * assigned a whole default object.
 *
 * `formatValue` is a function — left to code, per ADR 0042's codeOnly escape
 * hatch. No `accessibleLabel`/`accessibleDescription`: `label` is Sparkline's
 * own accessible-name prop, so no `a11yGroup`.
 *
 * `SparklineProps` extends `Omit<SVGAttributes<SVGSVGElement>, "children" |
 * "values" | "target">`, spread onto the root `<svg>` via `...props` — the raw
 * SVG attribute grab-bag is real but not a documented, schema-worthy surface,
 * so the definition's props type omits it (keeping `className`, `values` and
 * Sparkline's own `target`) rather than declaring a codeOnly entry for each
 * key. No behaviour change.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import type { SVGAttributes } from "react";

import { field } from "@elabs-ai/components-ui/definition";

import type { SparklineProps } from "../sparkline/sparkline";
import { defineSurface } from "./define-chart";

type SparklineDefinitionProps = Omit<SparklineProps, keyof SVGAttributes<SVGSVGElement>> &
  Pick<SparklineProps, "className" | "values" | "target" | "width" | "height">;

export const SPARKLINE = /* @__PURE__ */ defineSurface<SparklineDefinitionProps>()({
  id: "Sparkline",
  version: 1,
  label: "Sparkline",
  description: "A word-sized trend, as bars or a line.",
  groups: [],
  fields: {
    values: field.array({
      of: field.number(),
      required: true,
      tier: "essential",
      description: "The series, oldest to newest.",
    }),
    variant: field.enum({
      values: ["bar", "line"],
      tier: "essential",
      description: "Visual form.",
    }),
    emphasizeLast: field.boolean({
      tier: "advanced",
      description: "Emphasize the newest value with the accent token.",
    }),
    interactive: field.boolean({
      tier: "essential",
      description: "Show values on hover and keyboard focus.",
    }),
    label: field.string({ tier: "essential", description: "Accessible name." }),
    width: field.number({ unit: "px", tier: "advanced", description: "Rendered width." }),
    height: field.number({ unit: "px", tier: "advanced", description: "Rendered height." }),
    fit: field.enum({
      values: ["fixed", "fill"],
      tier: "advanced",
      description: "fixed: draw at width×height. fill: measure the real CSS box width.",
    }),
    target: field.number({
      tier: "advanced",
      description: "A horizontal reference line drawn across the plot.",
    }),
    baseline: field.array({
      of: field.number(),
      tier: "advanced",
      description: "A comparison series, same index alignment as values.",
    }),
    band: field.array({
      of: field.number(),
      min: 2,
      max: 2,
      tier: "advanced",
      description: "A [lo, hi] normal range drawn as a quiet filled zone.",
    }),
    fitDomain: field.boolean({
      tier: "advanced",
      description: "variant=line only, with no target/baseline/band: use the series' own domain.",
    }),
    showLastValue: field.boolean({
      tier: "essential",
      description: "Render the formatted latest value as text.",
    }),
    lastValueSuffix: field.string({
      tier: "advanced",
      description: "Appended to the last-value text and the accessible name.",
    }),
    labels: field.object({
      fields: {
        target: field.string(),
        baseline: field.string(),
        band: field.string(),
        value: field.string(),
      },
      tier: "advanced",
      description: "Words for the reference facts in the accessible name and readout.",
    }),
    pointLabels: field.array({
      of: field.string(),
      tier: "advanced",
      description: "Names each point in the hover/keyboard readout's header.",
    }),
    className: field.string({ tier: "advanced", description: "Extra class names on the root." }),
  },
  codeOnly: ["formatValue"],
  defaults: {
    variant: "bar",
    interactive: true,
    width: 80,
    height: 20,
    fit: "fixed",
    fitDomain: false,
    showLastValue: false,
  },
  targets: [],
});
