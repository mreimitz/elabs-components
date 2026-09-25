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
 * - `excluded` (with `dimExcluded`, default on) dims the MARK to
 *   `SELECTION_EXCLUDED_OPACITY` and adds a non-hue channel — a dashed frame
 *   (`EXCLUDED_DASH_ARRAY`) along the mark's own boundary in `--chart-foreground`,
 *   painted OUTSIDE the dim at full opacity (#446: a channel ghosted with the
 *   mark it rescues fell below the WCAG 1.4.11 3:1 floor in every theme);
 * - `selected` draws a compound outline at full opacity: a `--chart-foreground`
 *   band, split by a `--chart-background` core (#442);
 * - `associated` is the resting paint.
 *
 * Why these two inks (#442). No single token clears 3:1 against every series
 * fill AND the surface — `--ring` equals `--chart-1` in `light`, and
 * `--foreground` equals a series fill in `dark`. `--chart-foreground` and
 * `--chart-background` are ≥10:1 apart in every theme, so against ANY fill at
 * least one of the two bands clears 3:1 (their ratio's square root is > 3), and
 * the outer foreground band always clears 3:1 against the surface. It is the
 * focus indicator's compound trick, in existing tokens only (no `--selection-*`,
 * ADR 0037 §6).
 *
 * Why a dashed FRAME for excluded (#443). High decoration already dresses marks
 * with every hatch orientation, dots, grids, cross-hatch (`series-pattern.tsx`),
 * dashed line strokes, and the heatmap draws its own negative-value hatch — so
 * an excluded HATCH collapsed into the decoration at `--decoration` 10. No
 * decoration ever strokes a mark's closed boundary with a dash, so the frame is
 * orthogonal to decoration at every level, reads in greyscale, and is the rule's
 * "dashed frame" (`.claude/rules/dashboard.md`, Encoding). Line and area series
 * frame each excluded datum with a dashed ring (`ChartSelectionSeriesLayer`).
 *
 * Selection is keyed by CATEGORY (the associative model selects field values),
 * so it applies per point/category on every family — a line or area series is
 * never "selected" as a whole. Continuous series (line/area/composed) paint the
 * category's column through `ChartSelectionSeriesLayer`; discrete marks (bars,
 * slices, cells, points) wrap themselves in `ChartSelectionMark`.
 *
 * With `selectionStates` unset nothing resolves: no attribute, no overlay, no
 * context — the DOM stays byte-identical to a chart that never heard of it.
 */

import {
  cloneElement,
  createContext,
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  type SVGProps,
  use,
} from "react";

import { chartCssVars, useChart } from "./chart-context";
import { chartRowCategory } from "./chart-hover-link";
import {
  EXCLUDED_DASH_ARRAY,
  EXCLUDED_FRAME_WIDTH,
  SELECTED_OUTLINE_CORE_WIDTH,
  SELECTED_OUTLINE_WIDTH,
} from "./chart-stroke";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-opacity";

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
   * Dim `excluded` marks and add their non-hue channel (the dashed frame). Default `true`; `false`
   * keeps the `data-selection` attribute (so a host can style it) but paints
   * nothing.
   */
  dimExcluded?: boolean;
}

// `SELECTION_EXCLUDED_OPACITY` (→ `./chart-opacity`) and the outline/frame
// stroke width + dash constants (→ `./chart-stroke`) moved out (RM-173) —
// pure leaves, so a chart prop group can reference them without pulling
// React into the definition layer. Re-exported here so every existing import
// keeps working. The matching INKS stay here: they read `chartCssVars`
// (`./chart-context`), which is not pure.
export { SELECTION_EXCLUDED_OPACITY } from "./chart-opacity";
export {
  EXCLUDED_DASH_ARRAY,
  EXCLUDED_FRAME_WIDTH,
  SELECTED_OUTLINE_CORE_WIDTH,
  SELECTED_OUTLINE_WIDTH,
} from "./chart-stroke";

/** The outer ink of a `selected` outline. */
export const SELECTED_OUTLINE_COLOR = chartCssVars.foreground;

/** The core ink of a `selected` outline. */
export const SELECTED_OUTLINE_CORE_COLOR = chartCssVars.background;

/** The ink of an excluded mark's dashed frame, at full opacity. */
export const EXCLUDED_FRAME_COLOR = chartCssVars.foreground;

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
  /** Draw the excluded dim and its dashed frame. */
  dimmed: boolean;
  /** Draw the selected compound outline. */
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
  // RM-145: an open explicit-confirm session paints its provisional set
  // through this same seam, over the host's own resolver.
  const provisional = use(ChartSelectionProvisionalContext);
  const resolver =
    (provisional?.selectionStates as ChartSelectionStatesResolver<TDatum> | undefined) ??
    selectionStates;
  if (provisional === undefined && typeof resolver !== "function") return children;
  return createElement(
    ChartSelectionContext,
    {
      // Inside a session the provider is ALWAYS mounted (value `null` when
      // nothing resolves), so opening a session never remounts the chart.
      value:
        typeof resolver === "function"
          ? ({ dimExcluded, selectionStates: resolver } as ChartSelectionProps<never>)
          : null,
    },
    children,
  );
}

// ── Provisional paint (RM-145) ───────────────────────────────────────────────

/**
 * Carried by a selection session (`use-selection-session.ts`) around a chart
 * whose gestures are on: `undefined` outside a session (the byte-identical
 * path), `{ selectionStates: undefined }` while no session is open, and the
 * provisional resolver (selected = provisional-in, associated = the rest)
 * while one is.
 */
export const ChartSelectionProvisionalContext = createContext<
  { selectionStates?: ChartSelectionStatesResolver } | undefined
>(undefined);

/** True inside a selection session — a family mounts its paint layer so a provisional set shows. */
export function useChartSelectionSessionPaint(): boolean {
  return use(ChartSelectionProvisionalContext) !== undefined;
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

// ── Shared mark paint ────────────────────────────────────────────────────────

/** Props that stroke a cloned mark shape as a paint-only overlay. */
function overlay(slot: string, stroke: string, strokeWidth: number, dash?: string) {
  return {
    "data-slot": slot,
    fill: "none",
    key: slot,
    pointerEvents: "none",
    stroke,
    strokeDasharray: dash,
    strokeWidth,
  } as SVGProps<SVGElement>;
}

/**
 * The full-opacity paint a resolved mark adds over its geometry: the excluded
 * dashed frame, or the selected compound outline (outer band, then core).
 */
function selectionOverlays(
  prefix: string,
  paint: MarkSelectionPaint,
  shape: ReactElement<SVGProps<SVGElement>>,
): ReactNode[] {
  if (paint.dimmed) {
    return [
      cloneElement(
        shape,
        overlay(`${prefix}-frame`, EXCLUDED_FRAME_COLOR, EXCLUDED_FRAME_WIDTH, EXCLUDED_DASH_ARRAY),
      ),
    ];
  }
  if (paint.outlined) {
    return [
      cloneElement(
        shape,
        overlay(`${prefix}-outline`, SELECTED_OUTLINE_COLOR, SELECTED_OUTLINE_WIDTH),
      ),
      cloneElement(
        shape,
        overlay(`${prefix}-outline-core`, SELECTED_OUTLINE_CORE_COLOR, SELECTED_OUTLINE_CORE_WIDTH),
      ),
    ];
  }
  return [];
}

export interface ChartSelectionMarkProps {
  /** Resolved paint (`resolveMarkPaint`). Unresolved → children returned untouched. */
  paint: MarkSelectionPaint;
  /**
   * The mark's outline geometry (`<rect>`, `<path>`, `<circle>`, or a `<g>` of
   * them), cloned for the excluded frame and the selected outline. Omit to
   * paint only the dim.
   */
  shape?: ReactElement<SVGProps<SVGElement>>;
  children: ReactNode;
}

/**
 * Wraps one discrete mark in the shared selection paint: `data-selection` on a
 * `<g>`; for excluded, the mark inside a dimmed `<g>` and the dashed frame
 * beside it at full opacity; for selected, the compound outline. With nothing
 * resolved it returns `children` as-is, so the opt-out DOM is byte-identical.
 */
export function ChartSelectionMark({ children, paint, shape }: ChartSelectionMarkProps) {
  const state = paint["data-selection"];
  if (state === undefined) return createElement(Fragment, null, children);
  const mark = paint.dimmed
    ? createElement(
        "g",
        { "data-slot": "chart-selection-mark-dim", opacity: SELECTION_EXCLUDED_OPACITY },
        children,
      )
    : children;
  return createElement(
    "g",
    { "data-selection": state, "data-slot": "chart-selection-mark" },
    mark,
    ...(shape ? selectionOverlays("chart-selection-mark", paint, shape) : []),
  );
}

// ── Continuous series (time-series shell) ────────────────────────────────────

const SERIES_POINT_RADIUS = 4;

/**
 * SVG child a time-series family (`LineChart`, `AreaChart`, `ComposedChart`)
 * appends when `selectionStates` is set. A continuous path cannot dim one
 * category, so each resolved category paints its COLUMN: excluded → a veil in
 * `--chart-background` that leaves the marks at `SELECTION_EXCLUDED_OPACITY`,
 * then a dashed ring framing every series' datum at full opacity; selected →
 * the compound outline ring around every series' datum. The category resolves
 * once (`seriesKey` unset) — see the module doc.
 */
export function ChartSelectionSeriesLayer() {
  const selection = useChartSelection();
  const chart = useChart();
  if (!selection) return null;
  const columnWidth = Math.max(chart.columnWidth, SERIES_POINT_RADIUS * 2);
  const columns: ReactNode[] = [];
  chart.data.forEach((row, index) => {
    const category = chartRowCategory(chart, index);
    const paint = resolveMarkPaint(selection, { category, datum: row });
    if (paint["data-selection"] === undefined) return;
    const x = chart.xScale(chart.xAccessor(row)) ?? 0;
    const left = Math.max(0, x - columnWidth / 2);
    const width = Math.min(chart.innerWidth, x + columnWidth / 2) - left;
    const children: ReactNode[] = [];
    if (paint.dimmed) {
      children.push(
        createElement("rect", {
          "data-slot": "chart-selection-series-layer-veil",
          fill: chartCssVars.background,
          height: chart.innerHeight,
          key: "veil",
          opacity: 1 - SELECTION_EXCLUDED_OPACITY,
          width,
          x: left,
          y: 0,
        }),
      );
    }
    for (const line of chart.lines) {
      const raw = row[line.dataKey];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const scale =
        (line.yAxisId !== undefined ? chart.yScales[String(line.yAxisId)] : undefined) ??
        chart.yScale;
      const ring = createElement("circle", {
        cx: x,
        cy: scale(raw) ?? 0,
        key: line.dataKey,
        r: SERIES_POINT_RADIUS,
      });
      children.push(
        createElement(
          Fragment,
          { key: line.dataKey },
          ...selectionOverlays("chart-selection-series-layer", paint, ring),
        ),
      );
    }
    columns.push(
      createElement(
        "g",
        {
          "data-category-index": index,
          "data-selection": paint["data-selection"],
          "data-slot": "chart-selection-series-layer-column",
          key: index,
        },
        ...children,
      ),
    );
  });
  return createElement(
    "g",
    {
      "aria-hidden": true,
      "data-slot": "chart-selection-series-layer",
      pointerEvents: "none",
    },
    ...columns,
  );
}
