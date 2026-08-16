/**
 * Focus-writing helpers (Ulysses Phase A) — the pure half of the workspace's
 * "Focus" toggle: paragraph focus (mark the top-level block that owns the
 * selection) and typewriter scrolling (keep the caret in a vertical band
 * around the scroller's center). Engine-agnostic: plain DOM walking, no
 * ProseMirror plugin surface — testable in jsdom without booting Milkdown.
 */

/** The editor-root CHILD that contains `node` (the active top-level block). */
export function topLevelBlockOf(editorRoot: Element, node: Node | null): Element | null {
  let current: Node | null = node;
  while (current && current.parentNode !== editorRoot) {
    current = current.parentNode;
  }
  return current instanceof Element ? current : null;
}

/**
 * Typewriter scroll adjustment: how far the scroller must move so the caret
 * sits back in the center band. Returns 0 while the caret is inside the band
 * (no jitter on every keystroke — only re-center when it drifts out).
 *
 * @param band fraction of the scroller height treated as "centered enough".
 */
export function typewriterDelta(
  caretTop: number,
  caretHeight: number,
  hostTop: number,
  hostHeight: number,
  band = 0.22,
): number {
  if (hostHeight <= 0) return 0;
  const center = hostTop + hostHeight / 2;
  const caretMid = caretTop + caretHeight / 2;
  const tolerance = (hostHeight * band) / 2;
  const off = caretMid - center;
  return Math.abs(off) <= tolerance ? 0 : off;
}
