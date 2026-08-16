"use client";

/**
 * SlashWidget — the React widget the slash plugin mounts at the caret.
 *
 * The adapter renders this (no props) inside a ProseMirror widget decoration; it
 * reads the live `EditorView` from `useWidgetViewContext()`, pulls the slash
 * plugin state, and renders the branded `<SlashMenu>` floating just below the
 * caret. Clicking an option runs the command through the shared
 * {@link SlashController} (same path as the plugin's Enter handler), so the mouse
 * and keyboard insert identically.
 *
 * Built via `createSlashWidget(controller)` so the component closes over the
 * controller (commands + Milkdown `Ctx` getter) — no module-level mutable state,
 * no circular import with the plugin.
 */
import type { ReactWidgetViewComponent } from "@prosemirror-adapter/react";
import { useWidgetViewContext } from "@prosemirror-adapter/react";
import { useLayoutEffect, useRef } from "react";

import { filterSlashCommands, type SlashCommand } from "./brand-slash-commands";
import { SlashMenu, slashOptionId } from "./slash-menu";
import {
  runSlashCommand,
  slashPluginKey,
  type SlashController,
  type SlashPluginState,
} from "./brand-slash-plugin";

const ID_PREFIX = "brand-slash";

/** Build the widget component bound to a controller. */
export function createSlashWidget(controller: SlashController): ReactWidgetViewComponent {
  function SlashWidget() {
    const { view } = useWidgetViewContext();
    const wrapperRef = useRef<HTMLSpanElement>(null);

    const state = slashPluginKey.getState(view.state) as SlashPluginState | undefined;
    const query = state?.query ?? "";
    const filtered = filterSlashCommands(controller.commands, query);
    const activeIndex = state ? Math.min(state.index, Math.max(0, filtered.length - 1)) : 0;
    const active = filtered[activeIndex];
    const activeId = active?.id;

    // Mirror the active option onto the editor's `textbox` for AT
    // (`aria-activedescendant` + `aria-controls`), then clean up on unmount.
    useLayoutEffect(() => {
      const dom = view.dom as HTMLElement;
      const listEl = wrapperRef.current?.querySelector<HTMLElement>('[role="listbox"]');
      if (listEl && !listEl.id) listEl.id = `${ID_PREFIX}-listbox`;
      dom.setAttribute("aria-expanded", "true");
      if (listEl) dom.setAttribute("aria-controls", listEl.id);
      if (activeId) dom.setAttribute("aria-activedescendant", slashOptionId(ID_PREFIX, activeId));
      else dom.removeAttribute("aria-activedescendant");
      return () => {
        dom.removeAttribute("aria-expanded");
        dom.removeAttribute("aria-controls");
        dom.removeAttribute("aria-activedescendant");
      };
    }, [view, activeId]);

    // Keep the highlighted option scrolled into view as ↑/↓ moves it.
    useLayoutEffect(() => {
      if (!activeId) return;
      const el = wrapperRef.current?.querySelector<HTMLElement>(
        `#${CSS.escape(slashOptionId(ID_PREFIX, activeId))}`,
      );
      el?.scrollIntoView({ block: "nearest" });
    }, [activeId]);

    const onSelect = (command: SlashCommand) => {
      if (!state) return;
      runSlashCommand(view, controller, state, command);
    };

    return (
      // The widget anchor is zero-width inline; the menu floats below the caret.
      <span
        ref={wrapperRef}
        contentEditable={false}
        // Keep the widget out of the accessibility tree as a node — the listbox
        // inside carries the semantics, and the editor textbox owns the relationship.
        className="brand-slash-anchor relative inline-block h-0 w-0 align-baseline"
      >
        <span className="absolute left-0 top-1 z-50 block">
          <SlashMenu
            commands={filtered}
            activeId={activeId}
            onSelect={onSelect}
            idPrefix={ID_PREFIX}
          />
        </span>
      </span>
    );
  }
  return SlashWidget;
}
