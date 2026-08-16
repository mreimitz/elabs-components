/**
 * Finding the element a renderer actually scrolls inside.
 *
 * `FileViewerContent` is THE scroll boundary (`viewer-components.md`), and now
 * that page and zoom chrome lives in the shell (ADR 0026) even the PDF adapter
 * no longer has fixed controls of its own to justify a second viewport. But a
 * renderer still has to MEASURE that box — a fit-to-width scale is a function of
 * the viewport's width, and a virtualized page list is a function of its height.
 *
 * Resolved from the DOM rather than passed as a prop because a renderer may be
 * mounted anywhere: inside the shell, inside a consumer's own frame, or bare in
 * a test. Same shape as extend-hq/ui's `resolveScrollAreaViewport`.
 */

/** The `data-slot` the shell's scrolling pane carries. */
export const SCROLL_HOST_SELECTOR = '[data-slot="file-viewer-content"]';

/**
 * The nearest scrolling ancestor of `node`.
 *
 * Prefers the shell's pane by its stable `data-slot`; falls back to the first
 * ancestor whose computed overflow actually scrolls, so a renderer composed into
 * someone else's frame still measures the right box. `null` when nothing
 * scrolls — the caller should then fall back to its own element.
 */
export function findScrollHost(node: Element | null | undefined): HTMLElement | null {
  if (!node) return null;
  const shell = node.closest<HTMLElement>(SCROLL_HOST_SELECTOR);
  if (shell) return shell;

  const view = node.ownerDocument?.defaultView;
  if (!view) return null;
  let current = node.parentElement;
  while (current) {
    const { overflowY, overflowX } = view.getComputedStyle(current);
    if (/(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflowX)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
