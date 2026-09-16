"use client";

/**
 * Shared-crosshair input (RM-073, #437) — Grafana's "shared tooltip" across
 * sibling charts. `ChartLegendHoverProvider` links legend ↔ marks INSIDE one
 * chart; this links the hovered CATEGORY across charts: a host lifts
 * `hoverCategory` into its own state, feeds it back into every sibling, and each
 * chart with a category/time axis draws its tooltip indicator at that category —
 * without the tooltip box, which stays reserved for the chart the pointer is in.
 *
 * With neither prop set nothing mounts and the DOM is unchanged.
 */

import { createContext, createElement, type ReactNode, use, useEffect, useRef } from "react";

import { chartCssVars, useChart } from "./chart-context";
import type { ChartSelectionCategory } from "./chart-selection";
import { ChartTooltipIndicator } from "./tooltip/tooltip-indicator";

/** A hovered category, or `null` when nothing is hovered. */
export type ChartHoverCategory = ChartSelectionCategory | null;

/** Shared-hover props every family with a category/time axis accepts. */
export interface ChartHoverLinkProps {
  /** The category hovered in a SIBLING chart (or by the host). `null`/unset → none. */
  hoverCategory?: ChartHoverCategory;
  /** Fires with the category under the pointer on move, and `null` on leave. */
  onHoverCategory?: (category: ChartHoverCategory) => void;
}

/** Category equality that treats two `Date`s at the same instant as equal. */
export function sameChartCategory(
  a: ChartHoverCategory | undefined,
  b: ChartHoverCategory | undefined,
): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : a;
    const bt = b instanceof Date ? b.getTime() : b;
    return at === bt;
  }
  return a === b;
}

/**
 * Index of the row whose category equals `category`, or `-1`. The shared
 * crosshair helper: a family maps the external category to the row its own
 * tooltip indicator already knows how to draw.
 */
export function findChartCategoryIndex<TRow>(
  rows: readonly TRow[],
  accessor: (row: TRow) => ChartHoverCategory | undefined,
  category: ChartHoverCategory | undefined,
): number {
  if (category === null || category === undefined) return -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (sameChartCategory(accessor(rows[i] as TRow), category)) return i;
  }
  return -1;
}

// ── Context seam ─────────────────────────────────────────────────────────────

const ChartHoverLinkContext = createContext<ChartHoverLinkProps | null>(null);

export interface ChartHoverLinkProviderProps extends ChartHoverLinkProps {
  children: ReactNode;
}

/** Mounted by a family only when either hover-link prop is set. */
export function ChartHoverLinkProvider({
  children,
  hoverCategory,
  onHoverCategory,
}: ChartHoverLinkProviderProps) {
  if (hoverCategory === undefined && onHoverCategory === undefined) return children;
  return createElement(
    ChartHoverLinkContext,
    { value: { hoverCategory, onHoverCategory } },
    children,
  );
}

/** The nearest family's hover-link props, or `null` when unlinked. */
export function useChartHoverLink(): ChartHoverLinkProps | null {
  return use(ChartHoverLinkContext);
}

// ── Shared crosshair (time-series shell families) ────────────────────────────

/**
 * The category a time-series row stands for: the caller's own x label on a
 * band/linear axis (#352 — the positional instant is synthetic), the `Date` on a
 * time axis.
 */
function rowCategory(
  chart: ReturnType<typeof useChart>,
  index: number,
): ChartSelectionCategory | undefined {
  const row = chart.data[index];
  if (!row) return undefined;
  if (chart.xScaleType != null && chart.xScaleType !== "time") {
    return chart.dateLabels[index];
  }
  return chart.xAccessor(row);
}

/**
 * SVG child a time-series family (`LineChart`, `AreaChart`, `ComposedChart`)
 * appends to its body. Reports the pointer's category through
 * `onHoverCategory` (move → category, leave → `null`) and, while the pointer is
 * NOT in this chart, draws the tooltip indicator at the external
 * `hoverCategory` — never the tooltip box. Renders nothing when unlinked.
 */
export function ChartHoverLinkIndicator() {
  const link = useChartHoverLink();
  const chart = useChart();
  const hoveredIndex = chart.tooltipData?.index ?? null;
  const onHoverCategory = link?.onHoverCategory;
  const lastReported = useRef<ChartHoverCategory | undefined>(undefined);

  useEffect(() => {
    if (!onHoverCategory) return;
    const next = hoveredIndex === null ? null : (rowCategory(chart, hoveredIndex) ?? null);
    // Never report the initial "nothing hovered" — only transitions.
    if (lastReported.current === undefined && next === null) return;
    if (lastReported.current !== undefined && sameChartCategory(lastReported.current, next)) {
      return;
    }
    lastReported.current = next;
    onHoverCategory(next);
    // `chart` is read for the row lookup only; the index is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- index is the trigger
  }, [hoveredIndex, onHoverCategory]);

  if (!link || hoveredIndex !== null) return null;
  const index = findChartCategoryIndex(
    chart.data.map((_, i) => i),
    (i) => rowCategory(chart, i),
    link.hoverCategory,
  );
  if (index < 0) return null;
  const row = chart.data[index] as Record<string, unknown>;
  const x = chart.xScale(chart.xAccessor(row)) ?? 0;
  return createElement(
    "g",
    {
      "aria-hidden": true,
      "data-category-index": index,
      "data-slot": "chart-hover-link-indicator",
      pointerEvents: "none",
    },
    createElement(ChartTooltipIndicator, {
      animate: false,
      colorEdge: chartCssVars.crosshair,
      colorMid: chartCssVars.crosshair,
      fadeEdges: true,
      height: chart.innerHeight,
      visible: true,
      width: "line",
      x,
    }),
  );
}
