"use client";

/**
 * CompletionWidget — the React widget the completions plugin mounts at the
 * caret (the `slash-widget.tsx` precedent). Reads the live plugin state,
 * renders the branded `<CompletionMenu>` floating below the caret, and inserts
 * the chosen candidate through the SAME path as the plugin's own Enter/Tab
 * handler (`insertCompletionItem`), so mouse and keyboard behave identically.
 */
import type { ReactWidgetViewComponent } from "@prosemirror-adapter/react";
import { useWidgetViewContext } from "@prosemirror-adapter/react";
import { useLayoutEffect, useRef } from "react";

import { CompletionMenu, completionOptionId } from "./completions-menu";
import {
  completionsPluginKey,
  insertCompletionItem,
  type CompletionPluginState,
} from "./completions-prose";

const ID_PREFIX = "brand-completions";

/** Build the widget component (no external state — everything reads off the view). */
export function createCompletionWidget(): ReactWidgetViewComponent {
  function CompletionWidget() {
    const { view } = useWidgetViewContext();
    const wrapperRef = useRef<HTMLSpanElement>(null);

    const state = completionsPluginKey.getState(view.state) as CompletionPluginState | undefined;
    const items = state?.items ?? [];
    const activeIndex = state ? Math.min(state.index, Math.max(0, items.length - 1)) : 0;
    const activeId = items.length > 0 ? completionOptionId(ID_PREFIX, activeIndex) : undefined;

    // Mirror the active option onto the editor's `textbox` for AT, same wiring
    // as the slash widget.
    useLayoutEffect(() => {
      const dom = view.dom as HTMLElement;
      const listEl = wrapperRef.current?.querySelector<HTMLElement>('[role="listbox"]');
      if (listEl && !listEl.id) listEl.id = `${ID_PREFIX}-listbox`;
      dom.setAttribute("aria-expanded", "true");
      if (listEl) dom.setAttribute("aria-controls", listEl.id);
      if (activeId) dom.setAttribute("aria-activedescendant", activeId);
      else dom.removeAttribute("aria-activedescendant");
      return () => {
        dom.removeAttribute("aria-expanded");
        dom.removeAttribute("aria-controls");
        dom.removeAttribute("aria-activedescendant");
      };
    }, [view, activeId]);

    const onSelect = (index: number) => {
      if (!state) return;
      const item = items[index];
      if (item) insertCompletionItem(view, state, item);
    };

    return (
      <span
        ref={wrapperRef}
        contentEditable={false}
        className="brand-completions-anchor relative inline-block h-0 w-0 align-baseline"
      >
        <span className="absolute left-0 top-1 z-50 block">
          <CompletionMenu
            items={items}
            activeIndex={activeIndex}
            onSelect={onSelect}
            idPrefix={ID_PREFIX}
          />
        </span>
      </span>
    );
  }
  return CompletionWidget;
}
