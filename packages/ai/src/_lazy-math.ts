"use client";

/**
 * Lazy-loaded replacement for `@streamdown/math`'s eager `math` export.
 *
 * Why this exists
 * ----------------
 * `@streamdown/math` bundles KaTeX (~600 KB unminified) plus `remark-math` and
 * `rehype-katex`. `useStreamdownPlugins()` (`_streamdown-i18n.ts`) used to
 * import it statically, so every consumer of `MessageResponse`/`MarkdownView`/
 * `ReasoningContent` paid for KaTeX in their entry chunk whether or not a
 * single conversation ever contains `$…$`.
 *
 * How it stays correct
 * ---------------------
 * Unlike Mermaid (`_lazy-mermaid.ts`), a remark/rehype `Pluggable` cannot be
 * wrapped in a lazy accessor: `remark-math`'s micromark extension has to be
 * registered on the unified processor BEFORE it parses, so there is no way to
 * hand Streamdown a present-but-deferred math plugin the way `DiagramPlugin`
 * defers its render. Instead:
 *
 *  1. `needsMathPlugin(text)` cheaply sniffs the RAW markdown source for `$…$`
 *     / `\(…\)` / `\[…\]` delimiters — no parsing, just a regex.
 *  2. `useLazyMathPlugin(text)` returns `undefined` until that sniff is true,
 *     at which point it kicks off `import("@streamdown/math")` and returns the
 *     loaded plugin once it resolves, triggering a re-render.
 *
 * The one user-visible cost: a message whose FIRST rendered chunk already
 * contains math delimiters shows literal `$x^2$` for one paint before the
 * import resolves (typically well under a frame from a warm cache, since the
 * chunk is tiny next to KaTeX's own parse/layout work). Every subsequent
 * message reuses the module-level cache and never re-pays it.
 */
import type { MathPlugin } from "@streamdown/math";
import { useEffect, useState } from "react";

/** Cheap, over-inclusive sniff — a false positive just means an unneeded fetch. */
const MATH_DELIMITER_RE = /\$\$[\s\S]*?\$\$|\$[^\s$][^$\n]*\$|\\\(|\\\)|\\\[|\\\]/;

/** Does `text` look like it contains LaTeX math delimiters? */
export function needsMathPlugin(text: string): boolean {
  return MATH_DELIMITER_RE.test(text);
}

/** Module-level singleton: the plugin (and its KaTeX bytes) load at most once. */
let cachedPlugin: MathPlugin | undefined;
let loadPromise: Promise<MathPlugin> | undefined;

function loadMathPlugin(): Promise<MathPlugin> {
  loadPromise ??= import("@streamdown/math").then((mod) => {
    cachedPlugin = mod.math;
    return cachedPlugin;
  });
  return loadPromise;
}

/**
 * Start fetching the math plugin ahead of time (e.g. once a conversation is
 * known to contain math, or on route entry). Optional; rendering math loads
 * it either way.
 */
export const preloadMath = (): void => {
  void loadMathPlugin();
};

/**
 * Returns the loaded `MathPlugin` once `text` needs one, else `undefined`
 * (Streamdown treats an absent `plugins.math` slot as "no math support" — the
 * delimiters render as literal text until the plugin arrives).
 */
export function useLazyMathPlugin(text: string): MathPlugin | undefined {
  const needed = needsMathPlugin(text);
  const [plugin, setPlugin] = useState<MathPlugin | undefined>(cachedPlugin);

  useEffect(() => {
    if (!needed || cachedPlugin) return;
    let cancelled = false;
    loadMathPlugin().then((loaded) => {
      if (!cancelled) setPlugin(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [needed]);

  if (!needed) return undefined;
  // `cachedPlugin` covers the case where another instance finished loading
  // between this component's mount and this render (state update pending).
  return plugin ?? cachedPlugin;
}
