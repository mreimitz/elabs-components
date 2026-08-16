"use client";

/**
 * Brand slash-menu — public surface for the WYSIWYG markdown editor.
 *
 * Typing `/` at a block start (or after whitespace) opens a branded command menu
 * that inserts the brand `:::` directives + basic blocks live in the editor. The
 * load-bearing pieces:
 *   - `brand-slash-commands` — the typed, tree-shakeable command registry.
 *   - `insert-directive` — the pure ProseMirror insertion commands (unit-tested).
 *   - `brand-slash-plugin` — the `$prose` plugin (state + keyboard).
 *   - `slash-widget` / `slash-menu` — the React widget + the branded popup.
 *
 * `brandSlashViewPlugins(widgetFactory, options)` wires it all together — call it
 * with the factory from `useWidgetViewFactory()` (so it runs under
 * `<ProsemirrorAdapterProvider>`), exactly like `directiveViewPlugins`.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";

import type { IterationEditHandler } from "../../markdown-iteration/edit-context";
import { BRAND_SLASH_COMMANDS, type SlashCommand } from "./brand-slash-commands";
import {
  brandSlashPlugin,
  createSlashController,
  type SlashWidgetFactory,
} from "./brand-slash-plugin";
import { DEFAULT_SLASH_SHORTCUT } from "./shortcut";
import { createSlashWidget } from "./slash-widget";

/** Options for {@link brandSlashViewPlugins}. */
export interface BrandSlashViewOptions {
  /** Override the default command list. */
  commands?: SlashCommand[];
  /** The trigger character. Defaults to `"/"`. */
  trigger?: string;
  /**
   * Keyboard shortcut that opens the menu at the caret in BOTH panes (#271).
   * Defaults to `DEFAULT_SLASH_SHORTCUT` (`"Mod-Shift-O"`). Set to `undefined` or
   * an empty string to disable the shortcut binding.
   */
  shortcut?: string;
  /**
   * Resolve the live `IterationEditContext` handler (#223, internal —
   * `MarkdownEditorView` wires this from `useContext`). When present, a
   * `guided` command (`/iterate` `/pivot`) opens its modal instead of a bare
   * insert. Not part of the public `slashMenu` prop surface.
   */
  getIterationEditHandler?: () => IterationEditHandler | null | undefined;
}

/**
 * Build the slash-menu Milkdown plugins. Call with the widget factory from
 * `useWidgetViewFactory()` (must run inside a `<ProsemirrorAdapterProvider>`),
 * then `.use()` the result on the editor.
 */
export function brandSlashViewPlugins(
  widgetFactory: SlashWidgetFactory,
  options: BrandSlashViewOptions = {},
): MilkdownPlugin[] {
  const commands = options.commands ?? BRAND_SLASH_COMMANDS;
  const shortcut = "shortcut" in options ? options.shortcut : DEFAULT_SLASH_SHORTCUT;
  const controller = createSlashController(
    commands,
    options.trigger ?? "/",
    shortcut,
    options.getIterationEditHandler,
  );
  const widgetComponent = createSlashWidget(controller);
  return [brandSlashPlugin({ widgetFactory, widgetComponent, controller })];
}

export {
  BRAND_SLASH_COMMANDS,
  filterSlashCommands,
  groupSlashCommands,
  type SlashCommand,
  type SlashInsertContext,
  type SourceSlashContext,
  type BasicBlockId,
} from "./brand-slash-commands";
export {
  insertBrandDirective,
  insertBasicBlock,
  insertCalcFence,
  resolveBrandInsert,
  resolveBasicInsert,
  resolveCalcInsert,
  isContainerDirective,
  isLeafDirective,
  CALC_FENCE_SEED,
  type InsertableDirective,
  type SlashRange,
} from "./insert-directive";
export { SlashMenu, slashOptionId, type SlashMenuProps } from "./slash-menu";
export {
  slashPluginKey,
  slashRange,
  createSlashController,
  type SlashController,
  type SlashPluginState,
  type SlashWidgetFactory,
} from "./brand-slash-plugin";
// NOTE: `MonacoSlashMenu` is deliberately NOT re-exported here. It pulls the
// Monaco runtime (via `markdown-commands`), and this barrel is imported by the
// Milkdown `MarkdownEditor` graph, which must stay Monaco-free. It is exported
// from the heavy `@elabs-ai/components-editor/markdown` subpath instead (which already pulls
// Monaco via `MarkdownWorkspace`).
