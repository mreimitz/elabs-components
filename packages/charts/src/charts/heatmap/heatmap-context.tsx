"use client";

/**
 * heatmap-context.tsx — the public vocabulary of `HeatmapChart` and the one
 * context its sub-components read (RM-021).
 *
 * Same shape as `sankey-context.tsx`: the container computes the whole layout
 * once and publishes it; `HeatmapCell`, `HeatmapLegend` and `HeatmapTooltip`
 * read what they need instead of taking fifteen props each. The types are
 * exported because they are the chart's API — a consumer's `onDatapointClick`
 * handler and a custom highlight predicate are both written against them.
 */

import { createContext, type ReactNode, type RefObject, use } from "react";
import type { HeatmapBucket } from "./heatmap-scale";

/** How a cell encodes its value. */
export type HeatmapMode = "cell" | "dot";

/** Which grid the cells are laid onto. */
export type HeatmapVariant = "matrix" | "calendar";

/**
 * Which ordered ramp the values are drawn from — the ORDERED subset of
 * `ChartPalette`. `categorical` and `accent` are deliberately absent: they
 * answer "which series", and a heatmap has one series whose number IS the
 * colour.
 */
export type HeatmapPalette = "sequential" | "diverging" | "mono";

/** What an empty cell (`null`, or `0`) draws. */
export type HeatmapEmptyValue = "quiet" | "blank";

/**
 * Which cell gets the dashed `PeakRing`. A predicate receives the caller's own
 * row, so "the cell the caption is about" does not have to be the maximum.
 */
export type HeatmapHighlight = "max" | "none" | ((datum: Record<string, unknown>) => boolean);

/** One laid-out cell: the caller's row, plus everywhere it ended up. */
export interface HeatmapCellDatum {
  /** Stable id, unique within the chart (`"<column>:<row>"`). */
  id: string;
  /** The column (x) value. */
  x: string;
  /** The row (y) value. In `variant="calendar"` this is the weekday label. */
  y: string;
  /** The numeric value, or `null` for a missing/non-numeric one. */
  value: number | null;
  /** The caller's own data row. */
  datum: Record<string, unknown>;
  /** Index into the caller's `data` array. */
  index: number;
  /** Column index in the grid. */
  column: number;
  /** Row index in the grid. */
  row: number;
  /** Left edge of the cell's band box, in plot coordinates. */
  x0: number;
  /** Top edge of the cell's band box, in plot coordinates. */
  y0: number;
  /** Band box width. */
  width: number;
  /** Band box height. */
  height: number;
  /** The ramp step this value paints with; `null` when the cell is empty. */
  color: string | null;
  /**
   * Fill opacity. Always 1 on a stepped ramp; on a continuous one (`steps: 0`)
   * this is where the magnitude lives — see `continuousInk` for why a `var()`
   * ramp cannot be interpolated.
   */
  fillOpacity: number;
  /** Index into {@link HeatmapContextValue.buckets}; `-1` when empty. */
  bucketIndex: number;
  /** True when this is the cell the peak ring is drawn around. */
  isPeak: boolean;
  /** UTC midnight of the day, in `variant="calendar"`. `null` otherwise. */
  date: Date | null;
}

export interface HeatmapContextValue {
  /** Every laid-out cell, row-major. */
  cells: HeatmapCellDatum[];
  /** The countable legend steps, quietest first. */
  buckets: HeatmapBucket[];
  mode: HeatmapMode;
  variant: HeatmapVariant;
  emptyValue: HeatmapEmptyValue;
  /** Corner radius of a `mode="cell"` square, in px. */
  cellRadius: number;
  /** Whether every cell carries its value as `HaloText`. */
  showValues: boolean;
  /** Largest magnitude in the data — the denominator of the dot-area encoding. */
  maxAbs: number;
  /** Largest radius a dot may take, in px. */
  dotMaxRadius: number;
  /** Locale-aware value formatter (the caller's `valueFormat`). */
  formatValue: (value: number) => string;
  /** Formats a cell's column label for the tooltip / datapoint name. */
  formatColumnLabel: (cell: HeatmapCellDatum) => string;
  /**
   * Set the hovered cell. Lives on the STABLE context and never changes
   * identity — the hovered cell itself lives in {@link HeatmapHoverContextValue}
   * so that moving the pointer re-renders the tooltip and the hover outline,
   * not all 168 cells.
   */
  setHovered: (cell: HeatmapCellDatum | null) => void;
  /** Fires a cell's pointer activation into the chart interaction contract. */
  activateCell?: (cell: HeatmapCellDatum, event: React.MouseEvent) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  /** Rendered width/height of the plot body, in px. */
  width: number;
  height: number;
  /** Plot-area offset — cells are drawn inside a translated `<g>`. */
  margin: { top: number; right: number; bottom: number; left: number };
  /**
   * False while the enter animation is held (`revealOn="inView"`, not yet
   * scrolled to). Cells render at rest with no animation classes until it flips.
   */
  revealed: boolean;
  /** Per-cell stagger step in ms — `--t-chart-stagger-dot`, read once. */
  staggerMs: number;
  /**
   * `<pattern>` id for the diverging second channel, or `null` when it is not
   * needed. See `heatmap-chart.tsx` for why a diverging ramp cannot ship on
   * hue alone.
   */
  negativeHatchId: string | null;
}

/**
 * Hover state — the ONE slice that changes on every pointer move, kept in its
 * own context so a mousemove re-renders the tooltip and the hover outline and
 * nothing else. Folding it into {@link HeatmapContextValue} would give every
 * cell a new context value on every move, which is the classic way a 168-cell
 * grid becomes unresponsive while looking correct.
 */
export interface HeatmapHoverContextValue {
  /** The hovered cell, or `null`. */
  hovered: HeatmapCellDatum | null;
  /** Pointer position in container coordinates, for the tooltip. */
  pointer: { x: number; y: number } | null;
}

const HeatmapContext = createContext<HeatmapContextValue | null>(null);
const HeatmapHoverContext = createContext<HeatmapHoverContextValue>({
  hovered: null,
  pointer: null,
});

export function HeatmapProvider({
  children,
  hover,
  value,
}: {
  children: ReactNode;
  hover: HeatmapHoverContextValue;
  value: HeatmapContextValue;
}) {
  return (
    <HeatmapContext value={value}>
      <HeatmapHoverContext value={hover}>{children}</HeatmapHoverContext>
    </HeatmapContext>
  );
}

/** Read the heatmap layout. Throws outside a `HeatmapChart`. */
export function useHeatmap(): HeatmapContextValue {
  const context = use(HeatmapContext);
  if (!context) {
    throw new Error("useHeatmap must be used within a <HeatmapChart>.");
  }
  return context;
}

/** Read the hovered cell + pointer position. Safe outside a provider (all null). */
export function useHeatmapHover(): HeatmapHoverContextValue {
  return use(HeatmapHoverContext);
}
