/**
 * Edit-layer announcements (RM-078). Every edit announcement — pick-up, move, drop, reject,
 * resize, cancel — goes to ONE polite live region per sheet (`DashboardEditLayer`), so a
 * screen reader hears one voice. dnd-kit's own announcements are silenced
 * (`SILENT_ANNOUNCEMENTS`); its screen-reader instructions are kept and localized.
 */
import type { Announcements } from "@dnd-kit/core";

import type { TileLayout } from "../core/spec";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Cell = Pick<TileLayout, "x" | "y" | "w" | "h">;

/** dnd-kit announcements that say nothing; the edit layer announces through its own region. */
export const SILENT_ANNOUNCEMENTS: Announcements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

/** Resize handle positions — corners and edge midpoints — in the handles' focus order. */
export const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** 1-based column/row numbers and the size, as announced and shown on the size badge. */
function cellVars(cell: Cell) {
  return { x: cell.x + 1, y: cell.y + 1, w: cell.w, h: cell.h };
}

/** Localized edit-layer strings for one `t`. */
export function editMessages(t: Translate) {
  const edge: Record<ResizeHandle, string> = {
    n: t("charts.dashboard.edit.edgeTop"),
    ne: t("charts.dashboard.edit.edgeTopRight"),
    e: t("charts.dashboard.edit.edgeRight"),
    se: t("charts.dashboard.edit.edgeBottomRight"),
    s: t("charts.dashboard.edit.edgeBottom"),
    sw: t("charts.dashboard.edit.edgeBottomLeft"),
    w: t("charts.dashboard.edit.edgeLeft"),
    nw: t("charts.dashboard.edit.edgeTopLeft"),
  };
  return {
    instructions: t("charts.dashboard.edit.instructions"),
    moveTile: (title: string) => t("charts.dashboard.edit.moveTile", { title }),
    resizeTile: (title: string, handle: ResizeHandle) =>
      t("charts.dashboard.edit.resizeTile", { title, edge: edge[handle] }),
    sizeBadge: (cell: Cell) => t("charts.dashboard.edit.sizeBadge", cellVars(cell)),
    pickedUp: (title: string, cell: Cell) =>
      t("charts.dashboard.edit.pickedUp", { title, ...cellVars(cell) }),
    moved: (cell: Cell) => t("charts.dashboard.edit.moved", cellVars(cell)),
    dropped: (title: string, cell: Cell) =>
      t("charts.dashboard.edit.dropped", { title, ...cellVars(cell) }),
    rejected: t("charts.dashboard.edit.rejected"),
    resizing: (title: string, cell: Cell) =>
      t("charts.dashboard.edit.resizing", { title, ...cellVars(cell) }),
    resized: (title: string, cell: Cell) =>
      t("charts.dashboard.edit.resized", { title, ...cellVars(cell) }),
    cancelled: t("charts.dashboard.edit.cancelled"),
  };
}

export type EditMessages = ReturnType<typeof editMessages>;
