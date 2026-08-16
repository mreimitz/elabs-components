/**
 * Shortcut helpers for the cross-pane slash menu (#271) — the MONACO half.
 *
 * Converts a shortcut string (e.g. `"Mod-/"`) into a Monaco keybinding bitmask.
 * This is the ONLY slash module that imports `monaco-editor`; it is imported only
 * by the Monaco-side surfaces (the source pane action in `MarkdownWorkspace`), so
 * the pure `./shortcut.ts` — imported by the Milkdown plugin — stays Monaco-free.
 *
 * INTERNAL — not exported from package barrels.
 */
import * as monaco from "monaco-editor";

/** Supported letter key names (A-Z, case-insensitive in shortcut strings). */
const LETTER_KEY_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  const kc = monaco.KeyCode as unknown as Record<string, number>;
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // "A".."Z"
    const code = kc[`Key${letter}`];
    if (code !== undefined) map[letter.toLowerCase()] = code;
  }
  return map;
})();

const NAMED_KEY_MAP: Record<string, number> = {
  "/": monaco.KeyCode.Slash,
  backspace: monaco.KeyCode.Backspace,
  delete: monaco.KeyCode.Delete,
  escape: monaco.KeyCode.Escape,
  enter: monaco.KeyCode.Enter,
  tab: monaco.KeyCode.Tab,
  arrowup: monaco.KeyCode.UpArrow,
  arrowdown: monaco.KeyCode.DownArrow,
  arrowleft: monaco.KeyCode.LeftArrow,
  arrowright: monaco.KeyCode.RightArrow,
};

/**
 * Parse a shortcut string (e.g. `"Mod-/"`, `"Mod-Shift-K"`) into a Monaco
 * keybinding bitmask. Supports `Mod` (CtrlCmd), `Shift`, `Alt` modifiers and
 * a final key that is either a letter (A-Z) or one of the named keys in
 * `NAMED_KEY_MAP`. Throws for unrecognized final keys.
 *
 * The shipped default is `"Mod-/"` → `KeyMod.CtrlCmd | KeyCode.Slash`.
 */
export function parseShortcut(shortcut: string): number {
  const parts = shortcut.split("-");
  let binding = 0;
  const keyPart = parts[parts.length - 1] ?? "";
  const modifiers = parts.slice(0, -1).map((m) => m.toLowerCase());

  for (const mod of modifiers) {
    if (mod === "mod") binding |= monaco.KeyMod.CtrlCmd;
    else if (mod === "shift") binding |= monaco.KeyMod.Shift;
    else if (mod === "alt") binding |= monaco.KeyMod.Alt;
    // Ctrl/Meta can also be named explicitly
    else if (mod === "ctrl") binding |= monaco.KeyMod.WinCtrl;
  }

  const key = keyPart.toLowerCase();
  const keyCode =
    NAMED_KEY_MAP[key] ??
    LETTER_KEY_MAP[key] ??
    (() => {
      throw new Error(
        `[@qlik-coe-emea/qlabs-components-editor] parseShortcut: unrecognized key "${keyPart}"`,
      );
    })();

  return binding | keyCode;
}
