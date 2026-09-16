"use client";

import { createContext, useContext } from "react";

import type { TileLayout } from "../core/spec";
import type { EditMessages, ResizeHandle } from "./announcer";
import type { CellPitch } from "./cell-coordinate-getter";

/** One move or resize gesture in progress (pointer, touch or keyboard). */
export interface DashboardEditSession {
  kind: "move" | "resize";
  tileId: string;
  /** The resize handle; absent for a move. */
  handle?: ResizeHandle;
  /** The tile's cells when the gesture started — Escape restores them. */
  origin: TileLayout;
  /** The snapped cells the tile would take on drop (the ghost). */
  target: TileLayout;
  /** Whole-cell offset the gesture has accumulated. */
  delta: { dx: number; dy: number };
  /** The would-be top-level layout, painted live while the gesture runs. */
  layout: TileLayout[];
  /** Whether dropping now is allowed (`fit` rejects overlaps). */
  ok: boolean;
}

/** What the edit layer shares with tiles and handles. Internal to the dashboard surface. */
export interface DashboardEditContextValue {
  session: DashboardEditSession | null;
  messages: EditMessages;
  /** Cell size plus gap on the sheet grid; `null` before the sheet is measured. */
  pitch: CellPitch | null;
  reducedMotion: boolean;
  /** Keyboard resize: grow/shrink from `handle` by whole cells (starts a session if needed). */
  resizeBy(tileId: string, handle: ResizeHandle, dx: number, dy: number): void;
  /** Commit the running session (keyboard Enter on a handle). */
  commit(): void;
  /** Abandon the running session and restore the layout it started from. */
  cancel(): void;
}

export const DashboardEditContext = createContext<DashboardEditContextValue | null>(null);

/** The edit layer's context; `null` outside edit mode. */
export function useDashboardEdit(): DashboardEditContextValue | null {
  return useContext(DashboardEditContext);
}

/** The cells to draw a top-level tile at: the running gesture's preview, else `layout`. */
export function previewLayoutFor(
  edit: DashboardEditContextValue | null,
  id: string,
): TileLayout | undefined {
  return edit?.session?.layout.find((item) => item.id === id);
}
