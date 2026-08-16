/**
 * Shared "is this x value actually a Date" crash-guard helpers (#352).
 *
 * `xAccessor` (in `time-series-chart-shell.tsx` and `scatter-chart-shell.tsx`)
 * coerces any `xDataKey` value via `new Date(...)`; a non-Date-coercible value
 * (e.g. a categorical string like `"Turn 1"`) produces an Invalid Date whose
 * `.getTime()` is `NaN`. Every direct date-format call site must guard against
 * it — `Intl.DateTimeFormat.prototype.format` throws `RangeError: Invalid time
 * value` on an Invalid Date, which otherwise crashes the whole chart from deep
 * inside a date-label memo. Extracted to one module so both cartesian chart
 * shells apply the identical guard instead of drifting (the ScatterChart P0
 * this fixes was an un-synced copy of the LineChart/AreaChart guard).
 */

/** True when `date` is an Invalid Date (`new Date(nonCoercibleValue)`). */
export function isInvalidDate(date: Date): boolean {
  return Number.isNaN(date.getTime());
}

/** Fallback label for a non-Date x value: the raw value, stringified. */
export function fallbackXLabel(rawValue: unknown): string {
  return rawValue == null ? "" : String(rawValue);
}
