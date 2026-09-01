"use client";

/**
 * The shared Streamdown wiring for every streamed-markdown surface in
 * `@elabs-ai/components-ai` — the plugin set and the locale bridge.
 *
 * Why the locale bridge exists (#310)
 * -----------------------------------
 * Streamdown renders its own chrome inside the markdown it draws: a code-block
 * header with a copy control, table copy/download menus, a Mermaid toolbar, an
 * external-link interstitial. Those labels live in the dependency, not in our
 * source, so `pnpm microcopy:check` structurally cannot see them and a
 * `<LocaleProvider>` used to stop at the Streamdown boundary — every localized
 * app leaked "Copy Code" / "Download diagram" / "You're about to visit an
 * external website." in English.
 *
 * Streamdown exposes the whole set through one `translations` prop, so the fix
 * is to map its keys onto our `ai.streamdown.*` namespace and resolve them with
 * `t()`. The English defaults in
 * `packages/ui/src/components/locale-provider/messages.ts` are byte-identical to
 * streamdown's own, so this is a no-op for anyone who overrides nothing.
 *
 * Memoization matters: Streamdown puts `translations` into a React context, so a
 * fresh object per render would re-render every code block and table in the
 * document. The map is memoized on `t`, which is itself stable per locale.
 */
import {
  STREAMDOWN_TRANSLATION_KEYS,
  useStreamdownTranslations,
  type StreamdownTranslationKey,
} from "@elabs-ai/components-ui";
import { cjk } from "@streamdown/cjk";
import { createCodePlugin } from "@streamdown/code";
import { math } from "@streamdown/math";
import { useEffect, useMemo, useState } from "react";
import type { StreamdownTranslations } from "streamdown";
import { buildCodeBlockTheme } from "./_code-block-theme";
import { lazyMermaid } from "./_lazy-mermaid";

/**
 * Reactive replacement for `@streamdown/code`'s pre-configured `code` export
 * (issue #315 follow-up, the "major" carve-out: only `<CodeBlock>` had been
 * de-GitHub-ed — every fenced code block rendered through `Message`/
 * `MarkdownView`/`Reasoning`'s Streamdown instance still went through this
 * plugin, whose `getThemes()` is FROZEN at import time to
 * `["github-light", "github-dark"]`).
 *
 * Streamdown's dual-theme mechanism (`createCodePlugin({ themes: [light, dark] })`)
 * expects exactly TWO themes and picks between them purely via the `.dark` CSS
 * selector — but brand-ui ships EVERY theme, not just Shiki's light/dark,
 * and any dark-declaring theme matches `.dark` too (see `_code-block-theme.ts`). Passing a real
 * light/dark PAIR would still force such a theme into the dark slot. Instead
 * this pins BOTH slots to `buildCodeBlockTheme()` — the SAME brand-token-derived
 * theme the active `data-theme` resolves to — so whichever slot the `.dark`
 * selector picks, it's the CORRECT theme for whatever is actually active.
 *
 * Re-derives on every `data-theme` mutation (a `MutationObserver` on
 * `<html>`, mirroring `code-block.tsx`'s own) and returns a NEW plugin object
 * each time, because Streamdown only re-reads `plugins.code.getThemes()` when
 * the `plugins.code` object's REFERENCE changes (see streamdown's internal
 * `shikiTheme` memo) — a mutated-in-place plugin would never be picked up.
 */
function useReactiveCodePlugin() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => setRevision((r) => r + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    const theme = buildCodeBlockTheme();
    return createCodePlugin({ themes: [theme, theme] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the trigger; the theme itself is re-read live off document.documentElement.
  }, [revision]);
}

/**
 * The plugin set every `@elabs-ai/components-ai` markdown surface renders with.
 *
 * `mermaid` is the LAZY plugin (`./_lazy-mermaid`): the engine + d3 + DOMPurify
 * load on first diagram render, not in the entry chunk of every consumer. `code`
 * is the reactive, brand-token-derived plugin above (#315) — never the
 * `@streamdown/code` package's static `github-light`/`github-dark` default.
 * Memoized so Streamdown sees a referentially stable `plugins` prop except when
 * the active theme actually changes.
 */
export function useStreamdownPlugins() {
  const code = useReactiveCodePlugin();
  return useMemo(() => ({ cjk, code, math, mermaid: lazyMermaid }), [code]);
}

/*
 * The translation MAP moved down to `@elabs-ai/components-ui`
 * (`lib/streamdown-translations.ts`) when `@elabs-ai/components-viewer`
 * became a second Streamdown renderer — the two packages may not import each
 * other. What stays here is the half that needs the dependency itself: the
 * proof that the shared key list is still COMPLETE.
 */

// `satisfies` proves every key in the shared list is real…
const _keysAreReal =
  STREAMDOWN_TRANSLATION_KEYS satisfies readonly (keyof StreamdownTranslations)[];
void _keysAreReal;

// …and this proves the converse. If a streamdown upgrade ADDS a translation
// key, the assignment below stops building until the shared list (and the
// `ai.streamdown.*` English defaults) catch up, instead of silently leaking
// that key in English. The tripwire lives in the package that pins the version.
type MissingTranslationKeys = Exclude<keyof StreamdownTranslations, StreamdownTranslationKey>;
const _noMissingTranslationKeys: [MissingTranslationKeys] extends [never] ? true : false = true;
void _noMissingTranslationKeys;

export { useStreamdownTranslations };
