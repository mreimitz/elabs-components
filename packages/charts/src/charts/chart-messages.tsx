"use client";

/**
 * chart-messages.tsx — the per-chart `messages` seam (ADR 0042 `messages`
 * group, RM-187).
 *
 * A chart family that lists the `messages` group wraps its subtree in
 * `ChartMessagesScope`; the words it prints read through
 * `useChartTranslate()`, which answers from the chart's own overrides first and
 * falls through to the ui `LocaleProvider` (`useLocale().t`) for every other
 * key. The keys are the ui catalogue's `charts.*` keys, so there is still one
 * English table (`DEFAULT_MESSAGES` in `@elabs-ai/components-ui`).
 *
 * A context rather than a nested `LocaleProvider`: that provider renders a
 * `<div dir>` wrapper (which would change the chart's layout box) and merges
 * its `messages` over the shipped defaults, not over the parent provider's —
 * a nested one would drop the app's own messages and `translate` resolver.
 * This context adds no DOM, and a scope nested in another scope merges over it.
 */

import { createContext, type ReactNode, use, useMemo } from "react";
import { type MessageValue, useLocale } from "@elabs-ai/components-ui";

import type { ChartTranslate } from "./chart-formatters";
import type { ChartMessages } from "./props/messages";

const ChartMessagesContext = createContext<ChartMessages | undefined>(undefined);

export interface ChartMessagesScopeProps {
  /** This chart's overrides, keyed by `charts.*` message keys. Unset = the catalogue. */
  messages?: ChartMessages;
  children?: ReactNode;
}

/** Scopes a chart's `messages` overrides to its subtree. Renders no DOM. */
export function ChartMessagesScope({ messages, children }: ChartMessagesScopeProps) {
  const parent = use(ChartMessagesContext);
  const merged = useMemo(
    () => (messages && parent ? { ...parent, ...messages } : (messages ?? parent)),
    [messages, parent],
  );
  if (!messages) return <>{children}</>;
  return <ChartMessagesContext value={merged}>{children}</ChartMessagesContext>;
}

function resolveOverride(
  template: MessageValue,
  vars: Record<string, string | number> | undefined,
  pluralRules: Intl.PluralRules,
  key: string,
): string {
  const form =
    typeof template === "string"
      ? template
      : (template[typeof vars?.count === "number" ? pluralRules.select(vars.count) : "other"] ??
        template.other ??
        key);
  if (!vars) return form;
  return form.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * `t` for chart words: the enclosing chart's `messages` override first, then
 * the ui `LocaleProvider` (its `translate` resolver, its `messages`, the
 * shipped English), exactly as `useLocale().t` resolves on its own.
 */
export function useChartTranslate(): ChartTranslate {
  const { t, locale } = useLocale();
  const overrides = use(ChartMessagesContext);
  return useMemo(() => {
    if (!overrides) return t;
    const pluralRules = new Intl.PluralRules(locale);
    return (key, vars) => {
      const template = overrides[key as keyof ChartMessages];
      return template === undefined
        ? t(key, vars)
        : resolveOverride(template, vars, pluralRules, key);
    };
  }, [t, locale, overrides]);
}
