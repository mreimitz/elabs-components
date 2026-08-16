"use client";

/**
 * Code adapter — source files, highlighted with Shiki and coloured by tokens.
 *
 * Highlighting happens at LOAD, not at render: `load()` returns lines of plain
 * `{ text, color }` tokens, so the renderer draws data like every other adapter
 * and Shiki never reaches the render path. The colours are `var(--code-*)`
 * references (see `code-theme.ts`), which is why a theme switch recolours the
 * document without re-tokenizing it.
 *
 * The plain-text adapter is still the backstop. This one claims extensions it
 * has a grammar for; anything else — a log, a `.env`, no extension at all —
 * falls through to text, and so does every file when Shiki is not installed.
 */

import { MatchHighlight, cn, StatePanel, useLocale } from "@elabs/components-ui";
import type { ResolvedFileSource } from "@elabs/components-ui";
import { Fragment, useMemo, useRef } from "react";
import type { BundledLanguage, ThemedToken } from "shiki";

import { toViewerError } from "../../core/errors";
import { localizeRanges, toMarkRanges } from "../../core/highlight-marks";
import { useScrollActiveHighlightIntoView } from "../../core/use-highlight-scroll";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { languageFor } from "./code-language";
import { codeManifest } from "./code-manifest";
import { codeViewerTheme } from "./code-theme";

/**
 * Characters kept before truncation. Well below the plain-text limit because
 * this text is also TOKENIZED — a grammar pass over multiple megabytes blocks
 * the main thread, and no one reads a 400k-character file in a preview pane.
 */
export const CODE_CHARACTER_LIMIT = 400_000;

/** One highlighted run. `color` is always a `var(--code-*)` reference. */
export interface CodeToken {
  text: string;
  color?: string;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
}

export interface CodeDocument extends AdapterDocument {
  kind: "code";
  /** Shiki language id, or `undefined` when the file rendered unhighlighted. */
  language?: string;
  /** One entry per line; a blank line is an empty array. */
  lines: CodeToken[][];
  text: string;
  /** Total characters in the file, when more than what is shown. */
  totalCharacters?: number;
}

// Shiki encodes font style as bitflags: 1 = italic, 2 = bold, 4 = underline.
const hasFontFlag = (fontStyle: number | undefined, flag: number) =>
  ((fontStyle ?? 0) & flag) === flag;

/**
 * Highlighters, cached per language for the lifetime of the page.
 *
 * Not per-document state, so it deliberately outlives the adapter instance:
 * building one loads a grammar and the WASM engine, and paging through twenty
 * TypeScript files in a file tree should pay for that once.
 */
const highlighters = new Map<string, Promise<{ tokenize(code: string): ThemedToken[][] }>>();

function getHighlighter(language: BundledLanguage) {
  let pending = highlighters.get(language);
  if (!pending) {
    pending = (async () => {
      // Dynamic: the ONLY edge to the optional peer (heavy-deps:check).
      const { createHighlighter } = await import("shiki");
      const highlighter = await createHighlighter({
        themes: [codeViewerTheme],
        langs: [language],
      });
      return {
        tokenize: (code: string) =>
          highlighter.codeToTokens(code, {
            lang: language,
            theme: codeViewerTheme.name as string,
          }).tokens,
      };
    })().catch((error: unknown) => {
      // Not cached: a peer installed later, or a transient chunk-load failure,
      // must be retryable without a page reload.
      highlighters.delete(language);
      throw error;
    });
    highlighters.set(language, pending);
  }
  return pending;
}

/** Split unhighlighted text into the same line/token shape. */
function plainLines(text: string): CodeToken[][] {
  return text.split("\n").map((line) => (line.length > 0 ? [{ text: line }] : []));
}

class CodeAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<CodeDocument> {
    let raw: string;
    try {
      raw = await source.text(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    const truncated = raw.length > CODE_CHARACTER_LIMIT;
    const text = truncated ? raw.slice(0, CODE_CHARACTER_LIMIT) : raw;
    const totalCharacters = truncated ? raw.length : undefined;
    // So a passage the shell cannot find reads as "past the part we previewed"
    // rather than "not in this document".
    const textTruncated = truncated || undefined;
    const language = languageFor(source.name);

    // No grammar for this name — still a perfectly readable file.
    if (!language) {
      return { kind: "code", lines: plainLines(text), text, totalCharacters, textTruncated };
    }

    const highlighter = await getHighlighter(language);
    if (context.signal?.aborted) {
      return {
        kind: "code",
        language,
        lines: plainLines(text),
        text,
        totalCharacters,
        textTruncated,
      };
    }

    const lines = highlighter.tokenize(text).map((line) =>
      line.map((token) => ({
        text: token.content,
        color: token.color,
        italic: hasFontFlag(token.fontStyle, 1) || undefined,
        bold: hasFontFlag(token.fontStyle, 2) || undefined,
        underline: hasFontFlag(token.fontStyle, 4) || undefined,
      })),
    );

    return { kind: "code", language, lines, text, totalCharacters, textTruncated };
  }
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Where each rendered line begins in `document.text`.
 *
 * Derived from the TEXT, not from the token lines: the text is the address space
 * every highlight is expressed in, so counting its newlines is the only mapping
 * that cannot drift from what a caller asked for. The two agree by construction
 * — the tokenizer splits on the same newlines — and `code-adapter.test.tsx`
 * locks that.
 */
function lineStartsIn(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function CodeRenderer({
  document: doc,
  className,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const code = doc as CodeDocument;
  const { t, formatNumber } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const lineStarts = useMemo(() => lineStartsIn(code.text), [code.text]);
  const marks = useMemo(
    () => toMarkRanges(highlights, code.text.length),
    [highlights, code.text.length],
  );
  useScrollActiveHighlightIntoView(container, activeHighlightId);

  if (code.text.length === 0) {
    return <StatePanel kind="empty" title={t("viewer.file.empty")} className={className} />;
  }

  return (
    // No `overflow-auto` here: `FileViewerContent` is the scroll boundary, and
    // nesting a second one clips the last line above the outer pane's padding.
    <div ref={container} className={cn("flex flex-col gap-2", className)}>
      {code.totalCharacters !== undefined && (
        // Not an error — the file is fine, we are showing part of it.
        <p role="status" className="text-meta text-muted-foreground">
          {t("viewer.text.truncated", {
            shown: formatNumber(code.text.length),
            total: formatNumber(code.totalCharacters),
          })}
        </p>
      )}
      <pre className="text-code text-code-foreground font-mono">
        <code className="grid grid-cols-[auto_1fr] gap-x-4">
          {code.lines.map((tokens, lineIndex) => {
            let offset = lineStarts[lineIndex] ?? code.text.length;
            return (
              <Fragment key={lineIndex}>
                {/* Decorative: the numbers are a reading aid, and keeping them out
                  of the accessibility tree also keeps them out of a copy. Not
                  `formatNumber` — a line gutter is an ordinal, so a thousands
                  separator at line 1,000 would be wrong in every locale. */}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground text-right tabular-nums select-none"
                >
                  {lineIndex + 1}
                </span>
                <span className="break-words whitespace-pre-wrap">
                  {tokens.map((token, tokenIndex) => {
                    const start = offset;
                    offset += token.text.length;
                    // Syntax colour is inline `var(--code-*)` (see the module
                    // header), and a mark's plate would fight it — so the mark
                    // layer only wraps the tokens it actually touches, and every
                    // other token keeps rendering exactly as before.
                    const local = localizeRanges(marks, start, offset);
                    const style = {
                      color: token.color,
                      fontStyle: token.italic ? "italic" : undefined,
                      fontWeight: token.bold ? "bold" : undefined,
                      textDecoration: token.underline ? "underline" : undefined,
                    };
                    return local.ranges.length === 0 ? (
                      <span key={tokenIndex} style={style}>
                        {token.text}
                      </span>
                    ) : (
                      <MatchHighlight
                        key={tokenIndex}
                        style={style}
                        text={token.text}
                        ranges={local.ranges}
                        activeIndex={local.activeIndex}
                      />
                    );
                  })}
                </span>
              </Fragment>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

const adapterModule: AdapterModule = {
  manifest: codeManifest,
  create: () => new CodeAdapter(),
  Renderer: CodeRenderer,
};

export default adapterModule;
