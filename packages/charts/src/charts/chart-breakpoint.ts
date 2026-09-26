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

import { cn } from "@elabs-ai/components-ui";
import { warnOnce } from "@elabs-ai/components-ui/definition";
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
import {
  isResponsiveByBreakpoint,
  resolveResponsive,
  type ChartPlotHeight,
  type Responsive,
} from "./responsive";

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
// Moved to `./responsive` (RM-173) — a pure leaf, so a chart prop group can
// resolve a `Responsive` value without pulling React into the definition
// layer. Re-exported here so every existing import keeps working.

export {
  isResponsiveByBreakpoint,
  resolveResponsive,
  type Responsive,
  type ResponsiveByBreakpoint,
} from "./responsive";

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
// `ChartPlotHeight` / `DEFAULT_CHART_PLOT_HEIGHT` moved to `./responsive`
// (RM-173) too, for the same reason. Re-exported here.

export { DEFAULT_CHART_PLOT_HEIGHT, type ChartPlotHeight } from "./responsive";

/** What an enclosing `ChartFrame` hands its chart: a plot height, or "fill the body". */
export type ChartFramePlotHeight = Responsive<ChartPlotHeight> | "fill";

/**
 * A plot height a HOST forces on every chart inside it, through
 * `ChartConfigProvider value={{ plotHeight }}` — an expand view, a
 * presentation pane, a fixed-size export. Px, `{ aspect }`, or `"fill"`: the
 * plot takes the full height of its parent where that height is definite (an
 * expand dialog's view pane) and keeps its own size where it is not.
 * ADR 0039 §3 rung 0: it beats the chart's own `plotHeight`/`aspectRatio`;
 * only a fixed `size` (pie, ring, radar) still wins.
 */
export type ChartHostPlotHeight = ChartPlotHeight | "fill";

const ChartFramePlotHeightContext = createContext<ChartFramePlotHeight | undefined>(undefined);

/**
 * Internal: lets a chart that sizes its own plot box tell the enclosing frame
 * so. Returns the unregister function. A frame with no registered chart (plain
 * children, a canvas plot, a table) keeps a bounded body box, as before 0039.
 */
type RegisterFramePlotConsumer = () => () => void;
const ChartFramePlotConsumerContext = createContext<RegisterFramePlotConsumer | undefined>(
  undefined,
);

/** Internal: `ChartFrame` → its chart (ADR 0039 §3, precedence rung 4). */
export function ChartFramePlotHeightProvider({
  value,
  onPlotConsumer,
  children,
}: {
  value: ChartFramePlotHeight | undefined;
  onPlotConsumer?: RegisterFramePlotConsumer;
  children?: ReactNode;
}) {
  // A nested provider that only re-scopes the height (a `ChartMultiples` panel) keeps the
  // enclosing frame's registration, so the frame still learns its charts size themselves.
  const outerPlotConsumer = useContext(ChartFramePlotConsumerContext);
  return createElement(
    ChartFramePlotHeightContext.Provider,
    { value },
    createElement(
      ChartFramePlotConsumerContext.Provider,
      { value: onPlotConsumer ?? outerPlotConsumer },
      children,
    ),
  );
}

/**
 * Internal: the plot height the chart's surroundings hand it — the host's
 * forced value (rung 0) over the enclosing frame's (rung 4). `"fill"` inside a
 * fill-host tile or a host that fills (an expand view).
 */
export function useChartFramePlotHeight(): ChartFramePlotHeight | undefined {
  const frame = useContext(ChartFramePlotHeightContext);
  return useChartConfig().plotHeight ?? frame;
}

/** Internal: the plot height a host forces (rung 0), if any. */
export function useChartHostPlotHeight(): ChartHostPlotHeight | undefined {
  return useChartConfig().plotHeight;
}

/** Register with the enclosing frame while `active` (a plot box that sizes itself). */
function useRegisterFramePlotConsumer(active: boolean): void {
  const register = useContext(ChartFramePlotConsumerContext);
  useLayoutEffect(() => {
    if (!active || !register) return undefined;
    const unregister = register();
    return () => unregister();
  }, [active, register]);
}

/**
 * Dev-only `console.warn`, once per `key` per page load — a thin wrapper over
 * the ui base's `warnOnce` (RM-170), which keeps ONE module-level set shared
 * by every caller (ui, flow, charts). The key is namespaced under `charts:`
 * so it can never collide with a flow or ui one; today's per-key dedupe and
 * every existing `"[Component] …"` message prefix are unchanged. Tests that
 * need a fresh warned set use `resetWarnOnce` from
 * `@elabs-ai/components-ui/definition`, or `vi.resetModules()` for a truly
 * fresh module graph.
 */
export function warnChartOnce(key: string, message: string): void {
  warnOnce(`charts:${key}`, message);
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

/**
 * `{ ...a, ...b }` treats an explicitly-`undefined`-valued key in `b` as "set
 * to nothing", NOT "unset" — it still shadows `a`'s own value for that key
 * (RM-183 review round 2, G1: a caller building
 * `{ height: condition ? x : undefined }` and spreading it last erased an
 * already-resolved `height`/`minHeight` from `boxStyle` this way, collapsing
 * `UnitChart`'s waffle/field plot to its bare content floor no matter what
 * `plotHeight` asked for). Strips those keys instead of forwarding them, so a
 * caller's conditional style object only ever ADDS to the resolved box, never
 * blanks a rung that already spoke.
 */
export function definedStyle(style: CSSProperties | undefined): CSSProperties {
  if (!style) return {};
  const out: CSSProperties = {};
  for (const key of Object.keys(style) as (keyof CSSProperties)[]) {
    const value = style[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
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
 * the host's forced plot height → own `plotHeight` → own `aspectRatio`
 * (`"auto"` defers) → the enclosing frame's plot height or fill → the family
 * default. Returns `{}` for `"auto"` outside a frame: the caller's CSS sizes
 * the box.
 */
export function resolvePlotBoxStyle(
  input: ChartPlotBoxInput & {
    framePlotHeight?: ChartFramePlotHeight;
    hostPlotHeight?: ChartHostPlotHeight;
  },
  breakpoint: ChartBreakpoint,
): CSSProperties {
  const host = input.hostPlotHeight;
  if (host === "fill") return fillHostStyle(resolveOwnPlotBoxStyle(input, breakpoint));
  const forced = host === undefined ? undefined : validPlotHeight(host);
  if (forced !== undefined) return plotHeightStyle(forced);
  return resolveOwnPlotBoxStyle(input, breakpoint);
}

/**
 * A filling host's plot box: the parent's full height where that height is
 * definite. Where it is not, `height: 100%` computes to `auto` and the chart's
 * own size takes over — a px floor, or its ratio (with `width: 100%`, so a
 * definite height never narrows the box through the ratio) — never a 0 px plot.
 */
function fillHostStyle(own: CSSProperties): CSSProperties {
  if (typeof own.height === "number") return { height: "100%", minHeight: own.height };
  if (own.aspectRatio !== undefined) {
    return { width: "100%", height: "100%", aspectRatio: own.aspectRatio };
  }
  return { height: "100%" };
}

/** Rungs 2–5: the chart's own size, else the frame's, else the family default. */
function resolveOwnPlotBoxStyle(
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
  /**
   * With no `plotBox`: take the full height of a fill-host frame (a dashboard
   * tile) so a descendant `ChartPlotBox` has a definite box to fill (heatmap).
   */
  fillsFrame?: boolean;
}

/**
 * A chart container's root `<div>` (internal): measures its own width, sets
 * `data-chart-breakpoint`, sizes itself by the resolved plot height (a caller
 * `style` still wins, as before) and provides the breakpoint scope inside.
 */
export const ChartPlotRoot = forwardRef<HTMLDivElement, ChartPlotRootProps>(function ChartPlotRoot(
  { plotBox, fillsFrame, style, children, ...props },
  forwardedRef,
) {
  const { ref, breakpoint } = useMeasuredChartBreakpoint<HTMLDivElement>(forwardedRef);
  const framePlotHeight = useContext(ChartFramePlotHeightContext);
  const hostPlotHeight = useChartHostPlotHeight();
  useRegisterFramePlotConsumer(plotBox !== undefined);
  const boxStyle = plotBox
    ? resolvePlotBoxStyle({ ...plotBox, framePlotHeight, hostPlotHeight }, breakpoint)
    : fillsFrame && (hostPlotHeight ?? framePlotHeight) === "fill"
      ? { height: "100%" }
      : undefined;
  return createElement(
    "div",
    {
      ...props,
      ref,
      // RM-127 (a-12): `useChartA11yContainerProps` makes a LABELLED chart
      // figure focusable (`tabIndex: 0`), and it was the one focus stop in a
      // chart drawing Chrome's default ring — `1px auto rgb(0, 95, 204)` —
      // while the zoom buttons right after it drew the house one. Every
      // container that goes through this root gets the house ring instead.
      className: props.tabIndex === 0 ? cn("focus-ring", props.className) : props.className,
      "data-chart-breakpoint": breakpoint,
      style: { ...boxStyle, ...definedStyle(style) },
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
  const hostPlotHeight = useChartHostPlotHeight();
  useRegisterFramePlotConsumer(true);
  const boxStyle = resolvePlotBoxStyle({ ...plotBox, framePlotHeight, hostPlotHeight }, breakpoint);
  // In a fill-host tile this box is `height: 100%` of a flex column that also
  // holds the legend, so it must be allowed to shrink (only there, so the DOM
  // outside a tile is unchanged) — unless a filling host set a px floor.
  const fillShrink =
    (hostPlotHeight ?? framePlotHeight) === "fill" && boxStyle.minHeight === undefined
      ? { minHeight: 0 }
      : undefined;
  return createElement("div", {
    ...props,
    ref,
    style: { ...boxStyle, ...fillShrink, ...definedStyle(style) },
  });
});
