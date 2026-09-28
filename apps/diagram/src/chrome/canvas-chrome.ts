/** Chrome stays outside the fading renderers, but fitting and export still need its panels. */
export function canvasChrome(pane: HTMLElement): HTMLElement | null {
  const lens = pane.closest<HTMLElement>("[data-lens-pane]")?.dataset.lensPane;
  return (
    pane.closest("[data-lens-root]")?.querySelector<HTMLElement>(`[data-lens-chrome="${lens}"]`) ??
    null
  );
}
