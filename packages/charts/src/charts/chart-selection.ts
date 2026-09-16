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
 * - `excluded` (with `dimExcluded`, default on) draws at `SELECTION_EXCLUDED_OPACITY`
 *   PLUS a non-hue channel — hatch for area marks, dashed stroke for line marks,
 *   hollow ring for point marks — so the state survives greyscale (WCAG 1.4.1);
 * - `selected` draws a `SELECTED_OUTLINE_WIDTH` outline in `--ring`, full opacity;
 * - `associated` is the resting paint.
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

import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { chartCssVars, useChart } from "./chart-context";
import { chartRowCategory } from "./chart-hover-link";
import { PatternLines } from "./visx-pattern";

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
 * Opacity of an excluded mark. Charts own this value but reuse the process
 * package's encoding (`GHOST_OPACITY` in
 * `@elabs-ai/components-process` `process-map/map-model.ts`) so a dashboard's
 * charts and its process map dim excluded values alike. No theme token is
 * minted for it (RM-069 decision 5); this is the one seam, never re-declared
 * per family.
 */
export const SELECTION_EXCLUDED_OPACITY = 0.35;

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

// ── Shared mark paint ────────────────────────────────────────────────────────

/**
 * The non-hue channel an excluded mark adds: `hatch` for area marks (bars,
 * slices, cells), `dash` for line marks, `hollow` for point marks.
 */
export type ChartSelectionChannel = "hatch" | "dash" | "hollow";

/** Pattern definition every `hatch` overlay in one chart points at. */
export function ChartSelectionHatchDefs({ id }: { id: string }) {
  return createElement(
    "defs",
    { "data-slot": "chart-selection-hatch-defs" },
    createElement(PatternLines, {
      height: 6,
      id,
      orientation: ["diagonal"],
      stroke: chartCssVars.foreground,
      strokeWidth: CHART_HAIRLINE_WIDTH * 2,
      width: 6,
    }),
  );
}

export interface ChartSelectionMarkProps {
  /** Resolved paint (`resolveMarkPaint`). Unresolved → children returned untouched. */
  paint: MarkSelectionPaint;
  /** The excluded mark's non-hue channel. */
  channel: ChartSelectionChannel;
  /**
   * The mark's outline geometry (`<rect>`, `<path>`, `<circle>`), cloned for the
   * excluded channel and the selected outline. Omit to paint only the dim.
   */
  shape?: ReactElement<SVGProps<SVGElement>>;
  /** `ChartSelectionHatchDefs` id, required by the `hatch` channel. */
  hatchId?: string;
  children: ReactNode;
}

/**
 * Wraps one discrete mark in the shared selection paint: `data-selection` on a
 * `<g>`, the excluded dim + non-hue channel, the `--ring` selected outline.
 * With nothing resolved it returns `children` as-is, so the opt-out DOM is
 * byte-identical.
 */
export function ChartSelectionMark({
  channel,
  children,
  hatchId,
  paint,
  shape,
}: ChartSelectionMarkProps) {
  const state = paint["data-selection"];
  if (state === undefined) return createElement(Fragment, null, children);
  let channelNode: ReactNode = null;
  if (paint.dimmed && shape) {
    if (channel === "hatch" && hatchId) {
      channelNode = cloneElement(shape, {
        "data-slot": "chart-selection-mark-hatch",
        fill: `url(#${hatchId})`,
        key: "channel",
        pointerEvents: "none",
        stroke: "none",
      } as SVGProps<SVGElement>);
    } else if (channel !== "hatch") {
      channelNode = cloneElement(shape, {
        "data-slot": `chart-selection-mark-${channel}`,
        fill: channel === "hollow" ? chartCssVars.background : "none",
        key: "channel",
        pointerEvents: "none",
        stroke: chartCssVars.foreground,
        strokeDasharray: EXCLUDED_DASH_ARRAY,
        strokeWidth: CHART_HAIRLINE_WIDTH,
      } as SVGProps<SVGElement>);
    }
  }
  const outline =
    paint.outlined && shape
      ? cloneElement(shape, {
          "data-slot": "chart-selection-mark-outline",
          fill: "none",
          key: "outline",
          pointerEvents: "none",
          stroke: SELECTED_OUTLINE_COLOR,
          strokeWidth: SELECTED_OUTLINE_WIDTH,
        } as SVGProps<SVGElement>)
      : null;
  return createElement(
    "g",
    {
      "data-selection": state,
      "data-slot": "chart-selection-mark",
      opacity: paint.dimmed ? SELECTION_EXCLUDED_OPACITY : undefined,
    },
    children,
    channelNode,
    outline,
  );
}

// ── Continuous series (time-series shell) ────────────────────────────────────

const SERIES_POINT_RADIUS = 4;

export interface ChartSelectionSeriesLayerProps {
  /** `dash` for line families, `hatch` for area families. */
  channel: Exclude<ChartSelectionChannel, "hollow">;
  /** Unique id for the hatch pattern (from `useId`). */
  hatchId: string;
}

/**
 * SVG child a time-series family (`LineChart`, `AreaChart`, `ComposedChart`)
 * appends when `selectionStates` is set. A continuous path cannot dim one
 * category, so each resolved category paints its COLUMN: excluded → a veil in
 * `--chart-background` that leaves the marks at `SELECTION_EXCLUDED_OPACITY`,
 * plus the channel (hatch over the column for areas, a dashed hollow point per
 * series for lines); selected → a `--ring` outline around every series' point.
 * The category resolves once (`seriesKey` unset) — see the module doc.
 */
export function ChartSelectionSeriesLayer({ channel, hatchId }: ChartSelectionSeriesLayerProps) {
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
    const points = chart.lines.flatMap((line) => {
      const raw = row[line.dataKey];
      if (typeof raw !== "number" || !Number.isFinite(raw)) return [];
      const scale =
        (line.yAxisId !== undefined ? chart.yScales[String(line.yAxisId)] : undefined) ??
        chart.yScale;
      return [{ key: line.dataKey, y: scale(raw) ?? 0 }];
    });
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
      if (channel === "hatch") {
        children.push(
          createElement("rect", {
            "data-slot": "chart-selection-series-layer-hatch",
            fill: `url(#${hatchId})`,
            height: chart.innerHeight,
            key: "hatch",
            opacity: SELECTION_EXCLUDED_OPACITY,
            width,
            x: left,
            y: 0,
          }),
        );
      } else {
        for (const point of points) {
          children.push(
            createElement("circle", {
              cx: x,
              cy: point.y,
              "data-slot": "chart-selection-series-layer-dash",
              fill: chartCssVars.background,
              key: `dash-${point.key}`,
              r: SERIES_POINT_RADIUS,
              stroke: chartCssVars.foreground,
              strokeDasharray: EXCLUDED_DASH_ARRAY,
              strokeWidth: CHART_HAIRLINE_WIDTH,
            }),
          );
        }
      }
    }
    if (paint.outlined) {
      for (const point of points) {
        children.push(
          createElement("circle", {
            cx: x,
            cy: point.y,
            "data-slot": "chart-selection-series-layer-outline",
            fill: "none",
            key: `outline-${point.key}`,
            r: SERIES_POINT_RADIUS,
            stroke: SELECTED_OUTLINE_COLOR,
            strokeWidth: SELECTED_OUTLINE_WIDTH,
          }),
        );
      }
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
    channel === "hatch" ? createElement(ChartSelectionHatchDefs, { id: hatchId }) : null,
    ...columns,
  );
}
