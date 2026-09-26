/**
 * responsive.ts — the pure `Responsive<T>` contract (ADR 0039, RM-173).
 *
 * Split out of `chart-breakpoint.ts`, which also imports React and `ui`, so a
 * chart prop group (ADR 0042) can resolve a `Responsive` value and the
 * default plot height without pulling either into the pure definition layer.
 * `chart-breakpoint.ts` re-exports every name here, so every existing import
 * keeps working unchanged.
 */

import type { ChartBreakpoint } from "./chart-breakpoint";

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
 * `useResponsiveValue` (`chart-breakpoint.ts`) — `pnpm check --rule charts-responsive`.
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

// ── Plot height ──────────────────────────────────────────────────────────────

/** CSS px, or the plot's width ÷ height (`{ aspect: 2 }` = twice as wide as tall). */
export type ChartPlotHeight = number | { aspect: number };

/** The default for families whose box was `2 / 1`: 2 : 1, and 1.25 : 1 at `narrow`. */
export const DEFAULT_CHART_PLOT_HEIGHT: ResponsiveByBreakpoint<ChartPlotHeight> = {
  base: { aspect: 2 },
  narrow: { aspect: 1.25 },
};
