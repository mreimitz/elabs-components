"use client";

/**
 * legend-hover.tsx — the one legend-hover context.
 *
 * Three kinds of legend hover reach a chart's marks, each in its own slot so
 * they never overwrite one another:
 *
 * - `series` — a container's own legend: the hovered series index and its
 *   setter (`ChartLegendHoverProvider` / `useChartLegendHover`). Marks dim
 *   every other series.
 * - `sharedKey` — one legend above many plots (#610): a faceted `AutoChart`
 *   hovers a series `dataKey` (or a pie slice label) down to every panel
 *   (`SharedLegendHoverProvider` / `useSharedLegendHoveredKey`). A
 *   container's own legend hover always wins; the shared key applies only
 *   while the container's own is empty.
 * - `profitLoss` — `ProfitLossLegend`'s hovered sign entry
 *   (`ProfitLossLegendHoverProvider` / `useProfitLossLegendHover`).
 *
 * A provider sets only its own slot and passes the others through from the
 * nearest outer provider, so nesting behaves exactly as three independent
 * contexts would. Outside every provider each hook reports "nothing hovered".
 */

import { createContext, type ReactNode, useContext, useMemo } from "react";

interface ChartLegendHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface ProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

interface LegendHoverState {
  series: ChartLegendHoverContextValue | null;
  sharedKey: string | null;
  profitLoss: ProfitLossLegendHoverContextValue | null;
}

const NOTHING_HOVERED: LegendHoverState = { series: null, sharedKey: null, profitLoss: null };

const LegendHoverContext = createContext<LegendHoverState>(NOTHING_HOVERED);

const NO_SERIES_HOVER: ChartLegendHoverContextValue = {
  hoveredIndex: null,
  setHoveredIndex: () => {
    /* noop outside ChartLegendHoverProvider */
  },
};

const NO_PROFIT_LOSS_HOVER: ProfitLossLegendHoverContextValue = { hoveredIndex: null };

export function ChartLegendHoverProvider({
  hoveredIndex,
  onHoverChange,
  children,
}: {
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  children: ReactNode;
}) {
  const outer = useContext(LegendHoverContext);
  const value = useMemo(
    () => ({ ...outer, series: { hoveredIndex, setHoveredIndex: onHoverChange } }),
    [outer, hoveredIndex, onHoverChange],
  );
  return <LegendHoverContext.Provider value={value}>{children}</LegendHoverContext.Provider>;
}

export function useChartLegendHover(): ChartLegendHoverContextValue {
  return useContext(LegendHoverContext).series ?? NO_SERIES_HOVER;
}

/**
 * Carries the key a shared (grid-level) legend is hovering down to every
 * panel: a series `dataKey` for line/area/bar panels, a slice LABEL for pie
 * panels (pie slices are keyed by category, not series).
 *
 * Internal: not exported from the package entry point.
 */
export function SharedLegendHoverProvider({
  hoveredKey,
  children,
}: {
  hoveredKey: string | null;
  children: ReactNode;
}) {
  const outer = useContext(LegendHoverContext);
  const value = useMemo(() => ({ ...outer, sharedKey: hoveredKey }), [outer, hoveredKey]);
  return <LegendHoverContext.Provider value={value}>{children}</LegendHoverContext.Provider>;
}

/** The key a shared (grid-level) legend is hovering, or `null`. Internal. */
export function useSharedLegendHoveredKey(): string | null {
  return useContext(LegendHoverContext).sharedKey;
}

export function ProfitLossLegendHoverProvider({
  hoveredIndex,
  children,
}: {
  hoveredIndex: number | null;
  children: ReactNode;
}) {
  const outer = useContext(LegendHoverContext);
  const value = useMemo(() => ({ ...outer, profitLoss: { hoveredIndex } }), [outer, hoveredIndex]);
  return <LegendHoverContext.Provider value={value}>{children}</LegendHoverContext.Provider>;
}

export function useProfitLossLegendHover(): ProfitLossLegendHoverContextValue {
  return useContext(LegendHoverContext).profitLoss ?? NO_PROFIT_LOSS_HOVER;
}
