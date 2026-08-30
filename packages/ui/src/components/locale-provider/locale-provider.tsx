"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { DEFAULT_MESSAGES, type MessageValue, type PluralCategory } from "./messages";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A flat map of string keys to their translated values — a plain string, or a
 * `PluralMessage` (one string per ICU cardinal-plural category, e.g.
 * `{ one: "{count} item", other: "{count} items" }`) for microcopy whose
 * wording changes with a count. See `PluralMessage` in `./messages`.
 */
export type Messages = Record<string, MessageValue>;

export interface LocaleContextValue {
  /** BCP-47 locale tag, e.g. "en-US", "ar-EG", "de-DE". */
  locale: string;
  /** Layout direction for the locale region. */
  dir: "ltr" | "rtl";
  /**
   * Translate a key.
   * Falls back to: an external `translate` resolver (if the provider was
   * given one) → consumer `messages` → English default → the key itself.
   * Supports simple `{name}`-style variable interpolation, and ICU
   * cardinal-plural forms (`Intl.PluralRules`) when the resolved message is a
   * `PluralMessage` map and `vars.count` is a number. Note: `count` must be a
   * number, not a numeric string (e.g., `count: 3`, not `count: "3"`) to select
   * the correct plural category.
   */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Format a number using the active locale. Memoized per locale+opts hash. */
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  /** Format a date using the active locale. Memoized per locale+opts hash. */
  formatDate: (d: Date | number, opts?: Intl.DateTimeFormatOptions) => string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LocaleContext = createContext<LocaleContextValue | null>(null);

// ---------------------------------------------------------------------------
// Default (no-provider) value — en-US / ltr
// ---------------------------------------------------------------------------

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/**
 * Resolve a `MessageValue` (a plain string or a `PluralMessage`) to its final,
 * interpolated string.
 *
 * A `PluralMessage` selects its category via `Intl.PluralRules(locale).select(count)`
 * when `vars.count` is a number; with no `count`, or when the selected
 * category has no entry, it falls back to `"other"` (the one category every
 * locale defines), then to the raw `key` if even `"other"` is missing.
 */
function resolveMessage(
  key: string,
  template: MessageValue,
  vars: Record<string, string | number> | undefined,
  pluralRules: Intl.PluralRules,
): string {
  if (typeof template === "string") return interpolate(template, vars);
  const count = typeof vars?.count === "number" ? vars.count : undefined;
  const category: PluralCategory = count !== undefined ? pluralRules.select(count) : "other";
  const form = template[category] ?? template.other ?? key;
  return interpolate(form, vars);
}

function makeDefaultValue(): LocaleContextValue {
  const locale = "en-US";
  // Simple cache: one Intl object per serialized opts string
  const numberCache = new Map<string, Intl.NumberFormat>();
  const dateCache = new Map<string, Intl.DateTimeFormat>();
  const pluralRules = new Intl.PluralRules(locale);

  return {
    locale,
    dir: "ltr",
    t(key, vars) {
      const template = DEFAULT_MESSAGES[key] ?? key;
      return resolveMessage(key, template, vars, pluralRules);
    },
    formatNumber(n, opts) {
      const k = JSON.stringify(opts ?? null);
      if (!numberCache.has(k)) numberCache.set(k, new Intl.NumberFormat(locale, opts));
      return numberCache.get(k)!.format(n);
    },
    formatDate(d, opts) {
      const k = JSON.stringify(opts ?? null);
      if (!dateCache.has(k)) dateCache.set(k, new Intl.DateTimeFormat(locale, opts));
      return dateCache.get(k)!.format(d);
    },
  };
}

// Singleton default — stable across renders when no provider is mounted
const DEFAULT_LOCALE_VALUE = makeDefaultValue();

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface LocaleProviderProps {
  /**
   * BCP-47 locale tag. Defaults to "en-US".
   * Used by `t`, `formatNumber`, and `formatDate`.
   */
  locale?: string;
  /**
   * Layout direction for the subtree.
   * Defaults to "ltr". Set "rtl" for Arabic, Hebrew, Farsi, etc.
   */
  dir?: "ltr" | "rtl";
  /**
   * Additional/overriding message strings merged on top of the shipped English
   * defaults. Only the keys you provide are overridden; the rest fall through
   * to the English bundle.
   */
  messages?: Messages;
  /**
   * Optional external resolver — hand brand-ui's microcopy off to an app's own
   * i18n runtime (next-intl, react-intl, i18next, …) instead of maintaining a
   * second, flattened message catalogue. Called with the raw key and vars
   * (not pre-interpolated), so a real ICU formatter gets real values and can
   * do its own pluralization/number/date formatting.
   *
   * Return a string to use it as-is (brand-ui does NOT re-run its own
   * `{name}` interpolation on it — the app's runtime already formatted it).
   * Return `undefined`/`null` to decline a key; brand-ui then falls back to
   * `messages` → `DEFAULT_MESSAGES` → the raw key, in that order — so a
   * resolver only needs to cover the keys it actually wants to override.
   * See `docs/I18N.md`.
   */
  translate?: (key: string, vars?: Record<string, string | number>) => string | undefined | null;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// LocaleProvider
// ---------------------------------------------------------------------------

/**
 * `LocaleProvider` supplies locale, layout direction, component microcopy, and
 * Intl formatting helpers to the component subtree.
 *
 * - Wrap your app (or a regional subtree) with it to localise brand-ui components.
 * - Components call `useLocale()` unconditionally; without a provider they
 *   degrade gracefully to "en-US" / "ltr" / English defaults.
 * - Portalled Radix content (Dialog, Sheet, Popover, DropdownMenu) still honors
 *   `dir` because the subtree is wrapped in Radix's `DirectionProvider`, which
 *   every Radix primitive reads via context regardless of DOM position (ADR-0014).
 *   The `<div dir={dir}>` continues to carry direction for non-Radix content.
 */
export function LocaleProvider({
  locale = "en-US",
  dir = "ltr",
  messages,
  translate,
  children,
}: LocaleProviderProps) {
  // Merge consumer messages over the shipped English defaults.
  const merged: Messages = useMemo(
    () => (messages ? { ...DEFAULT_MESSAGES, ...messages } : DEFAULT_MESSAGES),
    // We intentionally deep-compare via JSON only when messages reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages],
  );

  // Memoized Intl formatter caches — keyed by serialised opts
  const numberCache = useMemo(() => new Map<string, Intl.NumberFormat>(), [locale]);
  const dateCache = useMemo(() => new Map<string, Intl.DateTimeFormat>(), [locale]);
  const pluralRules = useMemo(() => new Intl.PluralRules(locale), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      t(key, vars) {
        // An external runtime (next-intl, react-intl, i18next, …) gets first
        // say, and its result is used AS-IS — it already interpolated and
        // pluralized. `undefined`/`null` means "I decline this key".
        const resolved = translate?.(key, vars);
        if (resolved != null) return resolved;
        const template = merged[key] ?? key;
        return resolveMessage(key, template, vars, pluralRules);
      },
      formatNumber(n, opts) {
        const k = JSON.stringify(opts ?? null);
        if (!numberCache.has(k)) numberCache.set(k, new Intl.NumberFormat(locale, opts));
        return numberCache.get(k)!.format(n);
      },
      formatDate(d, opts) {
        const k = JSON.stringify(opts ?? null);
        if (!dateCache.has(k)) dateCache.set(k, new Intl.DateTimeFormat(locale, opts));
        return dateCache.get(k)!.format(d);
      },
    }),
    [locale, dir, merged, numberCache, dateCache, pluralRules, translate],
  );

  return (
    <LocaleContext.Provider value={value}>
      {/*
       * `DirectionProvider` makes `dir` reach portalled Radix overlays (Dialog,
       * Sheet, Popover, DropdownMenu, Select, Tooltip, …) which escape the DOM
       * `dir` ancestor (ADR-0014). The `<div dir={dir}>` still carries direction
       * for non-Radix content.
       */}
      <DirectionProvider dir={dir}>
        <div dir={dir}>{children}</div>
      </DirectionProvider>
    </LocaleContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// useLocale
// ---------------------------------------------------------------------------

/**
 * Read the active locale, direction, `t`, `formatNumber`, and `formatDate`.
 *
 * Provider-optional: without a `<LocaleProvider>` this returns the en-US
 * defaults so components can call it unconditionally and remain usable in
 * unwrapped contexts.
 */
export function useLocale(): LocaleContextValue {
  // React 19 `use()` — can be called conditionally and composes with Suspense.
  const ctx = use(LocaleContext);
  return ctx ?? DEFAULT_LOCALE_VALUE;
}
