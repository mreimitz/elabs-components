/**
 * Auto-scroll options for the edit layer's `DndContext` (RM-078). dnd-kit scrolls every
 * scrollable ancestor of the dragged tile — the sheet's own scroll container first, then the
 * document as the fallback — once the pointer enters the edge band below.
 */
import type { AutoScrollOptions } from "@dnd-kit/core";

/** Edge band (fraction of the scroller) and speed used while dragging a tile. */
export function dashboardAutoScroll(reducedMotion: boolean): AutoScrollOptions {
  return {
    enabled: true,
    threshold: { x: 0.1, y: 0.15 },
    // Reduced motion keeps scrolling possible (a tile must still reach off-screen cells), slower.
    acceleration: reducedMotion ? 4 : 10,
    layoutShiftCompensation: false,
  };
}
