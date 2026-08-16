/**
 * Shortcut helpers for the cross-pane slash menu (#271) — the PURE half.
 *
 * No React, no Milkdown, **no Monaco**. This module is imported by
 * `brand-slash-plugin.ts` (and therefore by the Milkdown `MarkdownEditor` import
 * graph), so it must NOT pull `monaco-editor` — doing so drags the Monaco runtime
 * (and its jsdom-hostile clipboard module) into every WYSIWYG test. The
 * Monaco-keybinding conversion lives in the sibling `./shortcut-monaco.ts`, which
 * only the Monaco-side surfaces (the workspace) import.
 *
 * INTERNAL — not exported from package barrels.
 */

/**
 * The default keyboard shortcut for the slash command menu.
 * `Mod` = Cmd on macOS, Ctrl elsewhere (Monaco's `CtrlCmd`).
 *
 * NOTE: this is NOT `Mod-/` — Monaco binds `Mod-/` to "Toggle Line Comment" by
 * default, which eats the keystroke before the slash action sees it (the source
 * pane's primary trigger is typing `/`; this hotkey is the secondary path). `Mod-Shift-O`
 * is free in Chrome/macOS; it DOES collide with the bookmarks shortcut in Firefox
 * and on Windows/Linux Chrome, so consumers shipping cross-browser should override
 * `slashMenu.shortcut`. The conflict-free trigger is typing `/`.
 */
export const DEFAULT_SLASH_SHORTCUT = "Mod-Shift-O";

/**
 * Returns `true` when a DOM `KeyboardEvent` matches a shortcut string.
 *
 * - `Mod` matches `event.metaKey` (macOS) OR `event.ctrlKey` (other platforms).
 * - `Shift` / `Alt` match the corresponding event fields.
 * - The final key matches `event.key` (case-insensitive); `"/"` matches
 *   `event.key === "/"`.
 *
 * Used by the WYSIWYG plugin's `handleKeyDown` (which receives DOM events) to
 * decide whether to open the menu — pure, so it never pulls the monaco namespace.
 */
export function matchesKeyboardEvent(shortcut: string, event: KeyboardEvent): boolean {
  const parts = shortcut.split("-");
  const keyPart = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1).map((m) => m.toLowerCase()));

  // Check modifier flags.
  const wantsMod = modifiers.has("mod");
  const wantsShift = modifiers.has("shift");
  const wantsAlt = modifiers.has("alt");

  if (wantsMod && !(event.metaKey || event.ctrlKey)) return false;
  if (!wantsMod && (event.metaKey || event.ctrlKey)) return false;
  if (wantsShift && !event.shiftKey) return false;
  if (!wantsShift && event.shiftKey) return false;
  if (wantsAlt && !event.altKey) return false;
  if (!wantsAlt && event.altKey) return false;

  // Check the key itself (case-insensitive).
  return event.key.toLowerCase() === keyPart.toLowerCase();
}
