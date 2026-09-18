"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { ChartBreakpoint, Responsive } from "./chart-breakpoint";

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
 *
 * ADR 0039: inside a `narrow` chart container a host `md`/`lg` becomes `sm`,
 * unless the host density is a `Responsive` value with an explicit `narrow`.
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
  /**
   * Forces the container breakpoint (ADR 0039) for every chart inside —
   * stories, fixed-width export, thumbnails, tests. Unset: each chart measures.
   */
  breakpoint?: ChartBreakpoint;
  /**
   * The host's density as given, possibly per breakpoint (ADR 0039); `density`
   * is its resolution for the current scope. Set by `ChartConfigProvider`.
   */
  densityByBreakpoint?: Responsive<ChartDensity>;
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
  value?: Partial<Omit<ChartConfigValue, "interactions" | "density" | "densityByBreakpoint">> & {
    interactions?: ChartInteractions;
    /**
     * Furniture tier, optionally per breakpoint. An explicit `narrow` entry
     * (`{ base: "md", narrow: "md" }`) keeps the legend and value axis on a
     * narrow chart — the per-chart escape hatch from the narrow → `sm` coupling.
     */
    density?: Responsive<ChartDensity>;
  };
  children: ReactNode;
}

export function ChartConfigProvider({ value, children }: ChartConfigProviderProps) {
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
      interactions: { ...DEFAULT_CHART_INTERACTIONS, ...value?.interactions },
      // A per-breakpoint density resolves to its `base` (wide) outside a
      // container; the container's breakpoint scope re-resolves it.
      density: densityBase(value?.density ?? DEFAULT_CHART_CONFIG.density),
      densityByBreakpoint: value?.density ?? DEFAULT_CHART_CONFIG.density,
    }),
    [value],
  );

  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

function densityBase(density: Responsive<ChartDensity>): ChartDensity {
  return typeof density === "object" ? density.base : density;
}

/**
 * Internal: provides an already-resolved config (a breakpoint scope) without
 * re-merging, so the host's per-breakpoint density survives nested scopes.
 */
export function ChartConfigValueProvider({
  value,
  children,
}: {
  value: ChartConfigValue;
  children?: ReactNode;
}) {
  return <ChartConfigContext.Provider value={value}>{children}</ChartConfigContext.Provider>;
}

export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}
