import { createContext, useContext } from "react";
import type { TooltipRow } from "./tooltip-content";

/**
 * Rows a container adds to the DEFAULT `ChartTooltip` for ink that is not a
 * registered series — `BarChart`'s `overlays` (a range, a median tick) and its
 * `comparison` column. Without them a chart drawn only in overlays (a range
 * plot) hovered to a box that named the row and listed nothing. Appended after
 * the measured series, before the analytics rows; a caller's own `rows` or
 * `content` renderer replaces all of it, as before.
 */
export type ChartTooltipExtraRows = (
  point: Record<string, unknown>,
  format: (value: number) => string,
) => TooltipRow[];

export const ChartTooltipExtraRowsContext = createContext<ChartTooltipExtraRows | null>(null);

export function useChartTooltipExtraRows(): ChartTooltipExtraRows | null {
  return useContext(ChartTooltipExtraRowsContext);
}
