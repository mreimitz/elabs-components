"use client";

import { Button, useCopyToClipboard, useLocale } from "@elabs-ai/components-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, HTMLAttributes } from "react";
import { Shimmer } from "./shimmer";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { BundledLanguage, BundledTheme, HighlighterGeneric, ThemedToken } from "shiki";

import { buildCodeBlockTheme, codeBlockThemeId, getThemeScopeKey } from "./_code-block-theme";
import { getThemeScope, useThemeScopeRevision } from "./_theme-scope-store";

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline
// oxlint-disable-next-line eslint(no-bitwise)
const isItalic = (fontStyle: number | undefined) => fontStyle && fontStyle & 1;
// oxlint-disable-next-line eslint(no-bitwise)
const isBold = (fontStyle: number | undefined) => fontStyle && fontStyle & 2;
const isUnderline = (fontStyle: number | undefined) =>
  // oxlint-disable-next-line eslint(no-bitwise)
  fontStyle && fontStyle & 4;

// Transform tokens to include pre-computed keys to avoid noArrayIndexKey lint
interface KeyedToken {
  token: ThemedToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

// Token rendering component. Colors come entirely from the derived brand
// theme's inline styles (`_code-block-theme.ts`, #315) — no `dark:` escape
// hatch needed, since the theme is already resolved for whichever brand
// theme is active (including a monochrome ink palette).
const TokenSpan = ({ token }: { token: ThemedToken }) => (
  <span
    style={
      {
        backgroundColor: token.bgColor,
        color: token.color,
        fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
        fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
        textDecoration: isUnderline(token.fontStyle) ? "underline" : undefined,
        ...token.htmlStyle,
      } as CSSProperties
    }
  >
    {token.content}
  </span>
);

// Line number styles using CSS counters
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-8",
  "before:me-4",
  "before:text-end",
  "before:text-muted-foreground/50",
  "before:font-mono",
  "before:select-none",
);

// Line rendering component
const LineSpan = ({
  keyedLine,
  showLineNumbers,
}: {
  keyedLine: KeyedLine;
  showLineNumbers: boolean;
}) => (
  <span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ token, key }) => <TokenSpan key={key} token={token} />)}
  </span>
);

// Types
export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
  /**
   * Soft-wrap long lines instead of scrolling horizontally. Use in narrow embeds
   * (e.g. a side rail) so content is not silently clipped. Default: false.
   */
  wrap?: boolean;
  /**
   * code is arriving incrementally (loading-states.md isStreaming) — code
   * keeps rendering progressively (build-up), NOT a skeleton, since a
   * streaming code block is not fetch-then-show. Shows a Shimmer generating
   * cue below the content as the in-progress affordance.
   * @default false
   */
  isStreaming?: boolean;
};

interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

interface CodeBlockContextType {
  code: string;
}

// Context
const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

// Highlighter cache (singleton per language)
const highlighterCache = new Map<
  string,
  Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>();

// Token cache — bounded to the `MAX_TOKENS_CACHE_ENTRIES` most recently used
// entries (perf review 1.4a). Unbounded growth showed up while streaming: a
// growing code string re-tokenizes on every token, and every intermediate
// string used to get its own permanent cache entry — O(n²) memory that was
// never released for the lifetime of the tab.
const MAX_TOKENS_CACHE_ENTRIES = 200;
const tokensCache = new Map<string, TokenizedCode>();

/** Reads `key`, marking it most-recently-used (moves it to the end). */
const tokensCacheGet = (key: string): TokenizedCode | undefined => {
  const value = tokensCache.get(key);
  if (value === undefined) return undefined;
  tokensCache.delete(key);
  tokensCache.set(key, value);
  return value;
};

/** Writes `key`, evicting the least-recently-used entries over the cap. */
const tokensCacheSet = (key: string, value: TokenizedCode): void => {
  tokensCache.delete(key);
  tokensCache.set(key, value);
  while (tokensCache.size > MAX_TOKENS_CACHE_ENTRIES) {
    const oldestKey = tokensCache.keys().next().value;
    if (oldestKey === undefined) break;
    tokensCache.delete(oldestKey);
  }
};

// Subscribers for async token updates
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

// FNV-1a 32-bit — cheap, and (unlike the previous length + first/last 100
// chars key) hashes the FULL string, so two different strings of the same
// length sharing a prefix and suffix longer than 100 chars (an edit to the
// MIDDLE of a >200-char block — the common case for a diff or a streamed
// correction) no longer collide onto the same cache entry and show stale,
// wrong-content highlighting (#perf 1.4b).
const hashCode = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    // oxlint-disable-next-line eslint(no-bitwise)
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // oxlint-disable-next-line eslint(no-bitwise)
  return (hash >>> 0).toString(36);
};

// The theme id is part of the cache key (#315) — the SAME code+language must
// re-tokenize (and re-cache) when the active brand theme changes, or a code
// block would keep showing stale colors from the theme active when it was
// first highlighted. The id is derived from `getThemeScopeKey` (the RAW
// `data-theme` attribute, or a sentinel when unset) rather than the validated
// `ThemeName` — see `_code-block-theme.ts`'s module doc comment for why: an
// unset attribute and an explicit `data-theme="light"` both narrow to
// the SAME `ThemeName`, but `:root`'s `--code-*` fallback values are their own
// distinct placeholder palette, not an alias of `light`'s — so keying on
// the validated name would let the pre-mount render's `:root` colors poison
// the cache under the key `ThemeProvider` later writes explicitly, and they'd
// never be replaced.
const getTokensCacheKey = (code: string, language: BundledLanguage, themeId: string) =>
  `${themeId}:${language}:${code.length}:${hashCode(code)}`;

// Shiki (~36KB gzip of bundled language/theme index, #597) is a
// `@lazy-boundary`-style dependency (ADR 0019, same pattern as
// `_lazy-mermaid.ts`'s `loadEngine`): the ONLY reference to it anywhere in
// this module is this dynamic `import()`, fetched at most once per app and
// shared by every language's highlighter promise below. `CodeBlockContent`
// already renders `createRawTokens` synchronously on mount and swaps in the
// tokenized result once `getHighlighter`'s promise resolves, so this never
// introduces a layout shift or a loading state beyond the existing
// raw-then-highlighted flow.
let shikiModulePromise: Promise<Pick<typeof import("shiki"), "createHighlighter">> | undefined;

const loadShiki = (): Promise<Pick<typeof import("shiki"), "createHighlighter">> => {
  shikiModulePromise ??= import("shiki");
  return shikiModulePromise;
};

const getHighlighter = (
  language: BundledLanguage,
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> => {
  const cached = highlighterCache.get(language);
  if (cached) {
    return cached;
  }

  // No themes preloaded here (#315) — the theme is derived from brand tokens
  // per call (`buildCodeBlockTheme`) and passed directly to `codeToTokens`,
  // never a bundled `github-*` literal.
  const highlighterPromise = loadShiki().then(({ createHighlighter }) =>
    createHighlighter({
      langs: [language],
      themes: [],
    }),
  );

  highlighterCache.set(language, highlighterPromise);
  return highlighterPromise;
};

// Create raw tokens for immediate display while highlighting loads
const createRawTokens = (code: string): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: code.split("\n").map((line) =>
    line === ""
      ? []
      : [
          {
            color: "inherit",
            content: line,
          } as ThemedToken,
        ],
  ),
});

// Synchronous highlight with callback for async results. `callback` stays in
// its ORIGINAL third position (pre-#315 public API — a positional break here
// would silently mis-wire any existing 3-arg caller, see #315 follow-up); `el`
// is a new, purely-additive fourth parameter: the element (default `<html>`)
// whose active brand theme's `--code-*` tokens the highlighter derives its
// colors from. Passing a descendant of a region-scoped `<div data-theme="…">`
// resolves THAT region's theme instead of the document root's.
//
// `skipCache` (fifth, purely-additive parameter, default `false`) is set by a
// caller mid-stream (perf review 1.4a): a streaming code block re-tokenizes a
// GROWING string on every token, so every intermediate value is, by
// definition, never seen again — permanently caching it only pays rent
// (bounded now by the LRU cap, but still pure waste) without ever paying off
// with a hit. A cache HIT (the final, settled string matches an
// already-cached entry) is still honored either way.
export const highlightCode = (
  code: string,
  language: BundledLanguage,
  // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-callbacks)
  callback?: (result: TokenizedCode) => void,
  el?: Element | null,
  skipCache = false,
): TokenizedCode | null => {
  const themeId = codeBlockThemeId(getThemeScopeKey(el));
  const tokensCacheKey = getTokensCacheKey(code, language, themeId);

  // Return cached result if available
  const cached = tokensCacheGet(tokensCacheKey);
  if (cached) {
    return cached;
  }

  // Subscribe callback if provided
  if (callback) {
    if (!subscribers.has(tokensCacheKey)) {
      subscribers.set(tokensCacheKey, new Set());
    }
    subscribers.get(tokensCacheKey)?.add(callback);
  }

  // Start highlighting in background - fire-and-forget async pattern
  getHighlighter(language)
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .then((highlighter) => {
      const availableLangs = highlighter.getLoadedLanguages();
      const langToUse = availableLangs.includes(language) ? language : "text";

      // Derived from brand `--code-*` tokens (#315), never a `github-*` literal.
      // Same `el` the theme NAME above came from, so id/type/colors agree.
      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        theme: buildCodeBlockTheme(el),
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };

      // Cache the result — unless the caller told us it is mid-stream, in
      // which case this exact string is very unlikely to recur.
      if (!skipCache) {
        tokensCacheSet(tokensCacheKey, tokenized);
      }

      // Notify all subscribers
      const subs = subscribers.get(tokensCacheKey);
      if (subs) {
        for (const sub of subs) {
          sub(tokenized);
        }
        subscribers.delete(tokensCacheKey);
      }
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then), eslint-plugin-promise(prefer-await-to-callbacks)
    .catch((error) => {
      console.error("Failed to highlight code:", error);
      subscribers.delete(tokensCacheKey);
    });

  return null;
};

const CodeBlockBody = memo(
  ({
    tokenized,
    showLineNumbers,
    wrap,
    className,
  }: {
    tokenized: TokenizedCode;
    showLineNumbers: boolean;
    wrap?: boolean;
    className?: string;
  }) => {
    const preStyle = useMemo(
      () => ({
        backgroundColor: tokenized.bg,
        color: tokenized.fg,
      }),
      [tokenized.bg, tokenized.fg],
    );

    const keyedLines = useMemo(() => addKeysToTokens(tokenized.tokens), [tokenized.tokens]);

    return (
      <pre
        className={cn("m-0 p-4 text-body", wrap && "whitespace-pre-wrap break-words", className)}
        style={preStyle}
      >
        <code
          className={cn(
            "font-mono text-body",
            showLineNumbers && "[counter-increment:line_0] [counter-reset:line]",
          )}
        >
          {keyedLines.map((keyedLine) => (
            <LineSpan key={keyedLine.key} keyedLine={keyedLine} showLineNumbers={showLineNumbers} />
          ))}
        </code>
      </pre>
    );
  },
  (prevProps, nextProps) =>
    prevProps.tokenized === nextProps.tokenized &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.wrap === nextProps.wrap &&
    prevProps.className === nextProps.className,
);

CodeBlockBody.displayName = "CodeBlockBody";

export const CodeBlockContainer = ({
  className,
  language,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { language: string }) => (
  <div
    className={cn(
      "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
      className,
    )}
    data-language={language}
    style={{
      containIntrinsicSize: "auto 200px",
      contentVisibility: "auto",
      ...style,
    }}
    {...props}
  />
);

export const CodeBlockHeader = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-muted-foreground text-meta",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CodeBlockTitle = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export const CodeBlockFilename = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("font-mono", className)} {...props}>
    {children}
  </span>
);

export const CodeBlockActions = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-my-1 -me-1 flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

// Streaming re-highlight throttle (perf review 1.4e / §3.2): re-tokenizing
// on every single streamed token is O(n²) work over the life of a response.
// At most one highlight pass per window, ALWAYS with a trailing call so the
// final, settled string still gets highlighted the moment streaming stops.
const STREAM_HIGHLIGHT_THROTTLE_MS = 200;

export const CodeBlockContent = ({
  code,
  language,
  showLineNumbers = false,
  wrap = false,
  isStreaming = false,
}: {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
  wrap?: boolean;
  isStreaming?: boolean;
}) => {
  // Track the active brand theme (#315), SCOPED to this code block's own
  // subtree (`getThemeScope`) rather than always `<html>` — so a CodeBlock
  // nested inside a region-scoped `<div data-theme="dark">` (a supported
  // ThemeProvider/decorator pattern) picks up THAT region's `--code-*` tokens,
  // not the document root's. `useThemeScopeRevision` (`_theme-scope-store.ts`)
  // shares ONE MutationObserver per scope element across every subscriber
  // watching it, instead of one per `CodeBlock` instance (perf review §3.3).
  const scopeRef = useRef<HTMLDivElement>(null);
  // The ref only attaches after the first commit, so the scope resolved
  // during the initial render (before mount) may have fallen back to
  // `<html>`. Force one more render right after mount — synchronously, before
  // paint, via `useLayoutEffect` — so a scoped code block never flashes the
  // document root's colors first; `useThemeScopeRevision` re-subscribes to
  // the now-correct scope on that render.
  const [, forceMountRerender] = useReducer((tick: number) => tick + 1, 0);
  useLayoutEffect(() => {
    forceMountRerender();
  }, []);

  const scopeEl = getThemeScope(scopeRef.current);
  const themeRevision = useThemeScopeRevision(scopeRef.current);
  // Keyed on the RAW `data-theme` scope, not the validated theme name (#315
  // follow-up) — see `_code-block-theme.ts`'s module doc comment. An unset
  // attribute (the pre-mount render) and an explicit `data-theme="light"`
  // both narrow to the SAME `ThemeName`, so using the validated name here would
  // mean this memo's dependency doesn't CHANGE across that mutation and the
  // stale `:root`-tokenized colors would never be recomputed once
  // `ThemeProvider` mounts and writes the attribute explicitly.
  const themeScopeKey = useMemo(
    () => getThemeScopeKey(scopeEl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeRevision is the trigger; scopeEl's own identity already changes across the post-mount re-render above.
    [themeRevision, scopeEl],
  );

  // Memoized raw tokens for immediate display
  const rawTokens = useMemo(() => createRawTokens(code), [code]);

  // Synchronous cache PEEK — a plain, side-effect-free `Map.get`, never a
  // call into `highlightCode` (the OLD code called it here with no callback,
  // AND again in the effect below with one; on a cache miss both calls
  // independently kicked off `getHighlighter(language).then(...)` and
  // computed `codeToTokens` for the SAME code twice — perf review 1.4d).
  // Highlighting is now triggered from exactly ONE place: the effect.
  const themeId = codeBlockThemeId(themeScopeKey);
  const tokensCacheKey = getTokensCacheKey(code, language, themeId);
  const syncTokens = tokensCache.get(tokensCacheKey) ?? rawTokens;

  // Async highlighting result (populated after shiki loads, or synchronously
  // inside the effect on a cache hit).
  const [asyncTokens, setAsyncTokens] = useState<TokenizedCode | null>(null);
  const asyncKeyRef = useRef({ code, language, themeScopeKey });

  // Invalidate stale async tokens synchronously during render
  if (
    asyncKeyRef.current.code !== code ||
    asyncKeyRef.current.language !== language ||
    asyncKeyRef.current.themeScopeKey !== themeScopeKey
  ) {
    asyncKeyRef.current = { code, language, themeScopeKey };
    setAsyncTokens(null);
  }

  // Last time THIS instance actually ran a highlight pass — the throttle
  // clock while `isStreaming` (perf review 1.4e).
  const lastHighlightAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runHighlight = () => {
      lastHighlightAtRef.current = Date.now();
      // `highlightCode` returns the tokenized result SYNCHRONOUSLY on a cache
      // hit (and never invokes the callback in that case — see its early
      // `if (cached) return cached` branch). That cache hit is the COMMON case
      // right after a theme switch (#315): the highlighter for this language is
      // already loaded, so re-tokenizing for the new theme resolves within a
      // microtask — often before this effect even runs — and without this
      // direct check `asyncTokens` would stay null forever, stranding the
      // code block on its raw/unhighlighted fallback after every theme change.
      const cached = highlightCode(
        code,
        language,
        (result) => {
          if (!cancelled) {
            setAsyncTokens(result);
          }
        },
        scopeEl,
        isStreaming,
      );
      if (cached && !cancelled) {
        setAsyncTokens(cached);
      }
    };

    if (!isStreaming) {
      // Not streaming: always highlight immediately (also the path a
      // just-finished stream's LAST token takes, guaranteeing the final,
      // settled code always gets a full, cacheable highlight even if the
      // throttle skipped some of the tokens before it).
      runHighlight();
    } else {
      const elapsed = Date.now() - lastHighlightAtRef.current;
      if (elapsed >= STREAM_HIGHLIGHT_THROTTLE_MS) {
        runHighlight();
      } else {
        timeoutId = setTimeout(runHighlight, STREAM_HIGHLIGHT_THROTTLE_MS - elapsed);
      }
    }

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [code, language, themeScopeKey, scopeEl, isStreaming]);

  const tokenized = asyncTokens ?? syncTokens;

  return (
    <div
      ref={scopeRef}
      className={cn(
        "relative overflow-auto",
        // Discoverable horizontal-scroll affordance in non-wrap mode, so a narrow
        // embed doesn't silently clip long lines. Hidden when wrapping (no overflow).
        !wrap &&
          "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
      )}
    >
      <CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} wrap={wrap} />
    </div>
  );
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  wrap = false,
  isStreaming = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const contextValue = useMemo(() => ({ code }), [code]);
  const { t } = useLocale();

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <CodeBlockContainer className={className} language={language} {...props}>
        {children}
        <CodeBlockContent
          code={code}
          language={language}
          showLineNumbers={showLineNumbers}
          wrap={wrap}
          isStreaming={isStreaming}
        />
        {isStreaming ? (
          <div
            className="flex items-center gap-2 border-t bg-muted/80 px-3 py-1.5 text-caption text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Shimmer>{t("ai.codeBlock.generating")}</Shimmer>
          </div>
        ) : null}
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const { t } = useLocale();
  const { code } = useContext(CodeBlockContext);
  // Shared implementation (`@elabs-ai/components-ui`) instead of a private
  // copy of the same copy-to-clipboard state machine — this one used to
  // duplicate `SnippetCopyButton`'s (issue-workflow.md dedupe finding).
  const { copied: isCopied, copy } = useCopyToClipboard(
    timeout === undefined ? undefined : { resetAfterMs: timeout },
  );

  const copyToClipboard = useCallback(async () => {
    const ok = await copy(code);
    if (ok) {
      onCopy?.();
    } else {
      onError?.(new Error("Clipboard API not available"));
    }
  }, [copy, code, onCopy, onError]);

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      aria-label={t("copy")}
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? (
        <span
          key={isCopied ? "check" : "copy"}
          className="flex animate-in fade-in-0 zoom-in-95 duration-fast ease-entrance"
        >
          <Icon size={14} />
        </span>
      )}
    </Button>
  );
};

export type CodeBlockLanguageSelectorProps = ComponentProps<typeof Select>;

export const CodeBlockLanguageSelector = (props: CodeBlockLanguageSelectorProps) => (
  <Select {...props} />
);

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<typeof SelectTrigger>;

export const CodeBlockLanguageSelectorTrigger = ({
  className,
  ...props
}: CodeBlockLanguageSelectorTriggerProps) => (
  <SelectTrigger
    className={cn("h-7 border-none bg-transparent px-2 text-meta shadow-none", className)}
    size="sm"
    {...props}
  />
);

export type CodeBlockLanguageSelectorValueProps = ComponentProps<typeof SelectValue>;

export const CodeBlockLanguageSelectorValue = (props: CodeBlockLanguageSelectorValueProps) => (
  <SelectValue {...props} />
);

export type CodeBlockLanguageSelectorContentProps = ComponentProps<typeof SelectContent>;

export const CodeBlockLanguageSelectorContent = ({
  align = "end",
  ...props
}: CodeBlockLanguageSelectorContentProps) => <SelectContent align={align} {...props} />;

export type CodeBlockLanguageSelectorItemProps = ComponentProps<typeof SelectItem>;

export const CodeBlockLanguageSelectorItem = (props: CodeBlockLanguageSelectorItemProps) => (
  <SelectItem {...props} />
);
