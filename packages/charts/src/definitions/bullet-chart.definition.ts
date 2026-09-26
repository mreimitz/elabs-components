/**
 * BulletChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `BulletChart` (`charts/bullet-chart.tsx`). `showAxis` and `valueFormat` have no kind
 * default: `showAxis` computes from `size` (`size === "md"`) when unset, and `valueFormat`
 * is resolved by `useChartValueSetFormatter` itself — neither is a literal destructuring
 * default, so filling either as a kind default would change what a caller who left it
 * unset gets back from `resolveProps`.
 *
 * `BulletChartProps` extends `Omit<HTMLAttributes<HTMLDivElement>, "children">`, spread
 * onto the root `<div>` via `...rest` — the raw DOM attribute grab-bag is real but not a
 * documented, schema-worthy surface, so the definition's props type omits it (keeping only
 * `className`) rather than declaring a codeOnly entry for each key. No behaviour change.
 *
 * RM-183 (F12): `margin`/`plotHeight`/`status`/`currency`/`maxFractionDigits` are new. None
 * has a kind default — `margin`/`plotHeight`/`currency`/`maxFractionDigits` have no group
 * default either (`props/frame-size.ts`, `props/value-format.ts`); `status` keeps the
 * `chart-state` group's own `"ready"` default. `contract.hasStatus` stays unset: it only gates
 * `dataKind: "array"` families, and Bullet's `dataKind` is `"none"`.
 *
 * RM-187: the group's `locale` member is listed — the formatter behind `valueFormat`
 * takes the chart's own `locale` over the `LocaleProvider`'s.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { valueFormatGroup } from "../charts/props/value-format";
import type { BulletChartProps } from "../charts/bullet-chart";
import { partialFieldFor } from "../charts/props/typed-field";
import { classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
import { defineChart } from "./define-chart";

type BulletChartDefinitionProps = Omit<BulletChartProps, keyof HTMLAttributes<HTMLDivElement>> &
  Pick<BulletChartProps, "className">;

export const BULLET_CHART = /* @__PURE__ */ defineChart<BulletChartDefinitionProps>()({
  id: "BulletChart",
  version: 1,
  label: "Bullet chart",
  description: "A single value against a target and qualitative ranges, word-sized.",
  specTypes: [],
  // `currency`, `maxFractionDigits` and `locale` (RM-187) extend `valueFormat` as own
  // fields referencing the group's field objects.
  groups: [a11yGroup, frameSizeGroup],
  fields: {
    // Palette — RM-186: no default; unset keeps the family's own colours.
    palette: paletteGroup.fields.palette,
    value: field.number({ required: true, tier: "essential", description: "The actual value." }),
    target: field.number({ tier: "essential", description: "The target, drawn as a tick." }),
    comparative: field.number({
      tier: "advanced",
      description: "A second reference, e.g. last year.",
    }),
    bands: field.array({
      of: field.object({
        fields: {
          to: field.number({ required: true }),
          label: field.string({ required: true }),
        },
      }),
      tier: "advanced",
      description: "Qualitative ranges, ascending, drawn as neutral steps behind the bar.",
    }),
    min: field.number({ tier: "advanced", description: "Scale floor." }),
    max: field.number({ tier: "advanced", description: "Scale ceiling." }),
    orientation: field.enum({
      values: ["horizontal", "vertical"],
      tier: "essential",
      description: "Bar direction.",
    }),
    size: field.enum({
      values: ["sm", "md"],
      tier: "essential",
      description: "sm is word-sized with no axis; md adds a hairline tick axis.",
    }),
    showAxis: field.boolean({ tier: "advanced", description: "Show the hairline tick axis." }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    labels: partialFieldFor<BulletChartProps["labels"]>()(
      field.object({
        fields: {
          value: field.string(),
          target: field.string(),
          comparative: field.string(),
        },
        tier: "advanced",
        description: "Names interpolated into the accessible description.",
      }),
    ),
    higherIsBetter: field.boolean({
      tier: "advanced",
      description: "Whether ascending band values read better for this measure.",
    }),
    className: classNameField,
    margin: frameSizeGroup.fields.margin,
    plotHeight: frameSizeGroup.fields.plotHeight,
    status: chartStateGroup.fields.status,
    currency: valueFormatGroup.fields.currency,
    maxFractionDigits: valueFormatGroup.fields.maxFractionDigits,
    locale: valueFormatGroup.fields.locale,
  },
  codeOnly: [],
  defaults: {
    orientation: "horizontal",
    size: "sm",
    higherIsBetter: true,
  },
  targets: [],
  contract: {
    dataKind: "none",
    requiredProps: ["value"],
    numericProps: ["target", "comparative", "min", "max"],
  },
});
