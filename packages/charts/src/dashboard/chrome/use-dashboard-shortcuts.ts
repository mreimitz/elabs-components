"use client";

/**
 * `useDashboardShortcuts` (RM-079) — the toolbar's seven keyboard shortcuts: undo, redo,
 * toggle edit, delete focused tiles, duplicate focused tiles, clear focus, save. Returns a
 * ref the app attaches to the element wrapping BOTH the toolbar and the sheet, so the
 * listener is scoped to that subtree — never `window`-global — and never fires while focus
 * is in a text input or `contenteditable` (a tile's own editable content, a form field in
 * the properties panel).
 *
 * `Mod+D` (duplicate) and `Delete`/`Backspace` (delete) act on `state.focus` via the store's
 * own `duplicateTile`/`removeTile` — RM-081 is expected to add richer multi-tile actions, but
 * until then these are the store's real, already-shipped primitives (orchestrator notes).
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";

import { useDashboard, useDashboardActions } from "../dashboard-sheet";

export interface UseDashboardShortcutsOptions {
  /** Called for `Mod+S`. Typically the same handler passed to `DashboardToolbar`'s `onSave`. */
  onSave?: () => void;
  /** Disable every shortcut, e.g. a read-only embed. Default `true`. */
  enabled?: boolean;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Attach the returned ref to the element that wraps the toolbar and the sheet. Reads the
 * store through `useDashboard`/`useDashboardActions` — call it inside a `DashboardProvider`.
 */
export function useDashboardShortcuts(
  options: UseDashboardShortcutsOptions = {},
): RefObject<HTMLDivElement | null> {
  const { onSave, enabled = true } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const actions = useDashboardActions();
  const mode = useDashboard((s) => s.mode);
  const focus = useDashboard((s) => s.focus);

  // Read the latest mode/focus/onSave from a ref inside the listener, so the listener
  // itself is registered once (actions is stable — see `useDashboardActions`'s doc) rather
  // than torn down and re-added on every store update.
  const latest = useRef({ mode, focus, onSave });
  latest.current = { mode, focus, onSave };

  useEffect(() => {
    if (!enabled) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntry(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const { mode: currentMode, focus: currentFocus, onSave: save } = latest.current;

      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        actions.undo();
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        actions.redo();
      } else if (mod && key === "d") {
        event.preventDefault();
        for (const id of currentFocus) actions.duplicateTile(id);
      } else if (mod && key === "s") {
        event.preventDefault();
        save?.();
      } else if (!mod && (event.key === "Delete" || event.key === "Backspace")) {
        if (currentFocus.length === 0) return;
        event.preventDefault();
        for (const id of currentFocus) actions.removeTile(id);
      } else if (!mod && key === "e") {
        event.preventDefault();
        actions.setMode(currentMode === "edit" ? "view" : "edit");
      } else if (event.key === "Escape") {
        actions.setFocus([]);
      }
    }

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [enabled, actions]);

  return containerRef;
}

/** One shortcut's action key and its ordered key tokens — feeds `ui/KeyboardShortcuts`. */
export interface DashboardShortcutDescriptor {
  action: string;
  keys: string[];
}

/** The seven shortcuts, in the order the shortcuts sheet lists them (`Kbd`-ready tokens). */
export function dashboardShortcutDescriptors(mod = "⌘"): DashboardShortcutDescriptor[] {
  return [
    { action: "undo", keys: [mod, "Z"] },
    { action: "redo", keys: [mod, "Shift", "Z"] },
    { action: "toggleEdit", keys: ["E"] },
    { action: "delete", keys: ["Delete"] },
    { action: "duplicate", keys: [mod, "D"] },
    { action: "clearFocus", keys: ["Esc"] },
    { action: "save", keys: [mod, "S"] },
  ];
}

/** Stable identity across renders for callers that only need the default (`⌘`) set. */
export function useDashboardShortcutDescriptors(mod = "⌘"): DashboardShortcutDescriptor[] {
  return useMemo(() => dashboardShortcutDescriptors(mod), [mod]);
}
