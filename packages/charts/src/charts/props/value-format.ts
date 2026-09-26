/**
 * value-format group — how a chart prints its numbers (ADR 0042 §4, RM-174).
 * Applies to every chart kind. An unset `currency` falls back to the host
 * config (`ChartConfigValue.currency`); every other unset member falls back to
 * the family's or the formatter's own default.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ChartValueFormat } from "../value-format";

/** The value-format members. */
export interface ValueFormatGroupProps {
  valueFormat?: ChartValueFormat;
  locale?: string;
  currency?: string;
  maxFractionDigits?: number;
}

// No member has a group default. The families disagree on `valueFormat`:
// Network and Treemap default it to `"compact"` (`network/network-chart.tsx:209`,
// `treemap/treemap-chart.tsx:217`), Choropleth to `"number"`
// (`config.valueFormat ?? "number"`, `choropleth/choropleth-chart.tsx:903`).
// No container declares `locale` or `maxFractionDigits` yet, and an unset
// `currency` must keep deferring to the host config.
export const valueFormatGroup = /* @__PURE__ */ definePropGroup<ValueFormatGroupProps>()({
  id: "value-format",
  fields: {
    valueFormat: field.union({
      of: [
        field.enum({ values: ["number", "compact", "currency", "percent"] }),
        field.object({
          fields: {
            style: field.enum({ values: ["number", "currency", "percent"] }),
            decimals: field.number(),
            optionalDecimals: field.boolean(),
            abbreviate: field.union({ of: [field.boolean(), field.enum({ values: ["auto"] })] }),
            sign: field.enum({ values: ["auto", "always", "parens"] }),
            prefix: field.string(),
            suffix: field.string(),
            grouping: field.boolean(),
            currency: field.string(),
          },
        }),
      ],
      tier: "essential",
      description:
        "How values are printed: a preset, or a spec for decimals, sign, prefix and suffix.",
    }),
    locale: field.string({
      tier: "advanced",
      description: "BCP 47 locale the numbers are formatted in.",
    }),
    currency: field.string({
      tier: "advanced",
      description: "ISO 4217 currency code for currency values.",
    }),
    maxFractionDigits: field.number({
      tier: "advanced",
      description: "Most digits printed after the decimal point.",
    }),
  },
});
