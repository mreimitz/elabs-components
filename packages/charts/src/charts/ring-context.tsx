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

// CSS variable references for ring chart theming
export const ringCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ringBackground: "var(--chart-ring-background)",
  // Default ring colors from chart palette (`--chart-1` … `--chart-12`)
  ring1: "var(--chart-1)",
  ring2: "var(--chart-2)",
  ring3: "var(--chart-3)",
  ring4: "var(--chart-4)",
  ring5: "var(--chart-5)",
  ring6: "var(--chart-6)",
  ring7: "var(--chart-7)",
  ring8: "var(--chart-8)",
  ring9: "var(--chart-9)",
  ring10: "var(--chart-10)",
  ring11: "var(--chart-11)",
  ring12: "var(--chart-12)",
};

/**
 * Default ring colours: the categorical palette, uncapped — all twelve
 * series colours (`--chart-1` … `--chart-12`). The same list as
 * `defaultPieColors`.
 */
export const defaultRingColors: string[] = defaultArcChartColors;

/**
 * A ring's drill-down target (#349). The hit box sits on the ring's arc at its
 * start angle, in the ring SVG's own coordinate space. Shared by `RingChart`
 * (keyboard target registration) and `Ring` (pointer click) so the two can
 * never disagree about which datum a ring is.
 */
export function ringDatapointTarget(
  index: number,
  ring: RingData,
  geometry: { center: number; innerRadius: number; outerRadius: number; startAngle: number },
): ChartDatapointTarget {
  const radius = (geometry.innerRadius + geometry.outerRadius) / 2;
  // Anchor a little way into the arc so the target sits ON the ring, not at the
  // exact 12 o'clock seam where every ring would overlap.
  const angle = geometry.startAngle + 0.35;
  return {
    id: `ring:${index}`,
    index,
    seriesIndex: 0,
    datum: ring as unknown as Record<string, unknown>,
    value: ring.value,
    category: ring.label,
    rect: padDatapointRect({
      x: geometry.center + Math.sin(angle) * radius,
      y: geometry.center - Math.cos(angle) * radius,
      width: 0,
      height: 0,
    }),
  };
}

export interface RingData {
  /** Display label for the ring */
  label: string;
  /** Current value */
  value: number;
  /** Maximum value (determines progress percentage) */
  maxValue: number;
  /** Optional color override - falls back to palette */
  color?: string;
}

export type RingHoverContextValue = ArcChartHoverContextValue;

export interface RingStableContextValue extends ArcChartStableContextValue<RingData> {
  // Dimensions
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;

  // Get ring radii for an index
  getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };

  // Arc angle range
  startAngle: number;
  endAngle: number;
}

export type RingContextValue = RingStableContextValue & RingHoverContextValue;

const RING_CONTEXTS = createArcChartContexts<RingStableContextValue>(
  "Ring",
  arcChartStableKeys<RingStableContextValue>()(
    "data",
    "size",
    "center",
    "strokeWidth",
    "ringGap",
    "baseInnerRadius",
    "animationKey",
    "isLoaded",
    "enterTransition",
    "enterStaggerScale",
    "containerRef",
    "totalValue",
    "getColor",
    "getRingRadii",
    "startAngle",
    "endAngle",
    "geometryScrubbing",
  ),
);

export function RingProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: RingContextValue;
}) {
  const { stable, hover } = useArcChartSlices(RING_CONTEXTS, value);
  return (
    <RING_CONTEXTS.stable.Provider value={stable}>
      <RING_CONTEXTS.hover.Provider value={hover}>{children}</RING_CONTEXTS.hover.Provider>
    </RING_CONTEXTS.stable.Provider>
  );
}

export function useRingStable(): RingStableContextValue {
  return useArcChartStable(RING_CONTEXTS);
}

export function useRingHover(): RingHoverContextValue {
  return useArcChartHover(RING_CONTEXTS);
}

export function useRing(): RingContextValue {
  return { ...useRingStable(), ...useRingHover() };
}

export default RING_CONTEXTS.stable;
