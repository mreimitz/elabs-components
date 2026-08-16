/**
 * Engine-agnostic completion-provider contract (#283) — the `completions` prop
 * on `MarkdownWorkspace` (and, via it, the WYSIWYG `MarkdownEditor`).
 *
 * ISOLATION INVARIANT (mirrors `editor-content-access.ts`): this file imports
 * NOTHING engine-specific — no `monaco-editor`, no `@milkdown`. It is the
 * dependency-light leaf both engine adapters (`editor-completions-monaco.ts` for
 * Monaco, `markdown-editor/completions/` for Milkdown/ProseMirror) build on, so a
 * consumer can import the TYPES with zero engine imports (#283 acceptance: "zero
 * `monaco-editor` imports in app code").
 *
 * D5 / the calc `complete` hook precedent: the library only REGISTERS the
 * provider and RENDERS its suggestions — candidate list, filtering/ranking, and
 * insert text are entirely consumer-owned. Nothing here fetches anything; a
 * throwing/rejecting `provide()` degrades to "no suggestions" (never blanks or
 * throws), the same degrade-safely contract as `resolveResults`/`CalcBlock`.
 */

/** One completion candidate a provider offers at the caret. */
export interface EditorCompletionItem {
  /** Text shown in the suggestion list. */
  label: string;
  /** Text inserted when the item is chosen. */
  insertText: string;
  /** Secondary detail shown muted beside the label. */
  detail?: string;
  /**
   * Start column (1-based, Monaco convention) of the already-typed token to
   * replace. Defaults to the start of the "trigger query" — the run of text
   * typed since the provider's trigger character (see {@link triggerQueryStart}).
   */
  replaceFrom?: number;
}

/** What a provider knows at the caret when it is asked for completions. */
export interface EditorCompletionContext {
  /** The full document text. */
  source: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column. */
  column: number;
  /** The full text of the current line. */
  lineText: string;
}

/**
 * A declarative completion source. Registered ONCE per `MarkdownWorkspace` (or
 * `MarkdownEditor`) tree via the `completions` prop — the library owns the
 * engine registration lifecycle (Monaco's `registerCompletionItemProvider` is
 * global-per-language, refcounted here; see `editor-completions-monaco.ts`).
 */
export interface EditorCompletionProvider {
  /** Stable id — surfaced for consumer bookkeeping (not currently rendered). */
  id: string;
  /** Characters that (re)open the suggestion list, e.g. `["["]`. */
  triggerCharacters?: string[];
  /** Return the candidates for the caret described by `ctx`. May be async. */
  provide(ctx: EditorCompletionContext): EditorCompletionItem[] | Promise<EditorCompletionItem[]>;
}

/**
 * Find the 1-based column right after the LAST occurrence, before `column`, of
 * any of `triggerCharacters` in `lineText` — the start of the "trigger query"
 * (the text typed since the trigger character). `null` when no trigger
 * character precedes the caret on this line (falls back to inserting at the
 * bare caret — see {@link resolveReplaceRange}).
 *
 * Deliberately the LAST occurrence, not the first: `[[note` (triggerCharacters
 * `["["]`) resolves the query start to right after the SECOND `[`, so the
 * inserted text replaces only `note`, preserving the `[[` the user typed.
 */
export function triggerQueryStart(
  lineText: string,
  column: number,
  triggerCharacters: string[] | undefined,
): number | null {
  if (!triggerCharacters || triggerCharacters.length === 0) return null;
  const before = lineText.slice(0, Math.max(0, column - 1));
  let bestIndex = -1;
  for (const ch of triggerCharacters) {
    if (!ch) continue;
    const idx = before.lastIndexOf(ch);
    if (idx > bestIndex) bestIndex = idx;
  }
  if (bestIndex === -1) return null;
  return bestIndex + 2; // 0-based char index → 1-based column, then step past it
}

/** A 1-based, Monaco-`IRange`-shaped span (structural — no monaco import). */
export interface CompletionReplaceRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Resolve the range an item's `insertText` replaces: `item.replaceFrom` when
 * given, else the trigger-query start (see {@link triggerQueryStart}), else the
 * bare caret (a pure insert, nothing replaced). Always ends at the caret, on
 * the caret's line — a completion never spans multiple lines.
 */
export function resolveReplaceRange(
  item: EditorCompletionItem,
  position: { lineNumber: number; column: number },
  lineText: string,
  triggerCharacters: string[] | undefined,
): CompletionReplaceRange {
  const start =
    item.replaceFrom ??
    triggerQueryStart(lineText, position.column, triggerCharacters) ??
    position.column;
  return {
    startLineNumber: position.lineNumber,
    // Clamp into [1, column] — a bad/stale `replaceFrom` degrades to "insert at
    // caret" rather than producing a backwards/out-of-range edit.
    startColumn: Math.min(Math.max(1, start), position.column),
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };
}

/** One resolved completion item, paired with the provider that produced it. */
export interface CompletionMatch {
  provider: EditorCompletionProvider;
  item: EditorCompletionItem;
}

/**
 * Call every provider's `provide(ctx)`, collect the results, and pair each item
 * back with its provider (so a caller can resolve a per-provider replace range
 * via that provider's `triggerCharacters`). Never throws: a provider whose
 * `provide()` throws or whose returned promise rejects contributes zero items
 * (mirrors `resolveResults`'s calc-hook degrade-safely contract) — one bad
 * provider never blanks another's suggestions.
 */
export async function collectCompletions(
  providers: EditorCompletionProvider[],
  ctx: EditorCompletionContext,
): Promise<CompletionMatch[]> {
  const perProvider = await Promise.all(
    providers.map(async (provider): Promise<CompletionMatch[]> => {
      try {
        const items = (await provider.provide(ctx)) ?? [];
        return items.map((item) => ({ provider, item }));
      } catch {
        return [];
      }
    }),
  );
  return perProvider.flat();
}
