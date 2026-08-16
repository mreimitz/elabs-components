/**
 * compact-number.ts — the same "shown short, copied exact" number rule the
 * charts package applies to axis ticks and tooltips, available to `ui` surfaces
 * that display a figure (today: `MetricCard`).
 *
 * DELIBERATE TWIN of `packages/charts/src/charts/value-format.ts`. Dependencies
 * flow one way — `tokens → ui → charts` — so `ui` cannot import the charts
 * module, and a chart-domain union does not belong in the `ui` public API just
 * to be shared. The duplication is ~20 lines and the two must stay in step:
 * **change one, change the other**, and keep {@link COMPACT_THRESHOLD} equal in
 * both. `metric-card.test.tsx` and `value-format.test.ts` pin the same cases on
 * each side so a drift shows up as a failing test rather than as two surfaces
 * disagreeing about what `1500` looks like.
 */

/** How a numeric value is rendered. Mirrors the charts `ChartValueFormat`. */
export type NumberFormatKind = "number" | "compact" | "currency" | "percent";

/** Magnitude at or above which `compact`/`currency` switch to compact notation. */
export const COMPACT_THRESHOLD = 1000;

/** Used when a caller asks for currency without naming one. */
export const DEFAULT_CURRENCY = "USD";

/** One decimal keeps `1.5M` readable without implying precision it lacks. */
export const DEFAULT_MAX_FRACTION_DIGITS = 1;

/** `Intl.NumberFormatOptions` for `format` at this magnitude. */
export function numberFormatOptions(
  format: NumberFormatKind,
  value: number,
  currency: string = DEFAULT_CURRENCY,
  maxFractionDigits?: number,
): Intl.NumberFormatOptions {
  const compact = Number.isFinite(value) && Math.abs(value) >= COMPACT_THRESHOLD;
  // `"number"` is the exact-value escape hatch and keeps `Intl`'s own default
  // (3 digits) unless the caller states one — capping it at the compact rung's
  // single decimal would render 0.0512 as "0.1".
  const digits = maxFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS;
  switch (format) {
    case "number":
      return maxFractionDigits === undefined ? {} : { maximumFractionDigits: maxFractionDigits };
    case "percent":
      return { style: "percent", maximumFractionDigits: digits };
    case "currency":
      return compact
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
      return compact
        ? { notation: "compact", compactDisplay: "short", maximumFractionDigits: digits }
        : { maximumFractionDigits: digits };
  }
}
