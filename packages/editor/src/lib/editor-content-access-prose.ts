/**
 * ProseMirror / Milkdown adapter for the engine-agnostic EditorContentAccess.
 *
 * ISOLATION: this file is MARKDOWN-ONLY — it imports `@milkdown/kit/*` at runtime.
 * It is exported ONLY from `packages/editor/src/markdown/index.ts` (`./markdown`
 * subpath) and NEVER from `src/index.ts` (`.` barrel), so `@milkdown` never leaks
 * into the Monaco-only graph (#271-inverse). The TYPES from `editor-content-access`
 * are type-erased imports — no runtime edge back to the monaco file.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

import type { EditorContentAccess, EditorSelection } from "./editor-content-access";

export interface ProseMirrorContentAccessOptions {
  /** "markdown" (default) round-trips formatting; "plainText" uses raw text only. */
  fidelity?: "markdown" | "plainText";
}

/**
 * Dependency-injected shape for the Milkdown content-access adapter.
 *
 * The handle owns the serialize/parse closures (built via `getInstance().action(ctx
 * => ...)`) and passes them here. This keeps the adapter free of `Ctx` token
 * plumbing and matches the `readBodyMarkdown`/`writeBodyMarkdown` technique in
 * `directive-views.tsx` exactly.
 */
export interface ProseMirrorContentAccessDeps {
  /** Return the live `EditorView`, or null while the engine is booting. */
  getView: () => EditorView | null;
  /** Return the full document serialized to markdown. */
  getText: () => string;
  /**
   * Serialize the CURRENT selection's slice to markdown (or "" for a collapsed
   * selection). Built by the handle from `serializerCtx`.
   */
  serializeSlice: (view: EditorView) => string;
  /**
   * Parse `md` as a markdown fragment and replace the current selection with the
   * parsed content. On parse failure degrades to a plain-text insert. Built by
   * the handle from `parserCtx`.
   */
  parseAndReplace: (view: EditorView, md: string) => void;
  /**
   * The registered `onSelectionChange` listeners set. Shared between the adapter
   * and the `selectionWatchPlugin` so the plugin can notify subscribers without
   * coupling to the adapter instance.
   */
  listeners: Set<(sel: EditorSelection) => void>;
}

const SELECTION_WATCH_KEY = new PluginKey("editorContentAccess_selectionWatch");

/**
 * Build the ProseMirror selection-watch plugin as a Milkdown `$prose` plugin.
 * Compares `prevState.selection` to `view.state.selection` on every transaction and
 * notifies listeners in the shared `listeners` set when they differ.
 *
 * Add to the editor `.use(...)` chain ONCE (always-present; the listeners set is
 * populated / depopulated at subscription time — no per-subscription state in the
 * plugin). Follows the `calcProsePlugins` pattern exactly.
 *
 * @param getListeners - Thunk returning the current listener set. Using a thunk
 *   (rather than the set directly) lets the adapter swap the set out if needed —
 *   in practice the set is stable; the thunk keeps this composable.
 * @param getSerializeSlice - Thunk: serialize the current selection → markdown.
 */
export function selectionWatchPlugin(
  getListeners: () => Set<(sel: EditorSelection) => void>,
  getSerializeSlice: () => (view: EditorView) => string,
): MilkdownPlugin {
  const plugin = $prose(
    () =>
      new Plugin({
        key: SELECTION_WATCH_KEY,
        view() {
          return {
            update(view, prevState) {
              const ls = getListeners();
              if (ls.size === 0) return;
              if (prevState.selection.eq(view.state.selection)) return;
              const { selection } = view.state;
              const text = selection.empty ? "" : getSerializeSlice()(view);
              const sel: EditorSelection = { text, empty: selection.empty };
              ls.forEach((l) => l(sel));
            },
          };
        },
      }),
  );
  return plugin as unknown as MilkdownPlugin;
}

/**
 * Wrap a Milkdown ProseMirror view as {@link EditorContentAccess}.
 *
 * Receives dependency-injected closures (`serializeSlice`, `parseAndReplace`) that
 * the `MarkdownEditorHandle` builds via `getInstance().action(ctx => ...)`, reusing
 * the `serializerCtx`/`parserCtx` round-trip already shipped in `directive-views.tsx`.
 *
 * The `selectionWatchPlugin` must be added to the editor's `.use(...)` chain so it
 * is installed when the editor boots. The `deps.listeners` set is shared between the
 * plugin and this adapter.
 *
 * Markdown fidelity (default): selection → markdown, incoming text parsed as
 * markdown fragment, with a graceful plain-text fallback on parse failure.
 * Normalization (the WI-1 lesson): the serializer may re-emit formatting differently
 * (e.g. `*` vs `_`). This is the same normalization the WYSIWYG editor applies on
 * every keystroke — consistent, not new. For raw text use `plainText`.
 *
 * D5: content manipulation only — no model/transport.
 */
export function proseMirrorContentAccess(
  deps: ProseMirrorContentAccessDeps,
  options: ProseMirrorContentAccessOptions = {},
): EditorContentAccess {
  const { getView, getText, serializeSlice, parseAndReplace, listeners } = deps;
  // "plainText" bypasses the injected markdown closures and uses pure ProseMirror
  // (`doc.textBetween` / `tr.insertText`) — no `serializerCtx`/`parserCtx`, so a
  // selection reads as raw text and an insert lands as literal characters.
  const plainText = options.fidelity === "plainText";

  function readSelection(view: EditorView): EditorSelection {
    const { selection } = view.state;
    if (selection.empty) return { text: "", empty: true };
    const text = plainText
      ? view.state.doc.textBetween(selection.from, selection.to, "\n")
      : serializeSlice(view);
    return { text, empty: false };
  }

  // replaceSelection and insertAtCursor are the same primitive (replace the active
  // range; an empty range is the caret) — two names for two reader intents.
  const apply = (text: string): void => {
    const view = getView();
    if (!view) return;
    try {
      if (plainText) {
        view.dispatch(view.state.tr.insertText(text).scrollIntoView());
      } else {
        parseAndReplace(view, text);
      }
    } catch {
      // Graceful degradation: parseAndReplace handles parse failures internally,
      // but if anything throws, never propagate to the caller (spec: never throws).
    }
  };

  return {
    getText,

    getSelection(): EditorSelection {
      const view = getView();
      if (!view) return { text: "", empty: true };
      return readSelection(view);
    },

    replaceSelection: apply,
    insertAtCursor: apply,

    focus(): void {
      getView()?.focus();
    },

    onSelectionChange(listener: (selection: EditorSelection) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
