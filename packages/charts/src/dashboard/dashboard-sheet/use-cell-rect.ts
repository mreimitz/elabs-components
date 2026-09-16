"use client";

import { createContext, useContext } from "react";

import { cellRect, type CellRect } from "../core/layout";
import type { GridSpec, TileLayout } from "../core/spec";

/** A layout cell, id stripped — the shape `resolveBreakpointLayout` resolves per tile/container. */
export type ResolvedCell = Pick<TileLayout, "x" | "y" | "w" | "h">;

/** The grid a tile is laid on and that grid's pixel size (the sheet, or a container body). */
export interface DashboardGridContextValue {
  grid: GridSpec;
  width: number;
  height: number;
  /**
   * responsive layout — RM-084: the sheet's own `resolveBreakpointLayout(spec, bp)` result, id
   * keyed — `undefined` for a container's inner grid (breakpoint overrides only ever apply to
   * TOP-level tiles/containers; a container's own children keep reading their base `layout`).
   */
  resolvedLayout?: Map<string, ResolvedCell>;
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

/**
 * responsive layout — RM-084: `id`'s cell from the nearest sheet's resolved per-breakpoint
 * layout, or `fallback` (the tile's own base `layout`) when there is no sheet context, no
 * override for this breakpoint, or `id` belongs to a container's inner grid.
 */
export function useResolvedCell(id: string, fallback: ResolvedCell): ResolvedCell {
  const ctx = useContext(DashboardGridContext);
  return ctx?.resolvedLayout?.get(id) ?? fallback;
}
