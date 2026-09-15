"use client";

/**
 * Lazy-loaded replacement for `@streamdown/cjk`'s eager `cjk` export.
 *
 * Same rationale and mechanism as `_lazy-math.ts` — `remark-cjk-friendly` +
 * `remark-cjk-friendly-gfm-strikethrough` load only once `needsCjkPlugin(text)`
 * sees a CJK codepoint, instead of shipping in every consumer's entry chunk.
 * See `_lazy-math.ts` for why a remark `Pluggable` cannot be deferred the way
 * `DiagramPlugin` defers Mermaid's render, and for the one-paint literal-text
 * cost this trades for it.
 */
import type { CjkPlugin } from "@streamdown/cjk";
import { useEffect, useState } from "react";

/**
 * Hiragana, Katakana, CJK Unified Ideographs (+ Extension A), Hangul Syllables,
 * CJK punctuation and halfwidth Katakana — the ranges `remark-cjk-friendly`
 * exists to handle (emphasis/strikethrough boundary rules around CJK text).
 */
// The range's first codepoint is the ideographic full-width space, not
// accidental whitespace — a deliberate boundary character, not noise.
// eslint-disable-next-line no-irregular-whitespace -- see comment above
const CJK_RANGE_RE = /[　-〿぀-ヿ㐀-䶿一-鿿가-힣･-ﾟ]/u;

/** Does `text` contain a CJK codepoint? */
export function needsCjkPlugin(text: string): boolean {
  return CJK_RANGE_RE.test(text);
}

/** Module-level singleton: the plugin loads at most once. */
let cachedPlugin: CjkPlugin | undefined;
let loadPromise: Promise<CjkPlugin> | undefined;

function loadCjkPlugin(): Promise<CjkPlugin> {
  loadPromise ??= import("@streamdown/cjk").then((mod) => {
    cachedPlugin = mod.cjk;
    return cachedPlugin;
  });
  return loadPromise;
}

/**
 * Start fetching the CJK plugin ahead of time (e.g. once a conversation's
 * locale is known to be CJK). Optional; rendering CJK text loads it either way.
 */
export const preloadCjk = (): void => {
  void loadCjkPlugin();
};

/**
 * Returns the loaded `CjkPlugin` once `text` needs one, else `undefined`
 * (Streamdown treats an absent `plugins.cjk` slot as "no CJK handling" — plain
 * remark-gfm boundary rules apply until the plugin arrives).
 */
export function useLazyCjkPlugin(text: string): CjkPlugin | undefined {
  const needed = needsCjkPlugin(text);
  const [plugin, setPlugin] = useState<CjkPlugin | undefined>(cachedPlugin);

  useEffect(() => {
    if (!needed || cachedPlugin) return;
    let cancelled = false;
    loadCjkPlugin().then((loaded) => {
      if (!cancelled) setPlugin(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [needed]);

  if (!needed) return undefined;
  return plugin ?? cachedPlugin;
}
