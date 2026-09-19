"use client";

/**
 * The map's responsive contract: container tiers, `MapResponsive<T>` and the
 * frame context `<MapCanvas>` provides to its furniture (RM-125).
 *
 * A DELIBERATE COPY of `@elabs-ai/components-charts`' `chart-breakpoint.ts`
 * (ADR 0039), with the same thresholds and the same desktop-first
 * `{ base, medium?, narrow? }` shape. `maps` may not import `charts` (both are
 * layer-2 leaves — `pnpm check --rule dep-direction`), so the few lines live
 * here too. Change a threshold in both files or in neither.
 *
 * - Three container tiers, measured on the MAP's own width, never the
 *   viewport: `narrow` (< 480 px), `medium` (< 768 px), `wide`.
 * - `MapResponsive<T>`: one value, or `{ base, medium?, narrow? }` — an
 *   override applies at its tier and every narrower tier that sets nothing.
 *   A plain value structurally matches `charts`' `Responsive<T>`, so one
 *   object can drive a chart and a map.
 */

import {
  type CSSProperties,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

// ── Tiers ────────────────────────────────────────────────────────────────────

/** A map container's width tier — the same three tiers as a chart's. */
export type MapBreakpoint = "narrow" | "medium" | "wide";

/** Every tier, narrowest first. */
export const MAP_BREAKPOINTS: readonly MapBreakpoint[] = ["narrow", "medium", "wide"];

/**
 * A width (CSS px) below `narrow` is narrow; below `medium` is medium; anything
 * else is wide. A boundary belongs to the wider tier (480 → medium). Same
 * numbers as `CHART_BREAKPOINT_THRESHOLDS`.
 */
export const MAP_BREAKPOINT_THRESHOLDS = { narrow: 480, medium: 768 } as const;

/**
 * The tier for a measured container width. `0` or a non-finite width means
 * "not measured yet" (server render, first pass, `display: none`) and
 * resolves to `wide`, so a first paint matches the pre-tier layout.
 */
export function mapBreakpointForWidth(width: number): MapBreakpoint {
  if (!Number.isFinite(width) || width <= 0) return "wide";
  if (width < MAP_BREAKPOINT_THRESHOLDS.narrow) return "narrow";
  if (width < MAP_BREAKPOINT_THRESHOLDS.medium) return "medium";
  return "wide";
}

// ── MapResponsive<T> ─────────────────────────────────────────────────────────

/**
 * Per-tier values, desktop-first: `base` is the WIDE value (the opposite of
 * Tailwind's unprefixed, mobile-first class); overrides go down.
 */
export interface MapResponsiveByBreakpoint<T> {
  /** The value at `wide`, and the fallback for every tier that sets nothing. */
  base: T;
  /** At `medium` — and at `narrow` too, unless `narrow` is set. */
  medium?: T;
  /** At `narrow` only. */
  narrow?: T;
}

/**
 * One value for every tier, or per-tier values. `T` must never be an object
 * type with its own `base` key (that key marks the per-tier form). Read it
 * through {@link resolveMapResponsive} / {@link useMapResponsive}.
 */
export type MapResponsive<T> = T | MapResponsiveByBreakpoint<T>;

/** True for the per-tier form: a plain object with its own `base` key. */
export function isMapResponsiveByBreakpoint<T>(
  value: MapResponsive<T>,
): value is MapResponsiveByBreakpoint<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "base")
  );
}

/**
 * The value for `breakpoint`: `wide` → `base`; `medium` → `medium ?? base`;
 * `narrow` → `narrow ?? medium ?? base`. "Not set" means `undefined`.
 */
export function resolveMapResponsive<T>(value: MapResponsive<T>, breakpoint: MapBreakpoint): T {
  if (!isMapResponsiveByBreakpoint(value)) return value as T;
  if (breakpoint === "wide") return value.base;
  if (breakpoint === "narrow" && value.narrow !== undefined) return value.narrow;
  return value.medium !== undefined ? value.medium : value.base;
}

// ── Height ───────────────────────────────────────────────────────────────────

/** CSS px, or the map's width ÷ height (`{ aspect: 2 }` = twice as wide as tall). */
export type MapHeight = number | { aspect: number };

/**
 * The height a `<MapCanvas>` falls back to when its parent gives it none:
 * 1.6 : 1, and square at `narrow` — an aspect-locked map at 380 px would
 * otherwise shrink to a strip nobody can read.
 */
export const DEFAULT_MAP_HEIGHT: MapResponsiveByBreakpoint<MapHeight> = {
  base: { aspect: 1.6 },
  narrow: { aspect: 1 },
};

function validHeight(value: MapHeight | undefined): MapHeight | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (value && Number.isFinite(value.aspect) && value.aspect > 0) return value;
  return undefined;
}

/**
 * The container style for a `height` at `breakpoint`. An explicit `height`
 * sets the box outright (`height: auto` releases the `h-full` class for an
 * aspect). Without one, only an `aspect-ratio` is set — CSS ignores it while
 * the parent gives the map a definite height, so a map in a sized parent
 * looks exactly as before; a map in an unsized parent stops collapsing to 0.
 */
export function resolveMapHeightStyle(
  height: MapResponsive<MapHeight> | undefined,
  breakpoint: MapBreakpoint,
): CSSProperties {
  const own =
    height === undefined ? undefined : validHeight(resolveMapResponsive(height, breakpoint));
  if (typeof own === "number") return { height: own };
  if (own) return { height: "auto", aspectRatio: `${own.aspect} / 1` };
  const fallback = resolveMapResponsive(DEFAULT_MAP_HEIGHT, breakpoint);
  return typeof fallback === "number" ? {} : { aspectRatio: `${fallback.aspect} / 1` };
}

// ── Measuring ────────────────────────────────────────────────────────────────

/**
 * Measures `node` with a `ResizeObserver` and returns its tier. Re-renders
 * only when the TIER changes.
 */
export function useMeasuredMapBreakpoint(node: Element | null): MapBreakpoint {
  const [breakpoint, setBreakpoint] = useState<MapBreakpoint>("wide");
  // Layout effect: the first measure lands before paint, so a narrow map never
  // flashes its wide furniture.
  useLayoutEffect(() => {
    if (!node) return undefined;
    const update = (width: number) => {
      const next = mapBreakpointForWidth(width);
      setBreakpoint((prev) => (prev === next ? prev : next));
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
  return breakpoint;
}

// ── Frame context ────────────────────────────────────────────────────────────

/** Where furniture outside the map box goes: the strip above or below it. */
export type MapFrameSide = "above" | "below";

export interface MapFrameContextValue {
  /** The map container's measured tier. */
  breakpoint: MapBreakpoint;
  /** `false` when the canvas is static (`<MapCanvas interactive={false}>`). */
  interactive: boolean;
  /** The strips around the map box; `null` until something asks for one. */
  slots: Record<MapFrameSide, HTMLElement | null>;
  /** Ask the canvas to render a strip; returns the release function. */
  requestSlot: (side: MapFrameSide) => () => void;
}

const noopRelease = () => {};

const DEFAULT_FRAME: MapFrameContextValue = {
  breakpoint: "wide",
  interactive: true,
  slots: { above: null, below: null },
  requestSlot: () => noopRelease,
};

export const MapFrameContext = createContext<MapFrameContextValue>(DEFAULT_FRAME);

/** The frame `<MapCanvas>` provides: tier, static flag, outside strips. */
export function useMapFrame(): MapFrameContextValue {
  return useContext(MapFrameContext);
}

/** The enclosing map's tier (`wide` outside a `<MapCanvas>`). */
export function useMapBreakpoint(): MapBreakpoint {
  return useContext(MapFrameContext).breakpoint;
}

/** `value` resolved at the enclosing map's tier. */
export function useMapResponsive<T>(value: MapResponsive<T>): T {
  return resolveMapResponsive(value, useMapBreakpoint());
}

/**
 * The strip above / below the map box to portal into, or `null` while it is
 * not needed (`side` is `null`) or not mounted yet. Asking renders the strip;
 * the canvas drops it again when nothing asks.
 */
export function useMapFrameSlot(side: MapFrameSide | null): HTMLElement | null {
  const { slots, requestSlot } = useContext(MapFrameContext);
  useEffect(() => (side ? requestSlot(side) : undefined), [side, requestSlot]);
  return side ? slots[side] : null;
}
