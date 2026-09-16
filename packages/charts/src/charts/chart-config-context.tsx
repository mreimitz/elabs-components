"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

/**
 * Which interaction layers a chart mounts (RM-072) — the nebula.js
 * `Interactions` model a Qlik host hands a visualization.
 *
 * - `passive` — hover feedback: `ChartTooltip`, `ChartTooltipDot`.
 * - `active` — direct manipulation: `ChartBrush`, the `ChartDatapointLayer`
 *   keyboard targets.
 * - `select` — committing a datapoint: `onDatapointClick` /
 *   `copyValueOnActivate`. The layer stays; activation is a no-op.
 * - `edit` — reserved for an authoring host; no chart reads it yet.
 */
export interface ChartInteractions {
  passive?: boolean;
  active?: boolean;
  select?: boolean;
  edit?: boolean;
}

/**
 * How much chart furniture fits (RM-072). Families never measure text for
 * this — the host (a sheet tile) picks the tier from the cell size.
 *
 * - `xs` — no tick labels, no legend, no source row.
 * - `sm` — the category axis only, at most 4 ticks; legend hidden.
 * - `md` — today's furniture (default).
 * - `lg` — today's furniture, plus value labels where a family draws them.
 */
export type ChartDensity = "xs" | "sm" | "md" | "lg";

/** Tick ceiling for the one axis `density="sm"` keeps. */
export const CHART_DENSITY_SM_MAX_TICKS = 4;

/**
 * Keeps at most `CHART_DENSITY_SM_MAX_TICKS` evenly spaced entries (first and
 * last included) at `density="sm"`; returns `items` untouched otherwise.
 */
export function thinToDensity<T>(items: readonly T[], density: ChartDensity): T[] {
  const max = CHART_DENSITY_SM_MAX_TICKS;
  if (density !== "sm" || items.length <= max) {
    return items as T[];
  }
  const last = items.length - 1;
  return Array.from({ length: max }, (_, i) => items[Math.round((i * last) / (max - 1))] as T);
}

export interface ChartConfigValue {
  /** Crosshair indicator, tooltip dot, date pill. */
  tooltipSpring: SpringConfig;
  /** Floating tooltip panel. */
  tooltipBoxSpring: SpringConfig;
  /** Line/area hover-highlight band (x + width). */
  highlightSpring: SpringConfig;
  /**
   * ISO 4217 code used when a value is formatted as currency and the caller
   * (or `ChartSpec.currency`) names none. Deliberately NOT derived from the
   * locale — only the app knows which currency its numbers are in.
   */
  currency?: string;
  /** Resolved interaction switches (RM-072); every key is always present. */
  interactions: Required<ChartInteractions>;
  /** Furniture tier (RM-072). Default `"md"` — today's charts. */
  density: ChartDensity;
}

export const DEFAULT_CHART_INTERACTIONS: Required<ChartInteractions> = {
  passive: true,
  active: true,
  select: true,
  edit: false,
};

export const DEFAULT_CHART_CONFIG: ChartConfigValue = {
  tooltipSpring: { stiffness: 300, damping: 30 },
  tooltipBoxSpring: { stiffness: 100, damping: 20 },
  highlightSpring: { stiffness: 180, damping: 28 },
  interactions: DEFAULT_CHART_INTERACTIONS,
  density: "md",
};

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

export interface ChartConfigProviderProps {
  /**
   * Partial overrides. `interactions` may itself be partial — missing keys
   * keep their defaults (`edit: false`, the rest `true`).
   */
  value?: Partial<Omit<ChartConfigValue, "interactions">> & { interactions?: ChartInteractions };
  children: ReactNode;
}

export function ChartConfigProvider({ value, children }: ChartConfigProviderProps) {
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
      interactions: { ...DEFAULT_CHART_INTERACTIONS, ...value?.interactions },
      density: value?.density ?? DEFAULT_CHART_CONFIG.density,
    }),
    [value],
  );

  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}
