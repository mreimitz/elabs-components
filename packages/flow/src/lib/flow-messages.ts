"use client";

import { useCallback } from "react";
import { useLocale, type MessageValue } from "@elabs-ai/components-ui";

/**
 * English defaults for flow's microcopy, keyed like every other package's
 * (`flow.<area>.<key>`) and resolved through the same `LocaleProvider` seam: an app's
 * `messages` or `translate` resolver wins, and this table is only the fallback.
 *
 * The table lives here rather than in `@elabs-ai/components-ui`'s `DEFAULT_MESSAGES`
 * only until that shared catalogue can take it. When it does, the entries move there
 * and `useFlowMessage` becomes a plain `t()` — `flow-messages.test.ts` fails the day a
 * key exists in both places, so the copy here cannot silently go stale.
 */
export const FLOW_DEFAULT_MESSAGES = {
  // Tone and emphasis names — the `sr-only` text that stands in for a node's glyph.
  "flow.tone.info": "Info",
  "flow.tone.success": "Success",
  "flow.tone.warning": "Warning",
  "flow.tone.destructive": "Destructive",
  "flow.emphasis.featured": "Featured",
  // FlowGroupNode's header: the collapse toggle and the child-count badge.
  "flow.groupNode.expand": "Expand group {title}",
  "flow.groupNode.collapse": "Collapse group {title}",
  "flow.groupNode.childCount": { one: "{count} node", other: "{count} nodes" },
  // FlowPlaceholderNode's default title.
  "flow.placeholderNode.title": "Add node",
  // FlowButtonEdge's insert button.
  "flow.buttonEdge.insert": "Insert node on edge",
  // Accessible names of the edges whose meaning is carried by shape.
  "flow.selfLoopEdge.name": "Self-loop on {node} — this step repeats",
  "flow.weightedEdge.backName": "Back edge — runs against the process direction",
  // ZoomControls.
  "flow.zoomControls.zoomIn": "Zoom in",
  "flow.zoomControls.zoomOut": "Zoom out",
  "flow.zoomControls.fitView": "Fit view",
} as const satisfies Record<string, MessageValue>;

export type FlowMessageKey = keyof typeof FLOW_DEFAULT_MESSAGES;

export type FlowMessageVars = Record<string, string | number>;

/** A resolved-message function: `msg("flow.zoomControls.zoomIn")`. */
export type FlowMessageFn = (key: FlowMessageKey, vars?: FlowMessageVars) => string;

function interpolate(template: string, vars?: FlowMessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesByLocale.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesByLocale.set(locale, rules);
  }
  return rules;
}

/**
 * Format one of flow's English defaults — pure, no React. Mirrors the locale seam's own
 * rules: `{name}` interpolation, and an ICU cardinal-plural pick when the message is a
 * plural map and `vars.count` is a number (falling back to `other`).
 */
export function formatFlowMessage(
  key: FlowMessageKey,
  vars?: FlowMessageVars,
  locale = "en-US",
): string {
  const template: MessageValue = FLOW_DEFAULT_MESSAGES[key];
  if (typeof template === "string") return interpolate(template, vars);
  const count = typeof vars?.count === "number" ? vars.count : undefined;
  const category = count === undefined ? "other" : pluralRules(locale).select(count);
  return interpolate(template[category] ?? template.other ?? key, vars);
}

/**
 * Flow's `t()`: resolves a `flow.*` key through the nearest `LocaleProvider` (an app's
 * `translate` resolver, then its `messages`, then the shared catalogue) and falls back
 * to `FLOW_DEFAULT_MESSAGES` when none of those knows the key. Call sites name the
 * result `msg`, so a key reads `msg("flow.zoomControls.zoomIn")`.
 */
export function useFlowMessage(): FlowMessageFn {
  const { t, locale } = useLocale();
  return useCallback(
    (key, vars) => {
      const resolved = t(key, vars);
      return resolved === key ? formatFlowMessage(key, vars, locale) : resolved;
    },
    [t, locale],
  );
}
