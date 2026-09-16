/**
 * Anchor coordinates for a synthetic `contextmenu` event (RM-081 follow-up 5, visual P1):
 * Shift+F10 (`use-dashboard-shortcuts.ts`) and the header kebab's "Tile actions…" entry
 * (`dashboard-tile.tsx`) both open `DashboardTileContextMenu` (`tile-context-menu.tsx`) by
 * dispatching a native `contextmenu` event at the tile root, the same way a real right-click
 * would. Radix's `ContextMenu` positions `ContextMenuContent` at that event's own
 * `clientX`/`clientY` — it has no separate controlled-anchor prop the way `Popover` has a
 * `virtualRef` — so a synthetic event with NO coordinates (both default to `0`) anchors the
 * menu at the viewport's top-left corner regardless of which tile it targets. Carrying real
 * coordinates on the synthetic event IS Radix's own supported mechanism, not a workaround
 * around it.
 */

/** Pixels the anchor point sits inside `anchorEl`'s own top-start corner, so the menu opens
 * over the tile rather than exactly flush with its edge. */
const ANCHOR_INSET = 8;

/**
 * Dispatch a `contextmenu` event at `target` (bubbles to the nearest `ContextMenuTrigger`),
 * anchored at `anchorEl`'s own top-start corner — physically top-right in an RTL layout,
 * resolved from `anchorEl`'s OWN computed `direction` (never the document's), so a tile inside
 * an RTL island anchors correctly even in an LTR app shell.
 */
export function dispatchAnchoredContextMenu(target: HTMLElement, anchorEl: HTMLElement): void {
  const rect = anchorEl.getBoundingClientRect();
  const rtl = getComputedStyle(anchorEl).direction === "rtl";
  const clientX = rtl ? rect.right - ANCHOR_INSET : rect.left + ANCHOR_INSET;
  const clientY = rect.top + ANCHOR_INSET;
  target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY }),
  );
}
