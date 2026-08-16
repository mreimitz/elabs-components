"use client";

/**
 * Streamdown's own chrome microcopy, resolved through the brand locale seam.
 *
 * Why this lives in `@qlik-coe-emea/qlabs-components-ui` and not next to the
 * renderer that uses it (#310, ADR 0017): Streamdown draws controls INSIDE the
 * markdown it renders — a code-block copy button, table copy/download menus, a
 * Mermaid toolbar, an external-link interstitial. Those labels live in the
 * dependency, so `pnpm microcopy:check` structurally cannot see them and a
 * `<LocaleProvider>` used to stop dead at the Streamdown boundary. TWO packages
 * now render Streamdown — `@qlik-coe-emea/qlabs-components-ai` (chat answers,
 * `MarkdownView`) and `@qlik-coe-emea/qlabs-components-viewer` (a markdown FILE
 * someone opened) — and they may not import each other, so the shared half sits
 * one layer down where both can reach it.
 *
 * Deliberately NO import of `streamdown`, not even a type: this keeps the
 * base package free of a dependency it would otherwise carry for every consumer
 * of every component. The COMPLETENESS of the key list is proved where the
 * dependency actually is — see `packages/ai/src/_streamdown-i18n.ts`, whose
 * compile-time assertion fails the build if a Streamdown upgrade adds a key.
 * That is the right split: the base package owns the wiring, the package that
 * pins the version owns the tripwire.
 *
 * The English defaults in `./components/locale-provider/messages.ts` are
 * byte-identical to Streamdown's own, so this is a no-op for anyone who
 * overrides nothing.
 */

import { useMemo } from "react";

import { useLocale } from "../components/locale-provider";

/**
 * Every key of `StreamdownTranslations` as of streamdown@2.5.0.
 *
 * Kept explicit rather than derived from `defaultTranslations`, so the list is
 * readable data here and checkable against the real type over in `ai`.
 */
export const STREAMDOWN_TRANSLATION_KEYS = [
  "close",
  "copied",
  "copyCode",
  "copyLink",
  "copyTable",
  "copyTableAsCsv",
  "copyTableAsMarkdown",
  "copyTableAsTsv",
  "downloadDiagram",
  "downloadDiagramAsMmd",
  "downloadDiagramAsPng",
  "downloadDiagramAsSvg",
  "downloadFile",
  "downloadImage",
  "downloadTable",
  "downloadTableAsCsv",
  "downloadTableAsMarkdown",
  "exitFullscreen",
  "externalLinkWarning",
  "imageNotAvailable",
  "mermaidFormatMmd",
  "mermaidFormatPng",
  "mermaidFormatSvg",
  "openExternalLink",
  "openLink",
  "tableFormatCsv",
  "tableFormatMarkdown",
  "tableFormatTsv",
  "viewFullscreen",
] as const;

export type StreamdownTranslationKey = (typeof STREAMDOWN_TRANSLATION_KEYS)[number];

/** What Streamdown's `translations` prop takes, expressed without importing it. */
export type StreamdownTranslationMap = Record<StreamdownTranslationKey, string>;

/**
 * Resolve every Streamdown label through `t()`.
 *
 * Provider-optional, like `useLocale()` itself: with no `<LocaleProvider>` every
 * key resolves to the shipped English default.
 *
 * Memoization matters — Streamdown puts `translations` into a React context, so
 * a fresh object per render would re-render every code block and table in the
 * document. The map is memoized on `t`, which is stable per locale.
 */
export function useStreamdownTranslations(): StreamdownTranslationMap {
  const { t } = useLocale();
  return useMemo(() => {
    const resolved = {} as StreamdownTranslationMap;
    for (const key of STREAMDOWN_TRANSLATION_KEYS) {
      // The `ai.streamdown.*` namespace is kept as-is although this now serves
      // two packages: the keys name STREAMDOWN's chrome, not any one package's,
      // and renaming them would silently drop every consumer's overrides.
      resolved[key] = t(`ai.streamdown.${key}`);
    }
    return resolved;
  }, [t]);
}
