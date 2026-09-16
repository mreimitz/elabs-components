/**
 * `Intl.*` formatting helpers shared by every KPI card block. Every function
 * takes an explicit `locale` (default `"en-US"`) rather than calling a bare
 * `toLocaleString()` — see `.claude/rules/conventions.md` § locale-formatting.
 */

/** The measurement a KPI's `actual`/`target`/… numbers are expressed in. */
export type KpiUnit = "currency" | "percent" | "count" | "score" | "hours";

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "EUR";

/** Format a plain (unsigned) KPI value for the given `unit`. */
export function formatKpiValue(
  value: number,
  unit: KpiUnit,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  switch (unit) {
    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "percent":
      // `value` is already a 0–100 percentage, not a 0–1 fraction.
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
    case "hours":
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} h`;
    case "score":
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    case "count":
    default:
      return new Intl.NumberFormat(locale, {
        notation: Math.abs(value) >= 1000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(value);
  }
}

/**
 * Format a SIGNED delta for `unit`. A `"percent"`-unit KPI's delta is
 * expressed in percentage points ("pp") — never re-run through the percent
 * formatter a second time, which would conflate "3 points" with "3 percent".
 */
export function formatKpiDelta(
  delta: number,
  unit: KpiUnit,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = Math.abs(delta);
  if (unit === "percent") {
    const pp = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs);
    return `${sign}${pp}pp`;
  }
  return `${sign}${formatKpiValue(abs, unit, locale, currency)}`;
}

/**
 * Relative percent change of `actual` vs `baseline` — meaningless (and
 * omitted, `null`) for a `"percent"`-unit KPI, whose own delta already reads
 * in percentage points via {@link formatKpiDelta}.
 */
export function formatPercentChange(
  actual: number,
  baseline: number,
  locale: string = DEFAULT_LOCALE,
): string | null {
  if (baseline === 0) return null;
  const pct = ((actual - baseline) / Math.abs(baseline)) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(pct))}%`;
}

/** `Intl.DateTimeFormat` freshness stamp for `KpiAsOf`. */
export function formatAsOf(date: Date, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
