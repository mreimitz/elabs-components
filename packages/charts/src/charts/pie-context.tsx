"use client";

import type { ReactNode } from "react";
import {
  type ArcChartHoverContextValue,
  type ArcChartStableContextValue,
  arcChartStableKeys,
  createArcChartContexts,
  defaultArcChartColors,
  useArcChartHover,
  useArcChartSlices,
  useArcChartStable,
} from "./arc-chart-context";
import { type ChartDatapointTarget, padDatapointRect } from "./chart-datapoint-layer";

// CSS variable references for pie chart theming
export const pieCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  // Default slice colors from chart palette (`--chart-1` … `--chart-12`)
  slice1: "var(--chart-1)",
  slice2: "var(--chart-2)",
  slice3: "var(--chart-3)",
  slice4: "var(--chart-4)",
  slice5: "var(--chart-5)",
  slice6: "var(--chart-6)",
  slice7: "var(--chart-7)",
  slice8: "var(--chart-8)",
  slice9: "var(--chart-9)",
  slice10: "var(--chart-10)",
  slice11: "var(--chart-11)",
  slice12: "var(--chart-12)",
};

/**
 * Default slice colours: the categorical palette, uncapped — all twelve
 * series colours (`--chart-1` … `--chart-12`). Same contents as
 * `defaultRingColors`, in its own array.
 */
export const defaultPieColors: string[] = [...defaultArcChartColors];

export interface PieData {
  /** Display label for the slice */
  label: string;
  /** Value for the slice (determines slice size relative to total) */
  value: number;
  /** Optional color override - falls back to palette */
  color?: string;
  /** Optional fill override for patterns/gradients (e.g., "url(#patternId)") */
  fill?: string;
  /**
   * The original category labels folded into this slice by `groupSmall`
   * (RM-114, `pie-grouping.ts`) — set ONLY on a synthesized "Other" slice.
   * Carried through to the DOM (`PieSlice`'s `data-folded-categories`) so the
   * fold stays inspectable/testable; unset on every ordinary slice, today's
   * behavior.
   */
  categories?: string[];
}

/** Arc data computed by visx Pie */
export interface PieArcData {
  data: PieData;
  index: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  value: number;
}

/**
 * A slice's drill-down target (#349). The hit box is a square centred on the
 * arc's centroid, in the pie SVG's own coordinate space (which the layer is
 * positioned over). Shared by `PieChart` (which registers every slice as a
 * keyboard target) and `PieSlice` (whose hitbox path carries the pointer
 * click) so the two can never disagree about which datum a slice is.
 */
export function pieDatapointTarget(
  arc: PieArcData,
  geometry: { center: number; innerRadius: number; outerRadius: number },
): ChartDatapointTarget {
  const midAngle = (arc.startAngle + arc.endAngle) / 2;
  const radius = (geometry.innerRadius + geometry.outerRadius) / 2;
  // d3-shape puts 0 rad at 12 o'clock and increases clockwise.
  const centroidX = geometry.center + Math.sin(midAngle) * radius;
  const centroidY = geometry.center - Math.cos(midAngle) * radius;
  return {
    id: `slice:${arc.index}`,
    index: arc.index,
    seriesIndex: 0,
    datum: arc.data as unknown as Record<string, unknown>,
    value: arc.value,
    category: arc.data.label,
    rect: padDatapointRect({ x: centroidX, y: centroidY, width: 0, height: 0 }),
  };
}

export type PieHoverContextValue = ArcChartHoverContextValue;

export interface PieStableContextValue extends ArcChartStableContextValue<PieData> {
  arcs: PieArcData[];

  // Dimensions
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;

  // Hover effect
  hoverOffset: number;

  // Get fill for a slice index (supports patterns/gradients)
  getFill: (index: number) => string;

  /** Precomputed slice paths during geometry scrub (one per arc). */
  scrubSlicePaths: readonly string[] | null;

  /** The chart's own `locale` (RM-187) for centre text; unset, the `LocaleProvider`'s. */
  locale?: string;
}

export type PieContextValue = PieStableContextValue & PieHoverContextValue;

const PIE_CONTEXTS = createArcChartContexts<PieStableContextValue>(
  "Pie",
  arcChartStableKeys<PieStableContextValue>()(
    "data",
    "arcs",
    "size",
    "center",
    "outerRadius",
    "innerRadius",
    "padAngle",
    "cornerRadius",
    "hoverOffset",
    "animationKey",
    "isLoaded",
    "enterTransition",
    "enterStaggerScale",
    "containerRef",
    "totalValue",
    "getColor",
    "getFill",
    "geometryScrubbing",
    "scrubSlicePaths",
    "locale",
  ),
);

export function PieProvider({ children, value }: { children: ReactNode; value: PieContextValue }) {
  const { stable, hover } = useArcChartSlices(PIE_CONTEXTS, value);
  return (
    <PIE_CONTEXTS.stable.Provider value={stable}>
      <PIE_CONTEXTS.hover.Provider value={hover}>{children}</PIE_CONTEXTS.hover.Provider>
    </PIE_CONTEXTS.stable.Provider>
  );
}

export function usePieStable(): PieStableContextValue {
  return useArcChartStable(PIE_CONTEXTS);
}

export function usePieHover(): PieHoverContextValue {
  return useArcChartHover(PIE_CONTEXTS);
}

export function usePie(): PieContextValue {
  return { ...usePieStable(), ...usePieHover() };
}

export default PIE_CONTEXTS.stable;
