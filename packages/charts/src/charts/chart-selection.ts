"use client";

/**
 * The cross-family selection INPUT contract (RM-073, #437).
 *
 * `chart-datapoint.ts` gives every family one OUTPUT (`onDatapointClick`); this
 * module is the matching input: a host tells a chart which categories are
 * `selected`, merely `associated`, or `excluded` by the current selection, and
 * every family paints the same tri-state. The union is declared HERE and is the
 * one a dashboard core re-exports, so the two never drift.
 *
 * Paint rules (shared by every mark family):
 * - every mark whose state resolves sets `data-selection="<state>"` on its root;
 * - `excluded` (with `dimExcluded`, default on) draws at `EXCLUDED_MARK_OPACITY`
 *   PLUS a non-hue channel — hatch for area marks, dashed stroke for line marks,
 *   hollow ring for point marks — so the state survives greyscale (WCAG 1.4.1);
 * - `selected` draws a `SELECTED_OUTLINE_WIDTH` outline in `--ring`, full opacity;
 * - `associated` is the resting paint.
 *
 * With `selectionStates` unset nothing resolves: no attribute, no overlay, no
 * context — the DOM stays byte-identical to a chart that never heard of it.
 */

import { createContext, createElement, type ReactNode, use } from "react";

/** Tri-state of one mark under the host's current selection. */
export type SelectionState = "selected" | "associated" | "excluded";

/** A category value as a family sees it: band label, numeric bucket or time. */
export type ChartSelectionCategory = string | number | Date;

/** Resolves the selection state of one mark. */
export type ChartSelectionStatesResolver<TDatum = Record<string, unknown>> = (
  category: ChartSelectionCategory,
  seriesKey?: string,
  datum?: TDatum,
) => SelectionState;

/** Selection input props every family accepts. Spread into the family's own props. */
export interface ChartSelectionProps<TDatum = Record<string, unknown>> {
  /**
   * Maps a mark (category, optional series key, optional raw row) to its
   * selection state. Unset → the chart renders exactly as before.
   */
  selectionStates?: ChartSelectionStatesResolver<TDatum>;
  /**
   * Dim `excluded` marks and add their non-hue channel. Default `true`; `false`
   * keeps the `data-selection` attribute (so a host can style it) but paints
   * nothing.
   */
  dimExcluded?: boolean;
}

/**
 * Opacity of an excluded mark. Mirrors the house legend-hover fade
 * (`fadedOpacity` default in `bar.tsx`/`area.tsx`) until a shared selection
 * token exists — one seam to swap, never re-declared per family.
 */
export const EXCLUDED_MARK_OPACITY = 0.3;

/** Outline width of a `selected` mark, painted in `--ring`. */
export const SELECTED_OUTLINE_WIDTH = 2;

/** The ink of a `selected` outline. */
export const SELECTED_OUTLINE_COLOR = "var(--ring)";

/** Dash of an excluded LINE mark and a hollow point mark's stroke. */
export const EXCLUDED_DASH_ARRAY = "4 3";

/** A point handed to `resolveMarkState`. */
export interface ChartSelectionPoint<TDatum = Record<string, unknown>> {
  category: ChartSelectionCategory | undefined;
  seriesKey?: string;
  datum?: TDatum;
}

/**
 * The state of one mark, or `undefined` when no resolver is set or the mark has
 * no category (nothing to select by).
 */
export function resolveMarkState<TDatum = Record<string, unknown>>(
  props: ChartSelectionProps<TDatum> | null | undefined,
  point: ChartSelectionPoint<TDatum>,
): SelectionState | undefined {
  const resolver = props?.selectionStates;
  if (typeof resolver !== "function" || point.category === undefined) {
    return undefined;
  }
  return resolver(point.category, point.seriesKey, point.datum);
}

/** The paint a mark applies for a resolved state. */
export interface MarkSelectionPaint {
  /** Spread onto the mark root; `undefined` when unresolved (no attribute). */
  "data-selection": SelectionState | undefined;
  /** Draw the non-hue excluded channel and the dim. */
  dimmed: boolean;
  /** Draw the `--ring` outline. */
  outlined: boolean;
}

const NO_PAINT: MarkSelectionPaint = {
  "data-selection": undefined,
  dimmed: false,
  outlined: false,
};

/** Maps a state to paint flags, honouring `dimExcluded` (default `true`). */
export function markSelectionPaint(
  state: SelectionState | undefined,
  dimExcluded = true,
): MarkSelectionPaint {
  if (state === undefined) return NO_PAINT;
  return {
    "data-selection": state,
    dimmed: state === "excluded" && dimExcluded,
    outlined: state === "selected",
  };
}

// ── Context seam ─────────────────────────────────────────────────────────────

const ChartSelectionContext = createContext<ChartSelectionProps<never> | null>(null);

export interface ChartSelectionProviderProps<
  TDatum = Record<string, unknown>,
> extends ChartSelectionProps<TDatum> {
  children: ReactNode;
}

/**
 * Hands a family's selection props to its marks. Families mount it ONLY when
 * `selectionStates` is set, so the opt-out path adds nothing.
 */
export function ChartSelectionProvider<TDatum = Record<string, unknown>>({
  children,
  dimExcluded = true,
  selectionStates,
}: ChartSelectionProviderProps<TDatum>) {
  if (typeof selectionStates !== "function") return children;
  return createElement(
    ChartSelectionContext,
    { value: { dimExcluded, selectionStates } as ChartSelectionProps<never> },
    children,
  );
}

/** The nearest family's selection props, or `null` outside a selection-aware chart. */
export function useChartSelection<
  TDatum = Record<string, unknown>,
>(): ChartSelectionProps<TDatum> | null {
  return use(ChartSelectionContext) as ChartSelectionProps<TDatum> | null;
}

/** Resolves one mark against the nearest provider (hook-free helper for loops). */
export function resolveMarkPaint<TDatum = Record<string, unknown>>(
  selection: ChartSelectionProps<TDatum> | null,
  point: ChartSelectionPoint<TDatum>,
): MarkSelectionPaint {
  if (!selection) return NO_PAINT;
  return markSelectionPaint(resolveMarkState(selection, point), selection.dimExcluded ?? true);
}
