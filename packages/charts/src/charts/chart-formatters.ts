"use client";

/**
 * Locale-aware chart formatters (ADR-0014 §(b)).
 *
 * Previously these were four MODULE-LEVEL `Intl` singletons hardcoding `"en-US"`,
 * which defeated `LocaleProvider` for any non-English consumer (#181). They are
 * now a locale-parameterized seam:
 *
 *   - `getDateFormat(locale, opts)` / `getNumberFormat(locale, opts)` — cached
 *     `Intl` factories (one object per `locale+opts`, so we don't re-allocate).
 *   - `makeShortDateFmt(locale)` / … — the ADR's non-hook explicit-locale path
 *     for module-scope / non-component callers.
 *   - `useChartFormatters()` — the hook path for chart COMPONENTS: it reads the
 *     active locale from `@elabs/components-ui`'s `useLocale()` and returns formatters bound
 *     to it, so charts under a `<LocaleProvider locale="de-DE">` format in `de-DE`.
 *   - `shortDateFmt` / `weekdayDateFmt` / `hmsTimeFmt` / `intFmt` — backward-compatible
 *     bindings for existing direct callers. They now default to the HOST locale
 *     (`undefined`) instead of a hardcoded `"en-US"`, closing the hardcoded-en-US
 *     leak with zero ripple. Component call sites that must honor a
 *     provider-set locale should migrate to `useChartFormatters()`.
 */

import { useMemo } from "react";
import { useLocale } from "@elabs/components-ui";
import { useChartConfig } from "./chart-config-context";
import {
  type ChartValueFormat,
  DEFAULT_CHART_VALUE_FORMAT,
  valueFormatOptions,
} from "./value-format";

// ── Cached Intl factories (keyed by locale + serialized options) ──────────────

const dateFormatCache = new Map<string, Intl.DateTimeFormat>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

/** Cached `Intl.DateTimeFormat` for a locale (`undefined` = host default) + options. */
export function getDateFormat(
  locale: string | undefined,
  opts?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(opts ?? null)}`;
  let fmt = dateFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    dateFormatCache.set(key, fmt);
  }
  return fmt;
}

/** Cached `Intl.NumberFormat` for a locale (`undefined` = host default) + options. */
export function getNumberFormat(
  locale: string | undefined,
  opts?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(opts ?? null)}`;
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, opts);
    numberFormatCache.set(key, fmt);
  }
  return fmt;
}

// ── Option presets ────────────────────────────────────────────────────────────

const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const WEEKDAY_DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};
const HMS_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

// ── Factory functions (ADR-0014 non-hook explicit-locale path) ────────────────

/** `{month:"short", day:"numeric"}` date formatter bound to `locale` (host default when omitted). */
export const makeShortDateFmt = (locale?: string): Intl.DateTimeFormat =>
  getDateFormat(locale, SHORT_DATE_OPTS);

/** `{weekday, month, day}` date formatter bound to `locale` (host default when omitted). */
export const makeWeekdayDateFmt = (locale?: string): Intl.DateTimeFormat =>
  getDateFormat(locale, WEEKDAY_DATE_OPTS);

/** 24h `HH:MM:SS` time formatter bound to `locale` (host default when omitted). */
export const makeHmsTimeFmt = (locale?: string): Intl.DateTimeFormat =>
  getDateFormat(locale, HMS_TIME_OPTS);

/** Integer/number formatter bound to `locale` (host default when omitted). */
export const makeIntFmt =
  (locale?: string) =>
  (n: number): string =>
    getNumberFormat(locale).format(n);

/**
 * VALUE formatter — the one every axis, tick, tooltip, table cell and detail
 * stat goes through (see `value-format.ts` for the contract). Non-hook,
 * explicit-locale path, per ADR-0014.
 *
 * Positional primitives, never an options object: the returned function is
 * memoised by its callers, and an object literal argument would take a fresh
 * identity on every render, defeat that memo, and poison the dependency arrays
 * of `YAxisInner` and friends — where `react-hooks/exhaustive-deps` is an ERROR
 * in this package.
 *
 * The `Intl` instance is resolved per call because compaction depends on the
 * value's magnitude; `getNumberFormat`'s cache means that costs a `Map` lookup,
 * not an allocation.
 */
export function makeValueFmt(
  locale?: string,
  format: ChartValueFormat = DEFAULT_CHART_VALUE_FORMAT,
  currency?: string,
  maxFractionDigits?: number,
): (value: number) => string {
  return (value: number): string => {
    // A hole in the data is not a number — printing "NaN" on an axis is worse
    // than printing nothing. Infinities still format ("∞"), which is truthful.
    if (Number.isNaN(value)) {
      return "";
    }
    return getNumberFormat(
      locale,
      valueFormatOptions(format, value, currency, maxFractionDigits),
    ).format(value);
  };
}

// ── Backward-compatible host-default bindings (no more hardcoded en-US) ───────
// These honor the runtime host locale instead of forcing "en-US". They do NOT
// track a `LocaleProvider`-set locale — component call sites that need that use
// `useChartFormatters()` below (charts → ui, ADR-0014).

export const shortDateFmt = makeShortDateFmt();
export const weekdayDateFmt = makeWeekdayDateFmt();
export const hmsTimeFmt = makeHmsTimeFmt();

// `Intl.NumberFormat.prototype.format` is a bound getter — the factory returns a
// plain `(n) => string`, preserving the original `intFmt(value)` call signature.
export const intFmt = makeIntFmt();

// ── Hook path: formatters bound to the active LocaleProvider locale ───────────

export interface ChartFormatters {
  shortDateFmt: Intl.DateTimeFormat;
  weekdayDateFmt: Intl.DateTimeFormat;
  hmsTimeFmt: Intl.DateTimeFormat;
  intFmt: (n: number) => string;
}

/**
 * Chart formatters bound to the active `LocaleProvider` locale (ADR-0014). Use in
 * chart COMPONENTS so date/number labels honor a consumer-set `locale`; falls
 * back to the host default locale when no provider is mounted.
 */
export function useChartFormatters(): ChartFormatters {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      shortDateFmt: makeShortDateFmt(locale),
      weekdayDateFmt: makeWeekdayDateFmt(locale),
      hmsTimeFmt: makeHmsTimeFmt(locale),
      intFmt: makeIntFmt(locale),
    }),
    [locale],
  );
}

/**
 * The value formatter for chart COMPONENTS: locale from `LocaleProvider`,
 * currency resolved caller → `ChartConfigProvider` → `"USD"`.
 *
 * Currency is never derived from the locale — a `de-DE` reader looking at a
 * dollar figure needs `1,5 Mio. $`, not `1,5 Mio. €`. Only the app knows which
 * currency its numbers are in.
 */
export function useChartValueFormatter(
  format?: ChartValueFormat,
  currency?: string,
  maxFractionDigits?: number,
): (value: number) => string {
  const { locale } = useLocale();
  const { currency: configCurrency } = useChartConfig();
  const resolvedCurrency = currency ?? configCurrency;
  return useMemo(
    () => makeValueFmt(locale, format, resolvedCurrency, maxFractionDigits),
    [locale, format, resolvedCurrency, maxFractionDigits],
  );
}
