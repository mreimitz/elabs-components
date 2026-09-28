"use client";

// legend-hover.tsx — the legend-hover contexts.
//
// Three kinds of legend hover reach a chart's marks:
//
// - series — a container's own legend: the hovered series index and its
//   setter (`ChartLegendHoverProvider` / `useChartLegendHover`). Marks dim
//   every other series.
// - shared key — one legend above many plots: a faceted `AutoChart` hovers a
//   series `dataKey` (or a pie slice label) down to every panel
//   (`SharedLegendHoverProvider` / `useSharedLegendHoveredKey`). A container's
//   own legend hover always wins; the shared key applies only while the
//   container's own is empty.
// - profit/loss — `ProfitLossLegend`'s hovered sign entry
//   (`ProfitLossLegendHoverProvider` / `useProfitLossLegendHover`).
//
// Each kind is its own React context, made by one factory (`createHoverSlot`),
// so a hook subscribes to its own kind only: a change of one never re-renders
// a reader of another, and a provider needs nothing from the providers around
// it. Outside its provider each hook reports "nothing hovered".

import { createContext, type ReactNode, useContext, useMemo } from "react";

interface ChartLegendHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface ProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

/** One independent hover context: its provider and the hook that reads it. */
function createHoverSlot<T>(fallback: T) {
  const Context = createContext<T>(fallback);
  function useSlot(): T {
    return useContext(Context);
  }
  return { Provider: Context.Provider, useSlot };
}

// Marked pure so a bundle that reads one kind of hover drops the other two.
const SERIES_HOVER = /* @__PURE__ */ createHoverSlot<ChartLegendHoverContextValue>({
  hoveredIndex: null,
  setHoveredIndex: () => {
    /* noop outside ChartLegendHoverProvider */
  },
});

const SHARED_KEY_HOVER = /* @__PURE__ */ createHoverSlot<string | null>(null);

const PROFIT_LOSS_HOVER = /* @__PURE__ */ createHoverSlot<ProfitLossLegendHoverContextValue>({
  hoveredIndex: null,
});

export function ChartLegendHoverProvider({
  hoveredIndex,
  onHoverChange,
  children,
}: {
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
    [hoveredIndex, onHoverChange],
  );
  return <SERIES_HOVER.Provider value={value}>{children}</SERIES_HOVER.Provider>;
}

export function useChartLegendHover(): ChartLegendHoverContextValue {
  return SERIES_HOVER.useSlot();
}

/**
 * Carries the key a shared (grid-level) legend is hovering down to every
 * panel: a series `dataKey` for line/area/bar panels, a slice LABEL for pie
 * panels (pie slices are keyed by category, not series).
 */
export function SharedLegendHoverProvider({
  hoveredKey,
  children,
}: {
  hoveredKey: string | null;
  children: ReactNode;
}) {
  return <SHARED_KEY_HOVER.Provider value={hoveredKey}>{children}</SHARED_KEY_HOVER.Provider>;
}

/** The key a shared (grid-level) legend is hovering, or `null`. */
export function useSharedLegendHoveredKey(): string | null {
  return SHARED_KEY_HOVER.useSlot();
}

export function ProfitLossLegendHoverProvider({
  hoveredIndex,
  children,
}: {
  hoveredIndex: number | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ hoveredIndex }), [hoveredIndex]);
  return <PROFIT_LOSS_HOVER.Provider value={value}>{children}</PROFIT_LOSS_HOVER.Provider>;
}

export function useProfitLossLegendHover(): ProfitLossLegendHoverContextValue {
  return PROFIT_LOSS_HOVER.useSlot();
}
