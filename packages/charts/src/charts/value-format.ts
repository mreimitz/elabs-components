/**
 * value-format.ts — the ONE answer to "how does a number become a string" in
 * `@elabs/components-charts`.
 *
 * Pure by design: types, constants and an `Intl.NumberFormatOptions` builder,
 * with no React and no `Intl` instances (those live behind the locale-keyed
 * cache in `chart-formatters.ts`). That is what lets `chart-spec.ts` — a
 * deliberately React-free, serializable-types module — re-export the format
 * union without gaining a runtime dependency.
 *
 * The default is COMPACT. A chat client, a KPI tile and a chart axis are all
 * narrow surfaces; `50012102.632741` is not a number a reader can take in, and
 * the axis' old hand-rolled `(v / 1000).toFixed(0) + "k"` rendered 1.5 million
 * as `1500k`. Exactness does not disappear — it moves to click-to-copy
 * (`CopyableValue` in `@elabs/components-ui`), which hands over
 * the unrounded value.
 */

/**
 * How a numeric value is rendered.
 *
 * - `"number"` — grouped, no compaction. The escape hatch when a reader needs
 *   the digits in place (`1,500,000`).
 * - `"compact"` — short compact notation above {@link COMPACT_THRESHOLD}
 *   (`1.5M`), plain grouped below it. The default.
 * - `"currency"` — same compaction rule, in a currency (`$1.5M`, `€820`).
 * - `"percent"` — `Intl` percent semantics, so **pass fractions**: `0.42`
 *   renders `42%`. Never compacted; a compact percentage reads as nonsense.
 */
export type ChartValueFormat = "number" | "compact" | "currency" | "percent";

/** Compact is the default everywhere — see the module doc for why. */
export const DEFAULT_CHART_VALUE_FORMAT: ChartValueFormat = "compact";

/**
 * Magnitude at or above which `compact`/`currency` switch to compact notation.
 *
 * Explicit rather than delegated to `Intl`, because ICU's own switch point has
 * moved between versions and a chart's tick labels must not change shape when
 * the runtime updates. Below it, compacting buys nothing: `840` is already as
 * short as it gets.
 */
export const COMPACT_THRESHOLD = 1000;

/** Used when neither the spec nor `ChartConfigProvider` names one. */
export const DEFAULT_CHART_CURRENCY = "USD";

/** One decimal keeps `1.5M` readable without implying precision it lacks. */
export const DEFAULT_MAX_FRACTION_DIGITS = 1;

/** Whether `value`'s magnitude earns compact notation. */
export function shouldCompact(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= COMPACT_THRESHOLD;
}

/**
 * `Intl.NumberFormatOptions` for `format` **at this magnitude** — the value is a
 * parameter because compaction is magnitude-dependent, and threading it here
 * keeps that decision in one place instead of at every call site.
 *
 * `maxFractionDigits` is only applied where it is meaningful; for `"number"` it
 * is left to `Intl`'s own default (3) unless the caller states one, so the
 * escape hatch really does render the digits.
 */
export function valueFormatOptions(
  format: ChartValueFormat,
  value: number,
  currency: string = DEFAULT_CHART_CURRENCY,
  maxFractionDigits?: number,
): Intl.NumberFormatOptions {
  // `"number"` is the exact-value escape hatch, so it must NOT inherit the
  // compact rung's single decimal — that would render 0.0512 as "0.1" in a
  // table cell or a tooltip, which is a data-fidelity loss, not a shortening.
  // Every other arm is compaction-shaped and takes the one-decimal default.
  const digits = maxFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS;

  switch (format) {
    case "number":
      return maxFractionDigits === undefined ? {} : { maximumFractionDigits: maxFractionDigits };

    case "percent":
      return { style: "percent", maximumFractionDigits: digits };

    case "currency":
      return shouldCompact(value)
        ? {
            style: "currency",
            currency,
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: digits,
          }
        : { style: "currency", currency, maximumFractionDigits: digits };

    case "compact":
    default:
      return shouldCompact(value)
        ? {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: digits,
          }
        : { maximumFractionDigits: digits };
  }
}

/**
 * The exact string to put on the clipboard for `value`.
 *
 * Deliberately NOT locale-formatted: a copied number is usually on its way into
 * a spreadsheet, a query or a message, where `1234.5` pastes correctly and
 * `1.234,5` does not. `Number.prototype.toString` never uses exponent notation
 * below 1e21, which covers every value a chart plots.
 */
export function exactValueString(value: number): string {
  return String(value);
}
