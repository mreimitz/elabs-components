"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * The streamgraph stack context `AreaChart` mounts around its body and every
 * `Area` reads. Lives in its own module, not in `area.tsx`: the time-series
 * shell every cartesian chart renders through asks `useAreaStacked()`, and
 * importing `area.tsx` from there would ship Area's part definition in a
 * BarChart-only bundle (`check-chart-treeshake.mjs`, ADR 0042 §11). `area.tsx`
 * re-exports the public pieces, so existing imports keep working.
 */

/**
 * Streamgraph baseline (`AreaChart offset`, RM-029) → `d3-shape`'s
 * `stackOffsetNone` (classic zero-baseline stack) / `Silhouette` (centered —
 * lieflat F16's "Stream Ribbon") / `Wiggle` (minimal-wiggle streamgraph) /
 * `Expand` (normalized to a 0–1 band per index, i.e. a 100% stacked area).
 */
export type AreaStackOffset = "none" | "silhouette" | "wiggle" | "expand";

export interface AreaStackConfig {
  offset: AreaStackOffset;
  seams: number;
  labelBands: boolean;
}

const AreaStackContext = createContext<AreaStackConfig | undefined>(undefined);

export interface AreaStackProviderProps {
  /** Streamgraph baseline. Unset (default) = no stacking — today's independent, overlapping areas. */
  offset?: AreaStackOffset;
  /** Paper gap (`--chart-background` stroke) drawn between bands, in px. Default 0. */
  seams?: number;
  /** Label each band with its series name at its widest x. Default false. */
  labelBands?: boolean;
  children: ReactNode;
}

/**
 * Wraps the chart body so every `Area` can read the streamgraph config without
 * being cloned or itself wrapped. `AreaChart` mounts this OUTSIDE
 * `TimeSeriesChartInner` (around it, not around `children`), so
 * `Children.forEach`'s series/def/axis classification in
 * `time-series-chart-shell.tsx` still walks the caller's original children
 * untouched — a `<Grid>`/`<XAxis>` sibling keeps its normal clip-exclusion.
 */
export function AreaStackProvider({
  offset,
  seams = 0,
  labelBands = false,
  children,
}: AreaStackProviderProps) {
  const value = useMemo<AreaStackConfig | undefined>(
    () => (offset ? { offset, seams, labelBands } : undefined),
    [offset, seams, labelBands],
  );
  return <AreaStackContext.Provider value={value}>{children}</AreaStackContext.Provider>;
}

export function useAreaStackConfig(): AreaStackConfig | undefined {
  return useContext(AreaStackContext);
}

// Labels — RM-110
/**
 * True inside a stacked `AreaChart` (`offset` set). Stacked bands name
 * themselves through `labelBands`; the label engine positions end/value labels
 * from RAW values, so it leaves stacked areas alone.
 */
export function useAreaStacked(): boolean {
  return useAreaStackConfig() !== undefined;
}
