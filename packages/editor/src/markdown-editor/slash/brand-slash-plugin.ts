"use client";

/**
 * The brand slash-menu Milkdown plugin (the ProseMirror half).
 *
 * A self-owned raw ProseMirror plugin (`$prose`) — NOT `@milkdown/kit/plugin/slash`
 * — so the editor pulls zero new dependencies and we keep full control of the
 * interaction. It owns the STATE and the KEYBOARD; the React widget
 * (slash-widget.tsx) owns the rendered popup. They share one
 * {@link SlashController} (the command list + a Milkdown `Ctx` getter + the
 * insert/close helpers), built once in `MarkdownEditorView` so both the plugin's
 * Enter handler and the widget's click handler run a command the SAME way.
 *
 * Responsibilities here:
 *   1. Detect a `/` typed at a textblock START or after whitespace; track
 *      `{ active, from, query, index }` as the user keeps typing (a literal `/`
 *      mid-word is never hijacked; a space ends the query).
 *   2. Render the React `<SlashMenu>` as a ProseMirror WIDGET decoration at the
 *      caret (via the `useWidgetViewFactory()` factory passed in).
 *   3. ↑/↓ move the selection, Enter inserts the active command (replacing the
 *      `/query` range), Esc / deleting the `/` closes.
 */
import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { $prose } from "@milkdown/kit/utils";
import type { ReactWidgetViewComponent, useWidgetViewFactory } from "@prosemirror-adapter/react";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { Transaction } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { DecorationSet } from "@milkdown/kit/prose/view";

import type { IterationEditHandler } from "../../markdown-iteration/edit-context";
import { filterSlashCommands, type SlashCommand } from "./brand-slash-commands";
import { matchesKeyboardEvent } from "./shortcut";

/**
 * The factory `useWidgetViewFactory()` returns: `(options) => (pos, spec?) =>
 * Decoration`. We borrow the exact type from the hook so we never name the
 * (un-re-exported) `@prosemirror-adapter/core` internals.
 */
export type SlashWidgetFactory = ReturnType<typeof useWidgetViewFactory>;

/** Plugin state. `active === false` means the menu is closed. */
export interface SlashPluginState {
  active: boolean;
  /** Document position of the trigger `/` (char mode) or the caret (shortcut mode). */
  from: number;
  /** Text typed after the `/` (the filter query). */
  query: string;
  /** Index into the CURRENTLY-FILTERED list of the highlighted command. */
  index: number;
  /**
   * How the menu was opened:
   * - `"char"` — the user typed the trigger character (default); the `from`
   *   position holds the `/`, which is deleted when the range is inserted.
   * - `"shortcut"` — opened programmatically via the keyboard shortcut; `from`
   *   is the bare caret position (no leading `/`), so `range` must be `null`
   *   on insert (insert-at-caret, delete nothing).
   */
  triggered: "char" | "shortcut";
}

/** The closed (inactive) plugin state. Exported for unit tests; not barreled. */
export const CLOSED: SlashPluginState = {
  active: false,
  from: 0,
  query: "",
  index: 0,
  triggered: "char",
};

export const slashPluginKey = new PluginKey<SlashPluginState>("brand-slash");

/**
 * The shared controller. Built once in React so the plugin (keyboard) and the
 * widget (mouse) run commands identically with the live Milkdown `Ctx`. The
 * `ctx` is captured by the plugin's `$prose((ctx) => …)` callback (see
 * {@link brandSlashPlugin}) and read back through `getCtx()`.
 */
export interface SlashController {
  /** The command list driving both the menu and the keyboard. */
  commands: SlashCommand[];
  /** The trigger character (default `"/"`). */
  trigger: string;
  /**
   * Optional keyboard shortcut string (e.g. `"Mod-/"`) that opens the menu
   * programmatically at the caret (shortcut mode, no leading `/` in the doc).
   * Parsed by `matchesKeyboardEvent` in `handleKeyDown`.
   */
  shortcut?: string;
  /** Resolve the live Milkdown `Ctx` (set by the plugin at build time). */
  getCtx: () => Ctx;
  /** Internal: the plugin assigns the captured `Ctx` here. */
  _ctx?: Ctx;
  /**
   * Programmatically open the slash menu at the current caret position.
   * Dispatches the `"open"` meta — equivalent to pressing the shortcut key.
   * No-op if no ProseMirror view is available yet.
   */
  openMenu?: (view: EditorView) => void;
  /**
   * Resolve the LIVE `IterationEditContext` handler (#223) — read lazily (a
   * ref-backed getter) so a fresh Provider identity each render never needs the
   * controller (and its editor) to be rebuilt. Set by `MarkdownEditorView`;
   * returns `null`/`undefined` when the consumer hasn't wired one, in which case
   * `runSlashCommand` falls back to a command's plain `run`.
   */
  getIterationEditHandler?: () => IterationEditHandler | null | undefined;
}

/** Create a {@link SlashController} with a settable, lazily-read `Ctx`. */
export function createSlashController(
  commands: SlashCommand[],
  trigger = "/",
  shortcut?: string,
  getIterationEditHandler?: () => IterationEditHandler | null | undefined,
): SlashController {
  const controller: SlashController = {
    commands,
    trigger,
    shortcut,
    getIterationEditHandler,
    getCtx: () => {
      if (!controller._ctx) {
        throw new Error("Brand slash controller used before the editor Ctx was captured.");
      }
      return controller._ctx;
    },
    openMenu: (view: EditorView) => {
      const pos = view.state.selection.from;
      view.dispatch(
        view.state.tr.setMeta(slashPluginKey, {
          _open: true,
          from: pos,
          triggered: "shortcut",
        }),
      );
    },
  };
  return controller;
}

/** Compute the `[from, to)` range covering the trigger + query (to be replaced). */
export function slashRange(state: SlashPluginState): { from: number; to: number } {
  return { from: state.from, to: state.from + 1 + state.query.length };
}

/** Run a command: insert (replacing the `/query` range or at caret), then close the menu. */
export function runSlashCommand(
  view: EditorView,
  controller: SlashController,
  state: SlashPluginState,
  command: SlashCommand,
): void {
  // Char mode: replace the whole `/query` run (slashRange covers the `/` + query).
  // Shortcut mode: there is no leading `/`, but any filter the user typed IS real
  // document text [from, from+query.length) — replace that span so the inserted
  // block lands at `from` with the typed query removed (empty query → insert at
  // caret, delete nothing). NOT range:null, which would leave the query behind.
  const range =
    state.triggered === "shortcut"
      ? { from: state.from, to: state.from + state.query.length }
      : slashRange(state);
  // #223: a `guided` command (currently `/iterate` `/pivot`) opens its modal
  // instead of inserting a bare directive — but ONLY when the consumer has
  // actually wired an `IterationEditContext` handler; with none, fall back to
  // the plain `run` (today's direct-insert behaviour, unchanged).
  const iterationHandler = controller.getIterationEditHandler?.();
  if (command.guided && iterationHandler) {
    // The guided modal doesn't dispatch an insert transaction until it SAVES
    // (Cancel must leave the document untouched) — so the typed `/query` range
    // has to be consumed NOW, or it is left behind as literal text forever
    // when the user cancels. Delete it up front (collapsing the selection to
    // `range.from`) and hand the resolver `range: null` so its eventual save
    // inserts at the now-current caret rather than a stale, already-consumed span.
    view.dispatch(view.state.tr.delete(range.from, range.to));
    command.guided({ ctx: controller.getCtx(), range: null }, iterationHandler);
  } else {
    // The command's `run` dispatches its own insert transaction via the view;
    // then close the (now stale) menu. If the command already removed the
    // range, the close meta is harmless.
    command.run({ ctx: controller.getCtx(), range });
  }
  if (slashPluginKey.getState(view.state)?.active) {
    view.dispatch(view.state.tr.setMeta(slashPluginKey, "close"));
  }
  view.focus();
}

/** A `/` is a valid trigger only at a textblock start or right after whitespace. */
function triggerAllowed(doc: ProseNode, triggerPos: number): boolean {
  const $pos = doc.resolve(triggerPos);
  if (!$pos.parent.isTextblock) return false;
  if ($pos.parent.type.spec.code) return false;
  if ($pos.parentOffset === 0) return true; // start of block
  const before = $pos.parent.textBetween(Math.max(0, $pos.parentOffset - 1), $pos.parentOffset);
  return /\s/.test(before);
}

/**
 * Recompute open/query/index from a transaction. Opens when the trigger is typed
 * in an allowed spot; tracks the query; closes when the `/` is removed, the caret
 * leaves the trigger run/block, the selection is non-empty, or a space is typed.
 *
 * Also handles the `_open` meta (programmatic open via shortcut / `openMenu()`):
 * sets `triggered: "shortcut"` so `runSlashCommand` uses `range: null`.
 */
export function nextState(
  prev: SlashPluginState,
  tr: Transaction,
  trigger: string,
): SlashPluginState {
  const meta = tr.getMeta(slashPluginKey) as
    | (Partial<SlashPluginState> & { _open?: boolean })
    | "close"
    | undefined;

  if (meta === "close") return CLOSED;

  if (meta && typeof meta === "object") {
    // Programmatic open (shortcut / openMenu): open unconditionally at caret.
    if (meta._open) {
      return {
        active: true,
        from: (meta as { from: number }).from,
        query: "",
        index: 0,
        triggered: "shortcut",
      };
    }
    // Nav meta (index change) only applies while still active.
    return prev.active ? { ...prev, ...meta } : prev;
  }

  const sel = tr.selection;
  if (!sel.empty) return prev.active ? CLOSED : prev;

  const pos = sel.from;
  const $pos = tr.doc.resolve(pos);

  if (prev.active) {
    if (pos <= prev.from) return CLOSED;
    const start = tr.doc.resolve(prev.from);
    if (start.parent !== $pos.parent) return CLOSED;

    if (prev.triggered === "shortcut") {
      // In shortcut mode there is no leading trigger char — read the query as
      // text typed AFTER the caret-open position. Skip the triggerChar check.
      const query = $pos.parent.textBetween(start.parentOffset, $pos.parentOffset);
      if (/\s/.test(query)) return CLOSED;
      const index = query === prev.query ? prev.index : 0;
      return { active: true, from: prev.from, query, index, triggered: "shortcut" };
    }

    // Char mode: the first character at `from` must still be the trigger.
    const triggerChar = start.parent.textBetween(start.parentOffset, start.parentOffset + 1);
    if (triggerChar !== trigger) return CLOSED;
    const query = $pos.parent.textBetween(start.parentOffset + 1, $pos.parentOffset);
    if (/\s/.test(query)) return CLOSED;
    const index = query === prev.query ? prev.index : 0;
    return { active: true, from: prev.from, query, index, triggered: "char" };
  }

  if (!tr.docChanged) return prev;
  const justTyped = tr.doc.textBetween(Math.max(0, pos - 1), pos);
  if (justTyped !== trigger) return prev;
  const triggerPos = pos - 1;
  if (!triggerAllowed(tr.doc, triggerPos)) return prev;
  return { active: true, from: triggerPos, query: "", index: 0, triggered: "char" };
}

/** Options for {@link brandSlashPlugin}. */
export interface BrandSlashPluginOptions {
  /** The widget factory from `useWidgetViewFactory()` (created under the adapter provider). */
  widgetFactory: SlashWidgetFactory;
  /** The React component rendered as the widget (built with the controller). */
  widgetComponent: ReactWidgetViewComponent;
  /** The shared controller (commands + ctx getter + trigger). */
  controller: SlashController;
}

/**
 * Build the slash plugin. The widget factory + component + controller are created
 * in React (so the factory lives under `<ProsemirrorAdapterProvider>` and the
 * component closes over the controller). Returns a Milkdown plugin to `.use()`.
 */
export function brandSlashPlugin(options: BrandSlashPluginOptions): MilkdownPlugin {
  const { widgetFactory, widgetComponent, controller } = options;
  const trigger = controller.trigger || "/";

  return $prose((ctx) => {
    // Capture the live editor Ctx so command `run`s (keyboard + mouse) can
    // resolve NodeTypes and the view.
    controller._ctx = ctx;
    return new Plugin<SlashPluginState>({
      key: slashPluginKey,
      state: {
        init: () => CLOSED,
        apply: (tr, value) => nextState(value, tr, trigger),
      },
      props: {
        decorations: (state) => {
          const s = slashPluginKey.getState(state);
          if (!s?.active) return DecorationSet.empty;
          const factory = widgetFactory({ component: widgetComponent, as: "span" });
          // Anchor: in char mode `from + 1` skips the `/`; in shortcut mode
          // anchor at `from` (the bare caret — no `/` to step over).
          const anchor = s.triggered === "shortcut" ? s.from : s.from + 1;
          // `spec` goes on the factory CALL (the Decoration.widget spec), not the
          // factory options. After the caret; don't let the widget disturb the
          // editor selection. Key on from+query+index so ProseMirror re-renders the
          // widget when the filter OR the highlighted row changes (decoration
          // diffing reuses a widget with an unchanged key, which would freeze the
          // ↑/↓ highlight).
          const decoration = factory(anchor, {
            side: 1,
            ignoreSelection: true,
            key: `brand-slash:${s.from}:${s.query}:${s.index}`,
          });
          return DecorationSet.create(state.doc, [decoration]);
        },
        handleKeyDown: (view, event) => {
          // --- Shortcut open (BEFORE the active guard) ---
          // If a shortcut is configured and this event matches it, open the menu
          // at the current caret position in shortcut mode. This runs before keymaps
          // so it beats commonmark/gfm bindings (the exit-keymap.ts precedent).
          if (controller.shortcut && matchesKeyboardEvent(controller.shortcut, event)) {
            const pos = view.state.selection.from;
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                _open: true,
                from: pos,
                triggered: "shortcut",
              }),
            );
            event.preventDefault();
            return true;
          }

          const s = slashPluginKey.getState(view.state);
          if (!s?.active) return false;
          const filtered = filterSlashCommands(controller.commands, s.query);

          if (event.key === "Escape") {
            view.dispatch(view.state.tr.setMeta(slashPluginKey, "close"));
            event.preventDefault();
            return true;
          }
          if (filtered.length === 0) return false;

          if (event.key === "ArrowDown") {
            const index = (s.index + 1) % filtered.length;
            view.dispatch(view.state.tr.setMeta(slashPluginKey, { index }));
            event.preventDefault();
            return true;
          }
          if (event.key === "ArrowUp") {
            const index = (s.index - 1 + filtered.length) % filtered.length;
            view.dispatch(view.state.tr.setMeta(slashPluginKey, { index }));
            event.preventDefault();
            return true;
          }
          if (event.key === "Enter") {
            const command = filtered[Math.min(s.index, filtered.length - 1)];
            if (command) {
              runSlashCommand(view, controller, s, command);
              event.preventDefault();
              return true;
            }
          }
          if (event.key === "Tab") {
            // Tab also selects the active command (common in Notion-style menus).
            const command = filtered[Math.min(s.index, filtered.length - 1)];
            if (command) {
              runSlashCommand(view, controller, s, command);
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
      },
    });
  }) as unknown as MilkdownPlugin;
}
