"use client";

/**
 * CodeFence — the highlighted non-mermaid code fence inside MarkdownPreview.
 *
 * Highlighting rides on the SAME engine the rest of the workspace already
 * ships (`@streamdown/code`, Streamdown's shiki plugin — cached highlighters,
 * sync-after-first-tokenize), but the theme is a shiki **CSS-variables theme**:
 * every token color resolves to a `var(--md-code-*)` reference that this
 * component maps onto the semantic tokens below. One theme, correct in every
 * `data-theme` (light, dark, …) — no per-theme shiki theme, no raw
 * colors, and a runtime theme switch recolors already-tokenized code for free.
 *
 * Until shiki finishes loading (or for a fence with no language tag) the raw
 * fence text renders as before — highlighting is a progressive enhancement.
 */
import { cn } from "@elabs/components-ui/lib/cn";
import { code as codeHighlighter } from "@streamdown/code";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { BundledLanguage, ThemedToken, TokensResult } from "shiki";
import { createCssVariablesTheme } from "shiki";

import { CopyButton } from "../copy-button";

/** Extract the fence language from react-markdown's `language-*` className. */
export function fenceLanguage(className?: string): string | undefined {
  return /\blanguage-([\w+#.-]+)\b/.exec(className ?? "")?.[1];
}

/**
 * One shiki theme for BOTH slots (the plugin API is [light, dark]): colors are
 * pure CSS-variable references, so the active `data-theme` decides the actual
 * values — both slots resolve identically by construction.
 */
const cssVariablesTheme = createCssVariablesTheme({
  name: "brand-tokens",
  variablePrefix: "--md-code-",
  fontStyle: true,
});
const SHIKI_THEMES: [typeof cssVariablesTheme, typeof cssVariablesTheme] = [
  cssVariablesTheme,
  cssVariablesTheme,
];

/**
 * The `--md-code-*` seams mapped onto semantic tokens (scoped to the fence, so
 * nothing leaks into `themes.css`). Chart tokens carry the categorical hues —
 * they are the only themed accent ramp guaranteed to exist in every theme.
 */
const SHIKI_TOKEN_VARS = cn(
  "[--md-code-foreground:var(--foreground)]",
  "[--md-code-background:transparent]",
  "[--md-code-token-comment:var(--muted-foreground)]",
  "[--md-code-token-constant:var(--chart-1)]",
  "[--md-code-token-function:var(--chart-3)]",
  "[--md-code-token-keyword:var(--chart-4)]",
  "[--md-code-token-link:var(--primary)]",
  "[--md-code-token-parameter:var(--chart-5)]",
  "[--md-code-token-punctuation:var(--muted-foreground)]",
  "[--md-code-token-string-expression:var(--chart-2)]",
  "[--md-code-token-string:var(--chart-2)]",
);

// Shiki encodes font style as bitflags: 1 = italic, 2 = bold, 4 = underline.
const hasFontFlag = (fontStyle: number | undefined, flag: number) =>
  ((fontStyle ?? 0) & flag) === flag;

function tokenStyle(token: ThemedToken): CSSProperties {
  return {
    // htmlStyle.color carries the theme var; token.color is the fallback path.
    color: (token.htmlStyle as Record<string, string> | undefined)?.color ?? token.color,
    fontStyle: hasFontFlag(token.fontStyle, 1) ? "italic" : undefined,
    fontWeight: hasFontFlag(token.fontStyle, 2) ? "bold" : undefined,
    textDecoration: hasFontFlag(token.fontStyle, 4) ? "underline" : undefined,
  };
}

/**
 * Tokenize via the shared plugin. Returns `null` until the highlighter is
 * ready (first render of a language) — cached fences resolve synchronously.
 */
function useHighlightedTokens(codeText: string, language: string | undefined) {
  const [result, setResult] = useState<TokensResult | null>(null);
  const keyRef = useRef({ codeText, language });

  // Invalidate stale tokens synchronously during render (no flash of the
  // previous fence's tokens when the source changes).
  if (keyRef.current.codeText !== codeText || keyRef.current.language !== language) {
    keyRef.current = { codeText, language };
    setResult(null);
  }

  useEffect(() => {
    if (!language) return undefined; // no language tag — keep the plain text
    let cancelled = false;
    const sync = codeHighlighter.highlight(
      // Unknown languages fall back to "text" inside the plugin.
      { code: codeText, language: language as BundledLanguage, themes: SHIKI_THEMES },
      (r) => {
        if (!cancelled) setResult(r);
      },
    );
    if (sync && !cancelled) setResult(sync);
    return () => {
      cancelled = true;
    };
  }, [codeText, language]);

  return result;
}

export interface CodeFenceProps extends HTMLAttributes<HTMLElement> {
  /** Raw fence text (trailing newline already stripped). */
  codeText: string;
  /** The fence's language tag (` ```ts `), if any. */
  language?: string;
  /** This fence contains the active in-document search hit. */
  searchActive?: boolean;
  /** Fallback content (the un-highlighted fence) while shiki loads. */
  children?: ReactNode;
}

export function CodeFence({
  codeText,
  language,
  searchActive,
  className,
  children,
  ...props
}: CodeFenceProps) {
  const tokens = useHighlightedTokens(codeText, language)?.tokens ?? null;

  return (
    <div
      data-code-fence={language ?? ""}
      className={cn("group/code-fence relative my-3", className)}
      {...props}
    >
      <pre
        data-search-active={searchActive ? "" : undefined}
        className={cn(
          "!my-0 overflow-x-auto rounded-md p-3 font-mono text-code",
          SHIKI_TOKEN_VARS,
          searchActive ? "bg-primary/10" : "bg-surface-muted",
        )}
      >
        {tokens ? (
          <code>
            {tokens.map((line, lineIdx) => (
              // Lines are positionally stable for a given source string (the
              // whole list is rebuilt when `codeText` changes).
              <span key={`line-${lineIdx}`} className="block">
                {line.length === 0
                  ? "\n"
                  : line.map((token, tokenIdx) => (
                      <span key={`token-${lineIdx}-${tokenIdx}`} style={tokenStyle(token)}>
                        {token.content}
                      </span>
                    ))}
              </span>
            ))}
          </code>
        ) : (
          children
        )}
      </pre>

      <div className="absolute end-2 top-2 flex items-center gap-1">
        <CopyButton
          value={codeText}
          label={false}
          size="icon-sm"
          className="opacity-0 transition-opacity duration-fast ease-standard focus-visible:opacity-100 group-hover/code-fence:opacity-100 motion-reduce:transition-none"
        />
        {language ? (
          <span
            aria-hidden="true"
            className="pointer-events-none select-none rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-meta text-muted-foreground"
          >
            {language}
          </span>
        ) : null}
      </div>
    </div>
  );
}
