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
 *     active locale from `@elabs-ai/components-ui`'s `useLocale()` and returns formatters bound
 *     to it, so charts under a `<LocaleProvider locale="de-DE">` format in `de-DE`.
 *   - `shortDateFmt` / `weekdayDateFmt` / `hmsTimeFmt` / `intFmt` — backward-compatible
 *     bindings for existing direct callers. They now default to the HOST locale
 *     (`undefined`) instead of a hardcoded `"en-US"`, closing the hardcoded-en-US
 *     leak with zero ripple. Component call sites that must honor a
 *     provider-set locale should migrate to `useChartFormatters()`.
 */

import { useMemo } from "react";
import { DEFAULT_MESSAGES, useLocale } from "@elabs-ai/components-ui";
import { useChartConfig } from "./chart-config-context";
import {
  type ChartValueFormat,
  DEFAULT_CHART_VALUE_FORMAT,
  resolveChartValueFormat,
  valueFormatOptionsForSet,
} from "./value-format";
import { dateFormatOptionsForPreset, type DateFormatPreset } from "./date-format";

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
 * Applies the two things `Intl.NumberFormat` cannot express on its own —
 * literal `prefix`/`suffix` text and `sign: "parens"` — around an already-
 * resolved `Intl.NumberFormat` instance. Shared by `makeValueFmt` and
 * `makeValueSetFmt` so a spec's text wrapping never drifts between the two.
 */
function formatResolvedChartValue(
  resolved: Pick<ReturnType<typeof resolveChartValueFormat>, "prefix" | "suffix" | "parens">,
  fmt: Intl.NumberFormat,
  value: number,
): string {
  const numeric = fmt.format(resolved.parens ? Math.abs(value) : value);
  const signed = resolved.parens && value < 0 ? `(${numeric})` : numeric;
  return `${resolved.prefix}${signed}${resolved.suffix}`;
}

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
    const resolved = resolveChartValueFormat(format, value, currency, maxFractionDigits);
    return formatResolvedChartValue(resolved, getNumberFormat(locale, resolved.options), value);
  };
}

/**
 * SET formatter — one notation across a whole label set (an axis' ticks, a
 * bar set's value labels, a legend's values), per `valueFormatOptionsForSet`
 * (#250). Non-hook, explicit-locale path, siblings `makeValueFmt`.
 *
 * Positional primitives for the same `exhaustive-deps` reason as
 * `makeValueFmt`; `values` is read once to resolve the shared options, not
 * captured, so the returned closure stays a plain `(value) => string`.
 */
export function makeValueSetFmt(
  locale: string | undefined,
  values: readonly number[],
  format: ChartValueFormat = DEFAULT_CHART_VALUE_FORMAT,
  currency?: string,
  maxFractionDigits?: number,
): (value: number) => string {
  const options = valueFormatOptionsForSet(format, values, currency, maxFractionDigits);
  const fmt = getNumberFormat(locale, options);
  // `prefix`/`suffix`/`parens` are format-level, never magnitude-dependent
  // (unlike compaction), so resolving them once at `0` is the whole set's
  // shared answer — every member gets the same wrapping.
  const { prefix, suffix, parens } = resolveChartValueFormat(
    format,
    0,
    currency,
    maxFractionDigits,
  );
  return (value: number): string => {
    if (Number.isNaN(value)) {
      return "";
    }
    return formatResolvedChartValue({ prefix, suffix, parens }, fmt, value);
  };
}

/**
 * DATE formatter for one {@link DateFormatPreset} rung (RM-109) — the same
 * non-hook, explicit-locale path as `makeValueFmt`/`makeShortDateFmt`, siblings
 * for the ladder in `date-format.ts` instead of the fixed `"Mon d"` shape.
 *
 * `"yearShort"` gets the elision mark (`’16`, U+2019, per the repo's
 * micro-typography rule — never a straight `'`) prepended here: `Intl`'s
 * 2-digit-year option has no elision-mark equivalent of its own, and a bare
 * `"16"` reads as a small plain number, not a year (date-ladder round, #478).
 */
export const makeDateFmtForPreset =
  (locale: string | undefined, preset: DateFormatPreset) =>
  (date: Date): string => {
    const formatted = getDateFormat(locale, dateFormatOptionsForPreset(preset)).format(date);
    return preset === "yearShort" ? `’${formatted}` : formatted;
  };

// ── Backward-compatible host-default bindings (no more hardcoded en-US) ───────
// These honor the runtime host locale instead of forcing "en-US". They do NOT
// track a `LocaleProvider`-set locale. RM-187: no call site in this package
// reads them any more — every component formats through `useChartFormatters()`
// (or the value/set hooks below), every pure helper takes an explicit locale
// via the `make*` factories. They stay exported for consumers until 6.0.

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
 * chart COMPONENTS so date/number labels honor a consumer-set `locale`; without
 * a provider `useLocale()` answers `"en-US"`.
 *
 * `localeOverride` (RM-187) is a chart's own `locale` prop: when set it wins
 * over the provider's locale, so one chart can print in another locale than
 * the page around it.
 */
export function useChartFormatters(localeOverride?: string): ChartFormatters {
  const { locale: contextLocale } = useLocale();
  const locale = localeOverride ?? contextLocale;
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
  /** A chart's own `locale` prop (RM-187); wins over the provider's locale. */
  localeOverride?: string,
): (value: number) => string {
  const { locale: contextLocale } = useLocale();
  const locale = localeOverride ?? contextLocale;
  const { currency: configCurrency } = useChartConfig();
  const resolvedCurrency = currency ?? configCurrency;
  return useMemo(
    () => makeValueFmt(locale, format, resolvedCurrency, maxFractionDigits),
    [locale, format, resolvedCurrency, maxFractionDigits],
  );
}

/**
 * The SET value formatter for chart COMPONENTS (#250): one notation across
 * `values` — an axis' ticks, a bar set's value labels, a legend's `lo`/`hi`
 * pair. Same locale/currency resolution as `useChartValueFormatter`; use
 * this instead of it whenever several numbers share one scale.
 *
 * Memoised on a STABLE key derived from `values` (its length + rounded
 * members), never the array's identity — an inline array literal argument
 * takes a fresh identity every render, which would poison `YAxisInner`'s
 * dependency arrays exactly as `makeValueFmt`'s docblock warns about for
 * options objects (`react-hooks/exhaustive-deps` is an error in this
 * package).
 */
export function useChartValueSetFormatter(
  values: readonly number[],
  format?: ChartValueFormat,
  currency?: string,
  maxFractionDigits?: number,
  /** A chart's own `locale` prop (RM-187); wins over the provider's locale. */
  localeOverride?: string,
): (value: number) => string {
  const { locale: contextLocale } = useLocale();
  const locale = localeOverride ?? contextLocale;
  const { currency: configCurrency } = useChartConfig();
  const resolvedCurrency = currency ?? configCurrency;
  // Coarse but stable: two magnitude-equivalent sets (same finite/compact
  // shape) share a key, so a benign re-render (new array, same values) does
  // not re-resolve the `Intl` options.
  const valuesKey = values.map((v) => (Number.isFinite(v) ? v : "NaN")).join(",");
  return useMemo(
    () => makeValueSetFmt(locale, values, format, resolvedCurrency, maxFractionDigits),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `valuesKey` IS the stable identity for `values` (see docblock); listing `values` itself would defeat the memo every render.
    [locale, valuesKey, format, resolvedCurrency, maxFractionDigits],
  );
}

/**
 * The SET value formatter as a factory (RM-187, #250): the hook resolves the
 * locale and currency once, and the returned function builds a set formatter
 * for whatever set a render computes — an axis' `scale.ticks(4)`, a legend's
 * step bounds — without having to call a hook where that set is known.
 *
 * Same resolution as `useChartValueSetFormatter`; `makeValueSetFmt` rides
 * `getNumberFormat`'s cache, so building one per render costs a `Map` lookup.
 */
export function useChartValueSetFormatterFactory(
  format?: ChartValueFormat,
  currency?: string,
  maxFractionDigits?: number,
  localeOverride?: string,
): (values: readonly number[]) => (value: number) => string {
  const { locale: contextLocale } = useLocale();
  const { currency: configCurrency } = useChartConfig();
  const locale = localeOverride ?? contextLocale;
  const resolvedCurrency = currency ?? configCurrency;
  return useMemo(
    () => (values: readonly number[]) =>
      makeValueSetFmt(locale, values, format, resolvedCurrency, maxFractionDigits),
    [locale, format, resolvedCurrency, maxFractionDigits],
  );
}

// ── Messages outside a component (RM-187) ─────────────────────────────────────

/** The shape of `useLocale().t`, for pure helpers that take one. */
export type ChartTranslate = (key: string, vars?: Record<string, string | number>) => string;

const EN_PLURAL_RULES = new Intl.PluralRules("en-US");

/**
 * The no-provider `t` for PURE helpers (`networkSummary`, `heatmapSummary`)
 * whose callers pass no translator: it reads the ui catalogue's own
 * `DEFAULT_MESSAGES` — the same English a provider-less `useLocale().t`
 * returns — so the words never live in a second table here.
 */
export const defaultChartTranslate: ChartTranslate = (key, vars) => {
  const template = DEFAULT_MESSAGES[key] ?? key;
  const form =
    typeof template === "string"
      ? template
      : (template[typeof vars?.count === "number" ? EN_PLURAL_RULES.select(vars.count) : "other"] ??
        template.other ??
        key);
  if (!vars) return form;
  return form.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
};
