"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  resolveResponsive,
  type ChartBreakpoint,
  type ChartHostPlotHeight,
  type Responsive,
} from "./chart-breakpoint";
import type { ChartHoverCategory } from "./chart-hover-link"; // Facet scope — RM-120

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

/**
 * Which interaction layers a chart mounts (RM-072) — the nebula.js
 * `Interactions` model a Qlik host hands a visualization.
 *
 * - `passive` — hover feedback: `ChartTooltip`, `ChartTooltipDot`, every
 *   hand-mounted `ChartTooltipBox`, the Gantt bar tooltips and the `Sparkline`
 *   readout (RM-167).
 * - `active` — direct manipulation: `ChartBrush`, the `ChartDatapointLayer`
 *   keyboard targets, the navigator strip's handles and drag, pinch / wheel /
 *   keyboard zoom and its controls, pan and zoom on the density scatter, the
 *   choropleth and the tree, node drag, Gantt bar drag and keyboard edits, and
 *   the selection gestures (RM-167).
 * - `select` — committing a datapoint: `onDatapointClick` /
 *   `copyValueOnActivate`, and a selection gesture's intent. The layer stays;
 *   activation is a no-op.
 * - `edit` — reserved for an authoring host; no chart reads it yet.
 *
 * Every gesture owner reads the policy through {@link useChartInteractionPolicy}.
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
  /**
   * Forces the plot height of every chart inside, over each chart's own
   * `plotHeight`/`aspectRatio` (ADR 0039 §3 rung 0): px, `{ aspect }`, or
   * `"fill"` — the full height of a parent whose height is definite (an expand
   * view), the chart's own size where it is not. A fixed `size` (pie, ring,
   * radar) still wins. Nested providers inherit it unless they set their own.
   * Unset: each chart sizes itself.
   */
  plotHeight?: ChartHostPlotHeight;
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
  // A host's forced plot height reaches through a story's or an app's own
  // provider (set for interactions, say) — an expand view must not be undone.
  const outerPlotHeight = useContext(ChartConfigContext)?.plotHeight;
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
      interactions: { ...DEFAULT_CHART_INTERACTIONS, ...value?.interactions },
      // A per-breakpoint density resolves to its `base` (wide) outside a
      // container; the container's breakpoint scope re-resolves it.
      density: densityBase(value?.density ?? DEFAULT_CHART_CONFIG.density),
      densityByBreakpoint: value?.density ?? DEFAULT_CHART_CONFIG.density,
      plotHeight: value?.plotHeight ?? outerPlotHeight,
    }),
    [value, outerPlotHeight],
  );

  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

function densityBase(density: Responsive<ChartDensity>): ChartDensity {
  // The wide tier resolves to `base`: the value outside any measured chart.
  return resolveResponsive(density, "wide");
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

/**
 * The host's resolved interaction switches (RM-167): every key present,
 * `{ passive: true, active: true, select: true, edit: false }` outside a
 * provider. A gesture owner (hover readout, drag, wheel, pinch, keyboard zoom,
 * a selecting click) reads this and stands down when its layer is off.
 */
export function useChartInteractionPolicy(): Required<ChartInteractions> {
  return useChartConfig().interactions;
}

// Facet scope — RM-120

/**
 * What a `ChartMultiples` panel hands the chart inside it (RM-120). A chart
 * container reads it through {@link useChartFacetScope}; outside a panel it is
 * `null` and nothing changes. Every field is a DEFAULT — the child's own
 * explicit prop (`YAxis domain`, `hoverCategory`, …) always wins.
 */
export interface ChartFacetScopeValue {
  /** The panel's key (the facet value). */
  panelKey: string;
  /** 0-based grid position and grid size of the panel. */
  column: number;
  row: number;
  columns: number;
  rows: number;
  /** No panel below this one in its column (the bottom row of an incomplete grid included). */
  bottom: boolean;
  /** Shared y: only the outer column paints value-axis labels (first for a left axis, last for a right one). */
  sharedY: boolean;
  /** Shared x: only the bottom panel of each column paints category-axis labels. */
  sharedX: boolean;
  /** The primary value axis' domain for this panel (shared, or range-rounded). */
  yDomain?: [number, number];
  /** Explicit value ticks (range rounding): gridlines land on the same rows in every panel. */
  yTicks?: number[];
  /** The x extent every panel shares (time x only), when the panels' own extents differ. */
  xDomain?: [Date, Date];
  /** Row key drawn as a muted baseline series behind the panel's own series. */
  baselineKey?: string;
  /** Stroke style of that baseline. Default `"solid"`. */
  baselineStyle?: "solid" | "dashed" | "dotted";
  /** Synced hover: the category hovered in ANY panel, `null` when none. Unset → not synced. */
  hoverCategory?: ChartHoverCategory;
  /** Reports this panel's hovered category (move → category, leave → `null`). */
  onHoverCategory?: (category: ChartHoverCategory) => void;
}

const ChartFacetScopeContext = createContext<ChartFacetScopeValue | null>(null);

/** Internal: mounted by `ChartMultiples` around each panel's chart. */
export function ChartFacetScopeProvider({
  value,
  children,
}: {
  value: ChartFacetScopeValue;
  children?: ReactNode;
}) {
  return (
    <ChartFacetScopeContext.Provider value={value}>{children}</ChartFacetScopeContext.Provider>
  );
}

/** The enclosing `ChartMultiples` panel's scope, or `null` outside one. */
export function useChartFacetScope(): ChartFacetScopeValue | null {
  return useContext(ChartFacetScopeContext);
}
