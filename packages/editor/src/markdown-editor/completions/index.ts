"use client";

/**
 * WYSIWYG completions mirror — public surface for the Milkdown `MarkdownEditor`
 * (the `../slash/index.ts` precedent). See `completions-prose.ts` for what this
 * mirror does and does NOT cover relative to the Monaco path.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";

import type { EditorCompletionProvider } from "../../lib/editor-completions";
import { completionsProsePlugin, type CompletionWidgetFactory } from "./completions-prose";
import { createCompletionWidget } from "./completions-widget";

/**
 * Build the `.use()`-ready plugin array for the WYSIWYG completions mirror.
 * Call with the widget factory from `useWidgetViewFactory()` (must run inside a
 * `<ProsemirrorAdapterProvider>`), mirroring `brandSlashViewPlugins`.
 */
export function completionsViewPlugins(
  widgetFactory: CompletionWidgetFactory,
  getProviders: () => EditorCompletionProvider[] | undefined,
): MilkdownPlugin[] {
  const widgetComponent = createCompletionWidget();
  return [completionsProsePlugin({ widgetFactory, widgetComponent, getProviders })];
}

export {
  CLOSED,
  completionsPluginKey,
  nextCompletionState,
  buildCompletionContext,
  completionReplaceRange,
  insertCompletionItem,
  type CompletionPluginState,
  type CompletionWidgetFactory,
} from "./completions-prose";
export { CompletionMenu, completionOptionId, type CompletionMenuProps } from "./completions-menu";
