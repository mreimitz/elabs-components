"use client";

// arc-chart-context.tsx — the one context shape `PieChart` and `RingChart`
// share: the fields both publish, the split stable/hover providers, the
// guarded hooks and the one default colour list. Each family extends the
// stable shape with its own geometry and keeps its public names
// (`PieProvider`/`usePie*`, `RingProvider`/`useRing*`).
//
// Internal: not exported from the package entry point.

import type { Transition } from "motion/react";
import { type Context, createContext, type RefObject, useContext, useMemo } from "react";
import { resolvePalette } from "./chart-context";

/**
 * Default arc colours: the categorical palette through `resolvePalette`
 * (RM-186), uncapped — both arc families have always cycled all twelve
 * series colours (`--chart-1` … `--chart-12`), so they ask for them
 * `explicit`ly. The one list both
 * families' public default colour arrays are copied from.
 */
export const defaultArcChartColors: string[] = resolvePalette("categorical", 12, {
  explicit: true,
});

export interface ArcChartHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

/** The stable fields every arc chart publishes. `Datum` is the family's row type. */
export interface ArcChartStableContextValue<Datum> {
  // Data
  data: Datum[];

  // Dimensions
  size: number;
  center: number;

  // Animation state
  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Computed values
  totalValue: number;

  // Get color for an item index
  getColor: (index: number) => string;

  /**
   * Studio geometry scrub — skip Motion path morphing and use plain SVG paths.
   * @default false
   */
  geometryScrubbing: boolean;
}

/** One family's pair of contexts, plus what its guards and providers need to know. */
export interface ArcChartContexts<Stable> {
  /** `"Pie"` / `"Ring"` — names the hooks, provider and container in guard errors. */
  family: string;
  /** Every stable key, so the stable slice is memoised on exactly those identities. */
  stableKeys: readonly (keyof Stable)[];
  stable: Context<Stable | null>;
  hover: Context<ArcChartHoverContextValue | null>;
}

/**
 * Lists `Stable`'s keys, and fails to compile when one is missing — the stable
 * slice copies exactly these, so a forgotten key would silently drop a field.
 */
export function arcChartStableKeys<Stable>() {
  return <const Keys extends readonly (keyof Stable)[]>(
    ...keys: [Exclude<keyof Stable, Keys[number]>] extends [never]
      ? Keys
      : [missing: Exclude<keyof Stable, Keys[number]>]
  ): readonly (keyof Stable)[] => keys as readonly (keyof Stable)[];
}

export function createArcChartContexts<Stable>(
  family: string,
  stableKeys: readonly (keyof Stable)[],
): ArcChartContexts<Stable> {
  return {
    family,
    stableKeys,
    stable: createContext<Stable | null>(null),
    hover: createContext<ArcChartHoverContextValue | null>(null),
  };
}

/**
 * Splits a family's merged value into its stable slice (memoised on every
 * stable field's identity, so hover never busts it) and its hover slice.
 */
export function useArcChartSlices<Stable>(
  contexts: ArcChartContexts<Stable>,
  value: Stable & ArcChartHoverContextValue,
): { stable: Stable; hover: ArcChartHoverContextValue } {
  const { stableKeys } = contexts;
  const stable = useMemo(
    () => {
      const slice = {} as Stable;
      for (const key of stableKeys) slice[key] = value[key];
      return slice;
    },
    // The key list is fixed per family, so the dependency list has a fixed length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    stableKeys.map((key) => value[key]),
  );
  const { hoveredIndex, setHoveredIndex } = value;
  const hover = useMemo(() => ({ hoveredIndex, setHoveredIndex }), [hoveredIndex, setHoveredIndex]);
  return { stable, hover };
}

function guardError(hook: string, family: string): Error {
  return new Error(
    `${hook} must be used within a ${family}Provider. ` +
      `Make sure your component is wrapped in <${family}Chart>.`,
  );
}

export function useArcChartStable<Stable>(contexts: ArcChartContexts<Stable>): Stable {
  const context = useContext(contexts.stable);
  if (!context) throw guardError(`use${contexts.family}Stable`, contexts.family);
  return context;
}

export function useArcChartHover<Stable>(
  contexts: ArcChartContexts<Stable>,
): ArcChartHoverContextValue {
  const context = useContext(contexts.hover);
  if (!context) throw guardError(`use${contexts.family}Hover`, contexts.family);
  return context;
}
