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
import { createCodePlugin } from "@streamdown/code";
import { useMemo } from "react";
import type { StreamdownTranslations } from "streamdown";
import { buildCodeBlockTheme } from "./_code-block-theme";
import { useLazyCjkPlugin } from "./_lazy-cjk";
import { useLazyMathPlugin } from "./_lazy-math";
import { lazyMermaid } from "./_lazy-mermaid";
import { MermaidErrorPanel } from "./_mermaid-error-panel";
import { useThemeScopeRevision } from "./_theme-scope-store";

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
 * Re-derives on every `data-theme` mutation and returns a NEW plugin object
 * each time, because Streamdown only re-reads `plugins.code.getThemes()` when
 * the `plugins.code` object's REFERENCE changes (see streamdown's internal
 * `shikiTheme` memo) — a mutated-in-place plugin would never be picked up.
 *
 * The mutation watch itself comes from the SHARED, ref-counted store in
 * `./_theme-scope-store` (perf review §3.3) rather than a `MutationObserver`
 * instantiated per hook call — every simultaneously-mounted
 * `MessageResponse`/`MarkdownView` (and every `CodeBlock`) in a message-dense
 * conversation now shares exactly one observer per distinct scope element,
 * instead of one each. This hook has no element of its own to scope to (it
 * runs before Streamdown renders anything), so it resolves to the document's
 * theme scope (`getThemeScope(null)` → closest `[data-theme]` on `<html>`,
 * same as its prior always-`<html>` behaviour) — a genuinely region-scoped
 * derivation would need a ref to the rendered surface, which no current call
 * site (`message.tsx`, `markdown-view.tsx`, `reasoning.tsx`) has available.
 */
function useReactiveCodePlugin() {
  const revision = useThemeScopeRevision(null);

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
 * load on first diagram render, not in the entry chunk of every consumer.
 * `math`/`cjk` are ALSO lazy (`./_lazy-math`, `./_lazy-cjk`, #perf-5): KaTeX
 * (~600 KB) and the CJK remark plugins load only once `text` — the raw
 * markdown source about to render — actually needs them, sniffed by a cheap
 * regex rather than shipped unconditionally in every consumer's entry chunk.
 * Both resolve to `undefined` (the slot is simply absent) until their content
 * cue fires and the dynamic import resolves; see the two modules' docs for the
 * one-paint tradeoff this makes and why it can't be avoided the way Mermaid's
 * render-time laziness is.
 *
 * `code` is the reactive, brand-token-derived plugin above (#315) — never the
 * `@streamdown/code` package's static `github-light`/`github-dark` default.
 * Memoized so Streamdown sees a referentially stable `plugins` prop except when
 * the active theme (or a lazy slot) actually changes.
 *
 * @param text The raw markdown source about to render — used only to decide
 *   whether the math/CJK plugins are needed. Pass `""` to never load them
 *   speculatively.
 */
export function useStreamdownPlugins(text = "") {
  const code = useReactiveCodePlugin();
  const math = useLazyMathPlugin(text);
  const cjk = useLazyCjkPlugin(text);
  return useMemo(() => ({ cjk, code, math, mermaid: lazyMermaid }), [cjk, code, math]);
}

/**
 * A React `key` for the `<Streamdown>` element that renders with
 * {@link useStreamdownPlugins}'s result — pass it as `key={getStreamdownPluginsKey(plugins)}`
 * on the `<Streamdown>` JSX, never inside the `plugins` object itself.
 *
 * Why this exists (#perf-5 follow-up): Streamdown v2.5.0's `rehypePlugins`/
 * `remarkPlugins` are `useMemo`'d with `plugins.math`/`plugins.cjk` in their
 * dependency arrays, and its `Block`/`Streamdown` components' custom `memo`
 * comparators do check plugin reference equality — on paper, a fresh
 * `plugins.math` object arriving after the lazy `import()` resolves should be
 * enough to make Streamdown rebuild its processing pipeline with the math
 * plugin included. Empirically (verified directly against the real
 * `streamdown` package, not a mock) it does not: once a block has rendered
 * once without `plugins.math`/`plugins.cjk`, Streamdown's internal processor
 * cache keeps serving the plugin-less result even after the reference
 * changes, and the literal `$$…$$`/CJK-remark-less markdown source stays
 * un-rendered indefinitely.
 *
 * Forcing React to unmount and remount the `<Streamdown>` element — by
 * changing its `key` — sidesteps that internal cache entirely (a fresh
 * instance has no stale cache to serve) and reliably picks up the lazily
 * loaded plugin. The cost is a one-time full remount of that Streamdown
 * instance the first time its lazy math/CJK slot resolves — at most once per
 * mounted instance, since after that the key is stable again. Filed for
 * upstream investigation; if a future `streamdown` release fixes the
 * underlying cache, this key can be dropped without changing any call site's
 * behavior (an unchanging key is a no-op).
 */
export function getStreamdownPluginsKey(plugins: {
  readonly cjk?: unknown;
  readonly math?: unknown;
}): string {
  return `${plugins.math ? "math" : "no-math"}:${plugins.cjk ? "cjk" : "no-cjk"}`;
}

/**
 * The top-level Streamdown `mermaid` prop (distinct from `plugins.mermaid`,
 * the LAZY `DiagramPlugin` `useStreamdownPlugins()` wires above) — this is
 * where a FAILED render is caught (issue #33). Streamdown hands its
 * `errorComponent` a plain STRING describing what went wrong;
 * `MermaidErrorPanel` decides whether that string names a missing optional
 * peer (`mermaid` not installed — a capability gap, `StatePanel kind="empty"`)
 * or a genuine diagram render failure (`StatePanel kind="error"`, with retry).
 *
 * A stable module-level object, not a fresh one per render: Streamdown only
 * re-reads `mermaid.errorComponent` when this reference changes, and
 * `MermaidErrorPanel` never varies at runtime. Exported as a hook to match
 * `useStreamdownPlugins()`'s call-site shape.
 */
const MERMAID_OPTIONS = { errorComponent: MermaidErrorPanel };
export function useStreamdownMermaidOptions() {
  return MERMAID_OPTIONS;
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
