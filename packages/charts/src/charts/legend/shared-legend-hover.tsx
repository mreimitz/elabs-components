"use client";

/**
 * shared-legend-hover.tsx — one legend, many plots (#610).
 *
 * A faceted `AutoChart` draws ONE legend above a grid of panels, and each
 * panel is its own container (`LineChart`, `AreaChart`, `BarChart`,
 * `PieChart`) with its own legend-hover state. This context carries the key
 * the shared legend is hovering down to every panel, so each one dims its
 * other series (or slices) exactly as if its own legend were hovered.
 *
 * A container's OWN legend hover always wins; the shared key only applies
 * while the container's own is empty. Outside a provider the key is `null`
 * and nothing changes.
 *
 * Internal: not exported from the package entry point.
 */

import { createContext, type ReactNode, useContext } from "react";

/**
 * The hovered legend key: a series `dataKey` for line/area/bar panels, a
 * slice LABEL for pie panels (pie slices are keyed by category, not series).
 */
const SharedLegendHoverContext = createContext<string | null>(null);

export function SharedLegendHoverProvider({
  hoveredKey,
  children,
}: {
  hoveredKey: string | null;
  children: ReactNode;
}) {
  return (
    <SharedLegendHoverContext.Provider value={hoveredKey}>
      {children}
    </SharedLegendHoverContext.Provider>
  );
}

/** The key a shared (grid-level) legend is hovering, or `null`. */
export function useSharedLegendHoveredKey(): string | null {
  return useContext(SharedLegendHoverContext);
}
