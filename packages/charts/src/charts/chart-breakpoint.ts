"use client";

/**
 * The responsive chart contract (ADR 0039, RM-107).
 *
 * - Three container tiers, measured on the chart's OWN width, never the
 *   viewport: `narrow` (< 480 px), `medium` (< 768 px), `wide`.
 * - `Responsive<T>`: one value, or `{ base, medium?, narrow? }` — desktop-first,
 *   an override applies at its tier and every narrower tier that sets nothing.
 * - `plotHeight`: the height of the drawing (the `<svg>` box) only; title,
 *   legend, notes and source row stack around it.
 * - Fonts never scale. At `narrow` a host density of `md`/`lg` becomes `sm`
 *   (legend + value axis hidden, 4-tick ceiling) unless the host's density is
 *   a `Responsive` value with an explicit `narrow` entry.
 */

import {
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  type ChartConfigValue,
  type ChartDensity,
  ChartConfigValueProvider,
  useChartConfig,
} from "./chart-config-context";

// ── Tiers ────────────────────────────────────────────────────────────────────

/** A chart container's width tier (ADR 0039). */
export type ChartBreakpoint = "narrow" | "medium" | "wide";

/** Every tier, narrowest first. */
export const CHART_BREAKPOINTS: readonly ChartBreakpoint[] = ["narrow", "medium", "wide"];

/**
 * A width (CSS px) below `narrow` is narrow; below `medium` is medium; anything
 * else is wide. A boundary belongs to the wider tier (480 → medium, 768 → wide).
 */
export const CHART_BREAKPOINT_THRESHOLDS = { narrow: 480, medium: 768 } as const;

/**
 * The tier for a measured container width. A width that is `0` or not finite
 * means "not measured yet" (server render, first measure pass, `display:none`)
 * and resolves to `wide`, so a first paint matches the pre-ADR-0039 layout.
 */
export function breakpointForWidth(width: number): ChartBreakpoint {
  if (!Number.isFinite(width) || width <= 0) return "wide";
  if (width < CHART_BREAKPOINT_THRESHOLDS.narrow) return "narrow";
  if (width < CHART_BREAKPOINT_THRESHOLDS.medium) return "medium";
  return "wide";
}

// ── Responsive<T> ────────────────────────────────────────────────────────────

/**
 * Per-tier values, desktop-first. NOTE: `base` is the WIDE value (the opposite
 * of Tailwind's unprefixed, mobile-first class); overrides go down.
 */
export interface ResponsiveByBreakpoint<T> {
  /** The value at `wide`, and the fallback for every tier that sets nothing. */
  base: T;
  /** At `medium` — and at `narrow` too, unless `narrow` is set. */
  medium?: T;
  /** At `narrow` only. */
  narrow?: T;
}

/**
 * One value for every tier, or per-tier values. `T` must never be an object
 * type with its own `base` key (that key marks the per-tier form). Read a
 * `Responsive` prop only through {@link resolveResponsive} /
 * {@link useResponsiveValue} — `pnpm check --rule charts-responsive`.
 */
export type Responsive<T> = T | ResponsiveByBreakpoint<T>;

/** True for the per-tier form: a plain object with its own `base` key. */
export function isResponsiveByBreakpoint<T>(
  value: Responsive<T>,
): value is ResponsiveByBreakpoint<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "base")
  );
}

/**
 * The value for `breakpoint`: `wide` → `base`; `medium` → `medium ?? base`;
 * `narrow` → `narrow ?? medium ?? base`. "Not set" means `undefined` (`null`
 * is a real value). A plain `T` is returned at every tier.
 */
export function resolveResponsive<T>(value: Responsive<T>, breakpoint: ChartBreakpoint): T {
  if (!isResponsiveByBreakpoint(value)) return value as T;
  if (breakpoint === "wide") return value.base;
  if (breakpoint === "narrow" && value.narrow !== undefined) return value.narrow;
  return value.medium !== undefined ? value.medium : value.base;
}

// ── Density coupling ─────────────────────────────────────────────────────────

/**
 * The density a scope at `breakpoint` applies. At `narrow`, `md`/`lg` become
 * `sm` (legend and value axis hidden, ≤ 4 ticks) — unless the host density is a
 * `Responsive` value with an explicit `narrow` entry, the per-chart escape
 * hatch. A wider tier never raises a host `xs`/`sm`.
 */
export function resolveDensityForBreakpoint(
  density: Responsive<ChartDensity>,
  breakpoint: ChartBreakpoint,
): ChartDensity {
  const resolved = resolveResponsive(density, breakpoint);
  if (breakpoint !== "narrow") return resolved;
  if (isResponsiveByBreakpoint(density) && density.narrow !== undefined) return resolved;
  return resolved === "md" || resolved === "lg" ? "sm" : resolved;
}

// ── Scope + hooks ────────────────────────────────────────────────────────────

const ChartBreakpointContext = createContext<ChartBreakpoint | null>(null);

/**
 * The tier of the nearest chart container (or `ChartFrame`); else the host-
 * forced `ChartConfigProvider value={{ breakpoint }}`; else `wide`.
 */
export function useChartBreakpoint(): ChartBreakpoint {
  const scoped = useContext(ChartBreakpointContext);
  const { breakpoint } = useChartConfig();
  return scoped ?? breakpoint ?? "wide";
}

/** `resolveResponsive(value, useChartBreakpoint())`. */
export function useResponsiveValue<T>(value: Responsive<T>): T {
  return resolveResponsive(value, useChartBreakpoint());
}

export interface ChartBreakpointScopeProps {
  breakpoint: ChartBreakpoint;
  children?: ReactNode;
}

/**
 * Publishes `breakpoint` to everything inside and applies the narrow density
 * coupling to the chart config, so existing density readers (axes, legends)
 * follow without change. Internal — rendered by containers and `ChartFrame`.
 */
export function ChartBreakpointScope({ breakpoint, children }: ChartBreakpointScopeProps) {
  const config = useChartConfig();
  const density = resolveDensityForBreakpoint(
    config.densityByBreakpoint ?? config.density,
    breakpoint,
  );
  const value = useMemo<ChartConfigValue>(
    () => (density === config.density ? config : { ...config, density }),
    [config, density],
  );
  return createElement(
    ChartBreakpointContext.Provider,
    { value: breakpoint },
    createElement(ChartConfigValueProvider, { value }, children),
  );
}

function assignRef<T>(ref: ForwardedRef<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

/**
 * Measures `ref`'s element with a `ResizeObserver` and returns its tier (the
 * host-forced tier wins). Re-renders only when the TIER changes.
 */
export function useMeasuredChartBreakpoint<E extends Element = HTMLDivElement>(
  forwardedRef?: ForwardedRef<E>,
): { ref: (node: E | null) => void; breakpoint: ChartBreakpoint } {
  const { breakpoint: forced } = useChartConfig();
  const [node, setNode] = useState<E | null>(null);
  const [measured, setMeasured] = useState<ChartBreakpoint>("wide");

  const ref = useCallback(
    (next: E | null) => {
      setNode(next);
      assignRef(forwardedRef, next);
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    if (!node) return undefined;
    const update = (width: number) => {
      const next = breakpointForWidth(width);
      setMeasured((prev) => (prev === next ? prev : next));
    };
    update(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, breakpoint: forced ?? measured };
}

// ── Plot height ──────────────────────────────────────────────────────────────

/** CSS px, or the plot's width ÷ height (`{ aspect: 2 }` = twice as wide as tall). */
export type ChartPlotHeight = number | { aspect: number };

/** The default for families whose box was `2 / 1`: 2 : 1, and 1.25 : 1 at `narrow`. */
export const DEFAULT_CHART_PLOT_HEIGHT: ResponsiveByBreakpoint<ChartPlotHeight> = {
  base: { aspect: 2 },
  narrow: { aspect: 1.25 },
};

/** What an enclosing `ChartFrame` hands its chart: a plot height, or "fill the body". */
export type ChartFramePlotHeight = Responsive<ChartPlotHeight> | "fill";

const ChartFramePlotHeightContext = createContext<ChartFramePlotHeight | undefined>(undefined);

/** Internal: `ChartFrame` → its chart (ADR 0039 §3, precedence rung 4). */
export function ChartFramePlotHeightProvider({
  value,
  children,
}: {
  value: ChartFramePlotHeight | undefined;
  children?: ReactNode;
}) {
  return createElement(ChartFramePlotHeightContext.Provider, { value }, children);
}

const warned = new Set<string>();

/** Dev-only `console.warn`, once per `key` per page load. */
export function warnChartOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

function validPlotHeight(value: unknown): ChartPlotHeight | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "object" && value !== null && "aspect" in value) {
    const aspect = (value as { aspect: unknown }).aspect;
    if (typeof aspect === "number" && Number.isFinite(aspect) && aspect > 0) {
      return { aspect };
    }
  }
  warnChartOnce(
    `plotHeight:${JSON.stringify(value)}`,
    `[charts] Ignored plotHeight ${JSON.stringify(value)}: use a positive px number or { aspect: <positive number> }.`,
  );
  return undefined;
}

function plotHeightStyle(value: ChartPlotHeight): CSSProperties {
  return typeof value === "number" ? { height: value } : { aspectRatio: `${value.aspect} / 1` };
}

export interface ChartPlotBoxInput {
  /** The container's `plotHeight` prop. */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * The container's `aspectRatio` prop AS PASSED (no default). A CSS ratio is
   * kept verbatim; `"auto"`/`""` means "no height of my own".
   */
  aspectRatio?: string;
  /** The family default: a plot height, or a CSS ratio string kept verbatim. */
  defaultPlotHeight: Responsive<ChartPlotHeight> | string;
}

/**
 * The plot box's height style (ADR 0039 §3), first rung that speaks wins:
 * own `plotHeight` → own `aspectRatio` (`"auto"` defers) → the enclosing
 * frame's plot height or fill → the family default. Returns `{}` for `"auto"`
 * outside a frame: the caller's CSS sizes the box.
 */
export function resolvePlotBoxStyle(
  input: ChartPlotBoxInput & { framePlotHeight?: ChartFramePlotHeight },
  breakpoint: ChartBreakpoint,
): CSSProperties {
  const own =
    input.plotHeight === undefined
      ? undefined
      : validPlotHeight(resolveResponsive(input.plotHeight, breakpoint));
  if (own !== undefined) return plotHeightStyle(own);

  const ratio = input.aspectRatio?.trim();
  const deferred = input.aspectRatio !== undefined && (ratio === "" || ratio === "auto");
  if (input.aspectRatio !== undefined && !deferred) return { aspectRatio: ratio };

  const frame = input.framePlotHeight;
  if (frame === "fill") return { height: "100%" };
  if (frame !== undefined) {
    const fromFrame = validPlotHeight(resolveResponsive(frame, breakpoint));
    if (fromFrame !== undefined) return plotHeightStyle(fromFrame);
  }
  if (deferred) return {};

  const fallback = input.defaultPlotHeight;
  if (typeof fallback === "string") return { aspectRatio: fallback };
  return plotHeightStyle(resolveResponsive(fallback, breakpoint));
}

export interface ChartPlotRootProps extends HTMLAttributes<HTMLDivElement> {
  /** Omit when the plot box is a descendant (`ChartPlotBox`) or data-derived. */
  plotBox?: ChartPlotBoxInput;
}

/**
 * A chart container's root `<div>` (internal): measures its own width, sets
 * `data-chart-breakpoint`, sizes itself by the resolved plot height (a caller
 * `style` still wins, as before) and provides the breakpoint scope inside.
 */
export const ChartPlotRoot = forwardRef<HTMLDivElement, ChartPlotRootProps>(function ChartPlotRoot(
  { plotBox, style, children, ...props },
  forwardedRef,
) {
  const { ref, breakpoint } = useMeasuredChartBreakpoint<HTMLDivElement>(forwardedRef);
  const framePlotHeight = useContext(ChartFramePlotHeightContext);
  const boxStyle = plotBox
    ? resolvePlotBoxStyle({ ...plotBox, framePlotHeight }, breakpoint)
    : undefined;
  return createElement(
    "div",
    {
      ...props,
      ref,
      "data-chart-breakpoint": breakpoint,
      style: { ...boxStyle, ...style },
    },
    createElement(ChartBreakpointScope, { breakpoint }, children),
  );
});

/**
 * The plot box when it is a DESCENDANT of the container root (heatmap): sized
 * like `ChartPlotRoot`, at the tier the enclosing root measured. Internal.
 */
export const ChartPlotBox = forwardRef<
  HTMLDivElement,
  ChartPlotRootProps & { plotBox: ChartPlotBoxInput }
>(function ChartPlotBox({ plotBox, style, ...props }, ref) {
  const breakpoint = useChartBreakpoint();
  const framePlotHeight = useContext(ChartFramePlotHeightContext);
  const boxStyle = resolvePlotBoxStyle({ ...plotBox, framePlotHeight }, breakpoint);
  return createElement("div", { ...props, ref, style: { ...boxStyle, ...style } });
});
