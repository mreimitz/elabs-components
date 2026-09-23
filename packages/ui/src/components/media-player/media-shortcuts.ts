/**
 * The media player's keyboard map as a pure function, so it is tested as a
 * table and a consumer composing their own player can reuse it verbatim.
 *
 * Space / `k` play-pause (Space only when the player root itself is focused —
 * on a focused button Space already activates the button, and a second toggle
 * would cancel it) · ←/→ ±5 s · `j`/`l` ±10 s · ↑/↓ volume ±10 % · `m` mute ·
 * `f` fullscreen (video) · `0`–`9` jump to 0–90 % (finite duration only).
 */

export type MediaKind = "audio" | "video";

export type MediaShortcutAction =
  | { type: "toggle" }
  | { type: "seekBy"; seconds: number }
  | { type: "volumeBy"; delta: number }
  | { type: "toggleMute" }
  | { type: "toggleFullscreen" }
  | { type: "seekToPercent"; percent: number };

export interface MediaShortcutContext {
  /** The event target is the player root (not a control inside it). */
  isRootTarget: boolean;
  kind: MediaKind;
  /** `NaN` before metadata, `Infinity` for live — percent seeks need a finite value. */
  duration: number;
}

export type MediaShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "defaultPrevented" | "ctrlKey" | "metaKey" | "altKey" | "target"
>;

/**
 * Targets that own these keys themselves: a slider's arrows, a menu's
 * typeahead, a text field's caret (extends `carousel.tsx`'s editable guard).
 */
const OWNS_KEYS_SELECTOR = [
  '[role="slider"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

function targetOwnsKeys(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest(OWNS_KEYS_SELECTOR) !== null;
}

/** Resolve a keydown to a player action, or `null` when the player should not react. */
export function resolveMediaShortcut(
  event: MediaShortcutEvent,
  context: MediaShortcutContext,
): MediaShortcutAction | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (targetOwnsKeys(event.target)) return null;

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  switch (key) {
    case " ":
      return context.isRootTarget ? { type: "toggle" } : null;
    case "k":
      return { type: "toggle" };
    case "ArrowLeft":
      return { type: "seekBy", seconds: -5 };
    case "ArrowRight":
      return { type: "seekBy", seconds: 5 };
    case "j":
      return { type: "seekBy", seconds: -10 };
    case "l":
      return { type: "seekBy", seconds: 10 };
    case "ArrowUp":
      return { type: "volumeBy", delta: 0.1 };
    case "ArrowDown":
      return { type: "volumeBy", delta: -0.1 };
    case "m":
      return { type: "toggleMute" };
    case "f":
      return context.kind === "video" ? { type: "toggleFullscreen" } : null;
    default:
      if (/^[0-9]$/.test(key) && Number.isFinite(context.duration) && context.duration > 0) {
        return { type: "seekToPercent", percent: Number(key) * 10 };
      }
      return null;
  }
}
