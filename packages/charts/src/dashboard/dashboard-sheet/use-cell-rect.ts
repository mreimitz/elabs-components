"use client";

import { createContext, useContext } from "react";

import { cellRect, type CellRect } from "../core/layout";
import type { GridSpec, TileLayout } from "../core/spec";

/** The grid a tile is laid on and that grid's pixel size (the sheet, or a container body). */
export interface DashboardGridContextValue {
  grid: GridSpec;
  width: number;
  height: number;
}

export const DashboardGridContext = createContext<DashboardGridContextValue | null>(null);

/**
 * The pixel rectangle of `cell` on the nearest sheet or container grid, relative to that
 * grid's origin. `null` outside a `DashboardSheet` or before the sheet has been measured.
 */
export function useCellRect(cell: Pick<TileLayout, "x" | "y" | "w" | "h">): CellRect | null {
  const ctx = useContext(DashboardGridContext);
  if (!ctx || ctx.width <= 0) return null;
  return cellRect(cell, ctx.grid, ctx);
}
