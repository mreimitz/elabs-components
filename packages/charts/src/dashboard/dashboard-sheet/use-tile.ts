"use client";

import type { TileSpec } from "../core/spec";
import { useDashboard } from "./use-dashboard";

/** One tile's spec, or `undefined` when no tile has that id. */
export function useTile(id: string): TileSpec | undefined {
  return useDashboard((state) => state.spec.tiles.find((tile) => tile.id === id));
}
