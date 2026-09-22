"use client";

import { createContext, useContext } from "react";

import type { TileSpec } from "../core/spec";
import type { DashboardTileMenuItem } from "./dashboard-tile-menu";

/** Sheet-wide services tiles read: lazy mounting, roving focus, chrome. Internal. */
export interface DashboardSheetContextValue {
  /** Watch `el`; `onVisible` fires once when it enters the viewport band. Returns an unobserve. */
  observe: ((el: Element, onVisible: () => void) => () => void) | null;
  renderAll: boolean;
  chrome: boolean;
  /** The tile that owns the sheet's single tab stop. */
  activeTileId: string | null;
  setActiveTileId: (id: string) => void;
  menuItems?: (tile: TileSpec) => DashboardTileMenuItem[];
}

export const DashboardSheetContext = createContext<DashboardSheetContextValue | null>(null);

export function useDashboardSheetContext(): DashboardSheetContextValue | null {
  return useContext(DashboardSheetContext);
}
