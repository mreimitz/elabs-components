"use client";

/**
 * The WYSIWYG (Milkdown/ProseMirror) mirror of the completion-provider API
 * (#283) — a self-owned raw `$prose` plugin (the `brand-slash-plugin.ts`
 * precedent), Monaco-free.
 *
 * ## What this covers, and what it doesn't (read before reaching for this file)
 *
 * The Monaco / source-pane path (`../../lib/editor-completions-monaco.ts`) gets
 * REAL document line/column coordinates and Monaco's own themed suggest widget
 * for free. Milkdown's ProseMirror document is a NODE TREE, not line-oriented
 * text, so there is no exact equivalent — this is a deliberately MINIMAL,
 * best-effort mirror (per #283: "if full WYSIWYG parity is too large to land
 * safely, ship... a minimal WYSIWYG trigger→insert"):
 *
 *   - `EditorCompletionContext.source` / `.lineText` are the CURRENT TEXTBLOCK's
 *     plain text only (not the whole document, and not markdown-serialized) —
 *     good enough for a provider whose logic looks at the text around the caret
 *     (the `[[wikilink]]` case this issue targets), but NOT a byte-exact mirror
 *     of the Monaco context.
 *   - `.line` is always `1` (there is no cross-block "line number" concept).
 *   - The popup is a plain, unstyled-beyond-tokens listbox (no groups/icons —
 *     `EditorCompletionItem` doesn't carry them), NOT Monaco's native widget.
 *   - Keyboard support covers ↑/↓/Enter/Tab/Esc (feature parity with the Monaco
 *     path's expectations) but not mouse-hover-to-preview or the scroll-into-view
 *     polish `MonacoSlashMenu`/`slash-widget.tsx` add.
 *
 * Candidates/filtering/insertText stay 100% consumer-owned either way — this
 * file only detects the trigger, asks the provider, and renders/inserts.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, type Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import type { ReactWidgetViewComponent, useWidgetViewFactory } from "@prosemirror-adapter/react";

import {
  collectCompletions,
  resolveReplaceRange,
  type EditorCompletionContext,
  type EditorCompletionItem,
  type EditorCompletionProvider,
} from "../../lib/editor-completions";

/** The factory `useWidgetViewFactory()` returns (borrowed, see `brand-slash-plugin.ts`). */
export type CompletionWidgetFactory = ReturnType<typeof useWidgetViewFactory>;

/** Plugin state. `active === false` means no popup is showing. */
export interface CompletionPluginState {
  active: boolean;
  /** Document position of the trigger character that opened/re-opened tracking. */
  from: number;
  /** The trigger character itself (matched against each provider's `triggerCharacters`). */
  triggerChar: string;
  /** Text typed since the trigger (closes on whitespace / caret leaving the block). */
  query: string;
  /** The latest resolved candidates (empty while a fetch is in flight). */
  items: EditorCompletionItem[];
  /** Index into `items` of the highlighted candidate. */
  index: number;
  /** Bumped on every trigger/query change; guards a stale async `provide()` reply. */
  requestId: number;
}

export const CLOSED: CompletionPluginState = {
  active: false,
  from: 0,
  triggerChar: "",
  query: "",
  items: [],
  index: 0,
  requestId: 0,
};

export const completionsPluginKey = new PluginKey<CompletionPluginState>("brand-completions");

type CompletionMeta =
  | "close"
  | { type: "items"; items: EditorCompletionItem[]; requestId: number }
  | { type: "nav"; index: number };

/**
 * Recompute state from a transaction. Exported for unit tests (the
 * `brand-slash-plugin.ts` / `nextState` precedent) — a pure function over
 * `(prev, transaction, triggerCharacters)`, no rendering needed to exercise it.
 *
 * A freshly typed trigger character ALWAYS (re)opens tracking at its position —
 * even while already active — so `[[note` tracks the LAST `[` (matching the
 * Monaco path's `triggerQueryStart`, which also resolves to the last
 * occurrence): the first `[` opens, the second `[` re-anchors with an empty
 * query, and `note` extends it from there.
 */
export function nextCompletionState(
  prev: CompletionPluginState,
  tr: Transaction,
  triggerCharacters: string[],
): CompletionPluginState {
  const meta = tr.getMeta(completionsPluginKey) as CompletionMeta | undefined;
  if (meta === "close") return CLOSED;
  if (meta && typeof meta === "object") {
    if (meta.type === "items") {
      return prev.active && meta.requestId === prev.requestId
        ? { ...prev, items: meta.items }
        : prev;
    }
    if (meta.type === "nav") {
      return prev.active ? { ...prev, index: meta.index } : prev;
    }
  }

  const sel = tr.selection;
  if (!sel.empty) return prev.active ? CLOSED : prev;
  const pos = sel.from;

  // A pure single-character INSERT nets the doc +1 char with a single step —
  // this excludes a backspace/delete (net -1) from ever being misread as
  // "just typed a trigger character" just because deleting happened to expose
  // one immediately before the new caret (e.g. backspacing "n" out of "[[n"
  // lands the caret right after the trigger "["; textBetween alone can't tell
  // an insert from a delete apart, so it needs this net-growth guard too).
  const isPureSingleCharInsert =
    tr.docChanged && tr.steps.length === 1 && tr.doc.content.size === tr.before.content.size + 1;

  if (isPureSingleCharInsert) {
    const justTyped = tr.doc.textBetween(Math.max(0, pos - 1), pos);
    if (triggerCharacters.includes(justTyped)) {
      return {
        active: true,
        from: pos - 1,
        triggerChar: justTyped,
        query: "",
        items: [],
        index: 0,
        requestId: prev.requestId + 1,
      };
    }
  }

  if (!prev.active) return prev;
  if (pos <= prev.from) return CLOSED;

  const start = tr.doc.resolve(prev.from);
  const $pos = tr.doc.resolve(pos);
  if (start.parent !== $pos.parent) return CLOSED;

  const query = $pos.parent.textBetween(start.parentOffset + 1, $pos.parentOffset);
  if (/\s/.test(query)) return CLOSED;
  if (query === prev.query) return prev;
  return { ...prev, query, index: 0, requestId: prev.requestId + 1 };
}

/** Build the (best-effort — see file doc) context handed to `provider.provide()`. */
export function buildCompletionContext(
  doc: ProseNode,
  state: CompletionPluginState,
): EditorCompletionContext {
  const resolved = doc.resolve(state.from);
  const blockStart = resolved.pos - resolved.parentOffset;
  const lineText = resolved.parent.textContent;
  const caretPos = state.from + 1 + state.query.length;
  const column = caretPos - blockStart + 1;
  return { source: lineText, line: 1, column, lineText };
}

/**
 * Resolve the `[from, to)` doc-position range an item's `insertText` replaces,
 * reusing the SAME pure range math the Monaco path uses (`resolveReplaceRange`)
 * against this textblock's plain text treated as "line 1".
 */
export function completionReplaceRange(
  doc: ProseNode,
  state: CompletionPluginState,
  item: EditorCompletionItem,
): { from: number; to: number } {
  const resolved = doc.resolve(state.from);
  const blockStart = resolved.pos - resolved.parentOffset;
  const lineText = resolved.parent.textContent;
  const caretPos = state.from + 1 + state.query.length;
  const column = caretPos - blockStart + 1;
  const range = resolveReplaceRange(item, { lineNumber: 1, column }, lineText, [state.triggerChar]);
  return {
    from: blockStart + (range.startColumn - 1),
    to: blockStart + (range.endColumn - 1),
  };
}

/** Insert `item` (replacing the resolved range), close the popup, refocus. */
export function insertCompletionItem(
  view: EditorView,
  state: CompletionPluginState,
  item: EditorCompletionItem,
): void {
  const { from, to } = completionReplaceRange(view.state.doc, state, item);
  view.dispatch(
    view.state.tr.insertText(item.insertText, from, to).setMeta(completionsPluginKey, "close"),
  );
  view.focus();
}

/** Options for {@link completionsProsePlugin}. */
export interface CompletionsProsePluginOptions {
  /** The widget factory from `useWidgetViewFactory()` (must run under the adapter provider). */
  widgetFactory: CompletionWidgetFactory;
  /** The React component rendered as the widget (built by `createCompletionWidget`). */
  widgetComponent: ReactWidgetViewComponent;
  /** Read live on every transaction / fetch — a rebuilt array is picked up without a rebuild. */
  getProviders: () => EditorCompletionProvider[] | undefined;
}

/** Build the completions `$prose` plugin. Returns a Milkdown plugin to `.use()`. */
export function completionsProsePlugin(options: CompletionsProsePluginOptions): MilkdownPlugin {
  const { widgetFactory, widgetComponent, getProviders } = options;

  return $prose(() => {
    return new Plugin<CompletionPluginState>({
      key: completionsPluginKey,
      state: {
        init: () => CLOSED,
        apply: (tr, value) => {
          const providers = getProviders() ?? [];
          const triggerCharacters = Array.from(
            new Set(providers.flatMap((p) => p.triggerCharacters ?? [])),
          );
          return nextCompletionState(value, tr, triggerCharacters);
        },
      },
      props: {
        decorations: (state) => {
          const s = completionsPluginKey.getState(state);
          if (!s?.active) return DecorationSet.empty;
          const factory = widgetFactory({ component: widgetComponent, as: "span" });
          const anchor = s.from + 1 + s.query.length; // right at the caret
          const decoration = factory(anchor, {
            side: 1,
            ignoreSelection: true,
            key: `brand-completions:${String(s.from)}:${s.query}:${String(s.items.length)}:${String(s.index)}`,
          });
          return DecorationSet.create(state.doc, [decoration]);
        },
        handleKeyDown: (view, event) => {
          const s = completionsPluginKey.getState(view.state);
          if (!s?.active) return false;

          if (event.key === "Escape") {
            view.dispatch(view.state.tr.setMeta(completionsPluginKey, "close"));
            event.preventDefault();
            return true;
          }
          if (s.items.length === 0) return false;

          if (event.key === "ArrowDown") {
            const index = (s.index + 1) % s.items.length;
            view.dispatch(view.state.tr.setMeta(completionsPluginKey, { type: "nav", index }));
            event.preventDefault();
            return true;
          }
          if (event.key === "ArrowUp") {
            const index = (s.index - 1 + s.items.length) % s.items.length;
            view.dispatch(view.state.tr.setMeta(completionsPluginKey, { type: "nav", index }));
            event.preventDefault();
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const item = s.items[Math.min(s.index, s.items.length - 1)];
            if (item) {
              insertCompletionItem(view, s, item);
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
      },
      view: () => ({
        update: (view, prevEditorState) => {
          const state = completionsPluginKey.getState(view.state);
          const prev = completionsPluginKey.getState(prevEditorState);
          if (!state?.active) return;
          if (prev?.active && prev.requestId === state.requestId) return;

          const providers = (getProviders() ?? []).filter(
            (p) => !p.triggerCharacters || p.triggerCharacters.includes(state.triggerChar),
          );
          if (providers.length === 0) return;

          const ctx = buildCompletionContext(view.state.doc, state);
          const requestId = state.requestId;
          collectCompletions(providers, ctx)
            .then((matches) => {
              if (view.isDestroyed) return;
              const current = completionsPluginKey.getState(view.state);
              if (!current?.active || current.requestId !== requestId) return; // stale — superseded
              view.dispatch(
                view.state.tr.setMeta(completionsPluginKey, {
                  type: "items",
                  items: matches.map((m) => m.item),
                  requestId,
                }),
              );
            })
            .catch(() => {
              // collectCompletions already degrades a throwing/rejecting provider to
              // "no items" internally; this catch only guards an unexpected failure
              // in the .then() itself (e.g. a destroyed view) — never surface it.
            });
        },
      }),
    });
  }) as unknown as MilkdownPlugin;
}
