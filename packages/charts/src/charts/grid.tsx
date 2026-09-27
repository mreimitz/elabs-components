"use client";

import { GridColumns, GridRows } from "@visx/grid";
import { motion } from "motion/react";
import { useId } from "react";
import { AnnotationLineMark } from "./annotations/chart-annotations";
import { useChartStable, useYScale } from "./chart-context";
import { tickTargetForHeight } from "./tick-targets";
import { useGridShimmer } from "./use-grid-shimmer";
import { valueAxisTicks } from "./y-axis-ticks";
import { isLoadingChromePhase, isLoadingGridChromePhase } from "./y-domain-utils";
import { GRID_PART } from "../definitions/parts/grid.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

/**
 * How the grid paints (RM-108).
 * - `"lines"` (default) — full-width/height hairlines, today's grid;
 * - `"ticks"` — only short hairlines at the axis edge ({@link GRID_TICK_LENGTH_PX}),
 *   no rule crosses the plot;
 * - `"off"` — no rows or columns (highlight rows/columns still paint: they are
 *   annotations, not furniture).
 */
export type GridMode = "lines" | "ticks" | "off";

/** Length of a `mode="ticks"` hairline, in px. */
export const GRID_TICK_LENGTH_PX = 6;

export interface GridProps {
  /** Grid painting mode (RM-108). Default: `"lines"`. */
  mode?: GridMode;
  /** Show horizontal grid lines. Default: true */
  horizontal?: boolean;
  /** Show vertical grid lines. Default: false */
  vertical?: boolean;
  /**
   * Number of horizontal grid lines. Default: the height-derived target shared
   * with `YAxis` (`tickTargetForHeight(innerHeight)` — 3 under 200 px, else 5),
   * so rows and labels stay aligned (RM-108).
   */
  numTicksRows?: number;
  /** Number of vertical grid lines. Default: 10 */
  numTicksColumns?: number;
  /** Explicit tick values for horizontal grid lines. Overrides numTicksRows. */
  rowTickValues?: number[];
  /** Grid line stroke color. Default: var(--chart-grid) */
  stroke?: string;
  /** Grid stroke while loading chrome is active. Falls back to `stroke`. */
  loadingStroke?: string;
  /** Grid line stroke opacity. Default: 1 */
  strokeOpacity?: number;
  /** Grid line stroke width. Default: `CHART_HAIRLINE_WIDTH` — the one furniture weight. */
  strokeWidth?: number;
  /** Grid line dash array. Default: "4,4" for dashed lines */
  strokeDasharray?: string;
  /** Horizontal row values rendered with alternate styling (e.g. zero baseline). */
  highlightRowValues?: number[];
  /** Stroke for highlighted rows. Default: var(--chart-foreground-muted) */
  highlightRowStroke?: string;
  /** Stroke opacity for highlighted rows. Default: 1 */
  highlightRowStrokeOpacity?: number;
  /** Stroke width for highlighted rows. Default: 1 */
  highlightRowStrokeWidth?: number;
  /** Dash array for highlighted rows. Default: solid line */
  highlightRowStrokeDasharray?: string;
  /**
   * Text label drawn at the right edge of each `highlightRowValues` entry
   * (`HaloText`, so it survives sitting on the grid) — a KPI target/goal
   * line the reader can name, not just see. Return `undefined`/`""` to skip
   * the label for a given value. Unset (default): no label, byte-identical
   * to before this prop existed.
   */
  highlightRowLabel?: (value: number) => string | undefined;
  /**
   * Vertical reference lines at these `xDataKey`-domain values (e.g. "today"
   * on a forecast chart) — the column counterpart of `highlightRowValues`.
   * Default: none.
   */
  highlightColumnValues?: Array<number | Date>;
  /** Stroke for highlighted columns. Default: var(--chart-foreground-muted) */
  highlightColumnStroke?: string;
  /** Stroke opacity for highlighted columns. Default: 1 */
  highlightColumnStrokeOpacity?: number;
  /** Stroke width for highlighted columns. Default: 1 */
  highlightColumnStrokeWidth?: number;
  /** Dash array for highlighted columns. Default: solid line */
  highlightColumnStrokeDasharray?: string;
  /**
   * Text label drawn at the bottom-inside, left of each `highlightColumnValues` entry
   * (`HaloText`), e.g. "Today". Return `undefined`/`""` to skip the label
   * for a given value. Unset (default): no label.
   */
  highlightColumnLabel?: (value: number | Date) => string | undefined;
  /** Enable horizontal fade effect on grid rows (fades at left/right). Default: true */
  fadeHorizontal?: boolean;
  /** Enable vertical fade effect on grid columns (fades at top/bottom). Default: false */
  fadeVertical?: boolean;
  /** Y-scale for horizontal grid lines. Default: primary (`"left"`) axis. */
  yAxisId?: string | number;
  /** Animate a shimmer band across horizontal grid lines. Default: false */
  shimmer?: boolean;
  /** Shimmer band stroke (color and opacity via color-mix or oklch alpha). */
  shimmerStroke?: string;
  /** Shimmer band width in pixels. Default: 140 */
  shimmerLength?: number;
  /** Shimmer speed multiplier (higher = faster). Default: 1 */
  shimmerSpeed?: number;
  /** Match loop timing to the loading line pulse (cycle + inter-loop pause). */
  shimmerSync?: boolean;
}

// Grid fade masks and shimmer share one layer tree.
export function Grid(rawProps: GridProps) {
  // RM-182: the part's definition (GRID_PART) maps renamed props (no rows until wave 4)
  // and fills its defaults before anything reads them.
  const {
    mode,
    horizontal: horizontalProp,
    vertical: verticalProp,
    numTicksRows: numTicksRowsProp,
    numTicksColumns,
    rowTickValues,
    stroke,
    loadingStroke,
    strokeOpacity,
    strokeWidth,
    strokeDasharray,
    highlightRowValues,
    highlightRowStroke,
    highlightRowStrokeOpacity,
    highlightRowStrokeWidth,
    highlightRowStrokeDasharray,
    highlightRowLabel,
    highlightColumnValues,
    highlightColumnStroke,
    highlightColumnStrokeOpacity,
    highlightColumnStrokeWidth,
    highlightColumnStrokeDasharray,
    highlightColumnLabel,
    fadeHorizontal,
    fadeVertical,
    yAxisId,
    shimmer,
    shimmerStroke,
    shimmerLength,
    shimmerSpeed,
    shimmerSync,
  } = useResolvedChartProps(GRID_PART, rawProps);
  const {
    xScale,
    innerWidth: rawInnerWidth,
    innerHeight: rawInnerHeight,
    orientation,
    barScale,
    chartPhase,
    xValueToPosition,
  } = useChartStable();
  // A tile narrower/shorter than its own margins (#599) can hand this a
  // negative measurement before the shell that computed it clamps — guard
  // here too so the fade-mask `<rect>`s never receive one, independent of
  // the upstream shell.
  const innerWidth = Math.max(0, rawInnerWidth);
  const innerHeight = Math.max(0, rawInnerHeight);
  const yScale = useYScale(yAxisId);
  const numTicksRows = numTicksRowsProp ?? tickTargetForHeight(innerHeight);
  // The same generator `YAxis` uses, so a log axis' rows match its labels.
  const rowTicks = rowTickValues ?? valueAxisTicks(yScale, numTicksRows);
  // RM-108: `ticks` swaps full rules for short edge hairlines; `off` paints no furniture.
  const horizontal = mode === "lines" && horizontalProp;
  const vertical = mode === "lines" && verticalProp;
  const tickRows = mode === "ticks" && horizontalProp;
  const tickColumns = mode === "ticks" && verticalProp;
  const shimmerActive = shimmer && isLoadingChromePhase(chartPhase);
  const gridStroke =
    isLoadingGridChromePhase(chartPhase) && loadingStroke != null ? loadingStroke : stroke;
  const { shimmerEnabled, shimmerTransform } = useGridShimmer({
    innerWidth,
    shimmer,
    shimmerLength,
    shimmerSpeed,
    shimmerSync,
    active: shimmerActive,
  });

  // For bar charts, determine which scale to use for grid lines
  // Horizontal bar charts: vertical grid should use yScale (value scale)
  // Vertical bar charts: horizontal grid uses yScale (value scale)
  const isHorizontalBarChart = orientation === "horizontal" && barScale;

  // For vertical grid lines in horizontal bar charts, use yScale (the value scale)
  // For time-based charts, use xScale
  const columnScale = isHorizontalBarChart ? yScale : xScale;
  const uniqueId = useId();

  // Horizontal fade mask (for grid rows - fades left/right)
  const hMaskId = `grid-rows-fade-${uniqueId}`;
  const hGradientId = `${hMaskId}-gradient`;
  const shimmerGradientId = `grid-shimmer-${uniqueId}`;

  // Vertical fade mask (for grid columns - fades top/bottom)
  const vMaskId = `grid-cols-fade-${uniqueId}`;
  const vGradientId = `${vMaskId}-gradient`;

  return (
    <g className="chart-grid" data-grid-mode={mode}>
      {tickRows ? (
        <GridRows
          numTicks={rowTickValues ? undefined : numTicksRows}
          scale={yScale}
          stroke={gridStroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          tickValues={rowTicks}
          width={GRID_TICK_LENGTH_PX}
        />
      ) : null}
      {tickColumns && columnScale && typeof columnScale === "function" ? (
        <GridColumns
          height={GRID_TICK_LENGTH_PX}
          left={0}
          numTicks={numTicksColumns}
          scale={columnScale}
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          top={innerHeight - GRID_TICK_LENGTH_PX}
        />
      ) : null}
      {/* Gradient mask for horizontal grid lines - fades at left/right */}
      {horizontal && (fadeHorizontal || shimmer) && (
        <defs>
          <linearGradient id={hGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
          </linearGradient>
          <mask id={hMaskId}>
            <rect
              fill={`url(#${hGradientId})`}
              height={innerHeight}
              width={innerWidth}
              x="0"
              y="0"
            />
          </mask>
        </defs>
      )}

      {horizontal && shimmerEnabled ? (
        <defs>
          <motion.linearGradient
            gradientTransform={shimmerTransform}
            gradientUnits="userSpaceOnUse"
            id={shimmerGradientId}
            x1={0}
            x2={shimmerLength}
            y1={0}
            y2={0}
          >
            <stop offset="0%" stopColor={shimmerStroke} stopOpacity={0} />
            <stop offset="35%" stopColor={shimmerStroke} stopOpacity={0.45} />
            <stop offset="50%" stopColor={shimmerStroke} stopOpacity={1} />
            <stop offset="65%" stopColor={shimmerStroke} stopOpacity={0.45} />
            <stop offset="100%" stopColor={shimmerStroke} stopOpacity={0} />
          </motion.linearGradient>
        </defs>
      ) : null}

      {/* Gradient mask for vertical grid lines - fades at top/bottom */}
      {vertical && fadeVertical && (
        <defs>
          <linearGradient id={vGradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
          </linearGradient>
          <mask id={vMaskId}>
            <rect
              fill={`url(#${vGradientId})`}
              height={innerHeight}
              width={innerWidth}
              x="0"
              y="0"
            />
          </mask>
        </defs>
      )}

      {horizontal && (
        <g mask={fadeHorizontal || shimmer ? `url(#${hMaskId})` : undefined}>
          <GridRows
            numTicks={rowTickValues ? undefined : numTicksRows}
            scale={yScale}
            stroke={gridStroke}
            strokeDasharray={strokeDasharray}
            strokeOpacity={strokeOpacity}
            strokeWidth={strokeWidth}
            tickValues={rowTicks}
            width={innerWidth}
          />
          {shimmerEnabled ? (
            <GridRows
              numTicks={rowTickValues ? undefined : numTicksRows}
              scale={yScale}
              stroke={`url(#${shimmerGradientId})`}
              strokeDasharray={strokeDasharray}
              strokeOpacity={1}
              strokeWidth={strokeWidth}
              tickValues={rowTicks}
              width={innerWidth}
            />
          ) : null}
        </g>
      )}
      {horizontal && highlightRowValues && highlightRowValues.length > 0 ? (
        <g className="chart-grid-highlight-rows">
          {highlightRowValues.map((value) => {
            const y = yScale(value);
            if (y == null || !Number.isFinite(y)) {
              return null;
            }
            const label = highlightRowLabel?.(value);

            // RM-111: a highlight row is a `y` line annotation, drawn by that kind's renderer.
            return (
              <AnnotationLineMark
                axis="y"
                innerHeight={innerHeight}
                innerWidth={innerWidth}
                key={value}
                label={label}
                position={y}
                stroke={highlightRowStroke}
                strokeDasharray={highlightRowStrokeDasharray}
                strokeOpacity={highlightRowStrokeOpacity}
                strokeWidth={highlightRowStrokeWidth}
              />
            );
          })}
        </g>
      ) : null}
      {vertical && columnScale && typeof columnScale === "function" && (
        <g mask={fadeVertical ? `url(#${vMaskId})` : undefined}>
          <GridColumns
            height={innerHeight}
            numTicks={numTicksColumns}
            scale={columnScale}
            stroke={stroke}
            strokeDasharray={strokeDasharray}
            strokeOpacity={strokeOpacity}
            strokeWidth={strokeWidth}
          />
        </g>
      )}
      {highlightColumnValues && highlightColumnValues.length > 0 ? (
        <g className="chart-grid-highlight-columns">
          {highlightColumnValues.map((value) => {
            // `value` is a raw `xDataKey`-domain value (e.g. a "week" number),
            // not the row `xAccessor` normally reads — under `xScale="linear"`/
            // `"band"` it must go through the SAME synthetic projection as the
            // data, or it lands at the domain's raw-number epoch (≈ the left
            // edge) instead of its real position. `xValueToPosition` is that
            // projection; absent (e.g. `ScatterChart`), fall back to treating
            // `value` as already Date-like — the historical, `"time"`-only
            // behaviour this prop shipped with.
            const position = xValueToPosition
              ? xValueToPosition(value)
              : (value as unknown as Date);
            const x = xScale(position);
            if (x == null || !Number.isFinite(x)) {
              return null;
            }
            const label = highlightColumnLabel?.(value);
            const key = value instanceof Date ? value.getTime() : value;

            // RM-111: a highlight column is an `x` line annotation. Its label sits
            // bottom-inside, left of the line: the top strip belongs to
            // `highlightRowLabel` (end-anchored), so a column label up there
            // collides with a target label on a narrow chart.
            return (
              <AnnotationLineMark
                axis="x"
                innerHeight={innerHeight}
                innerWidth={innerWidth}
                key={key}
                label={label}
                position={x}
                stroke={highlightColumnStroke}
                strokeDasharray={highlightColumnStrokeDasharray}
                strokeOpacity={highlightColumnStrokeOpacity}
                strokeWidth={highlightColumnStrokeWidth}
              />
            );
          })}
        </g>
      ) : null}
    </g>
  );
}

Grid.displayName = "Grid";

export default Grid;
