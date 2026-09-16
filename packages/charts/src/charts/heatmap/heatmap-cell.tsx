"use client";

/**
 * heatmap-cell.tsx — one cell of a `HeatmapChart` (RM-021).
 *
 * ## Why every cell is a `<g>` with an `animation-delay`, and not a motion node
 *
 * A 7×24 punch card is 168 cells and a year calendar is 365. Wrapping each one
 * in a `motion` component means that many independent animation drivers, each
 * with its own subscription and its own commit — which is how a chart that
 * looks trivial ends up missing frames. So the stagger is a plain CSS
 * `animation-delay` on the cell's `<g>`, the same technique the editorial marks
 * layer uses (`stagger()` in `packages/charts/src/marks/stagger.ts`) and the
 * same one every drawn-in lieflat card uses. The whole reveal costs one class
 * string and one inline `animationDelay` per cell, and the browser runs it off
 * the main thread.
 *
 * The delay is `(column + row) * step`, so the wave crosses the grid
 * diagonally from the top-left rather than sweeping row by row — that is what
 * makes a matrix read as being drawn rather than as being scanned.
 *
 * ## The cell is decorative; the value is not
 *
 * Everything here lives inside the chart's `aria-hidden` SVG. The value reaches
 * assistive tech through the accessible summary and, when the chart is
 * interactive, through the real `<button>`s of `ChartDatapointLayer` — never
 * through the square.
 */

import { forwardRef, memo, type SVGProps } from "react";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { PeakRing } from "../../marks/peak-ring";
import { QuietDot } from "../../marks/quiet-dot";
import { HaloText } from "../../marks/halo-text";
import { useHeatmap } from "./heatmap-context";
import type { HeatmapCellDatum } from "./heatmap-context";
import { dotRadius } from "./heatmap-scale";

/**
 * Enter animation for one cell. `fill-mode-both` holds the start state through
 * the stagger delay so a late cell does not flash in at full opacity first, and
 * `motion-reduce:animate-none` drops the whole thing to the finished state —
 * there is nothing to "reduce" about a fade, so it is removed rather than
 * shortened.
 */
const CELL_ENTER_CLASS =
  "animate-in fade-in zoom-in-75 fill-mode-both duration-base ease-entrance motion-reduce:animate-none";

/** Smallest legible in-cell value label. Below this the label is dropped. */
const MIN_VALUE_LABEL_PX = 8;

/** Largest in-cell value label — a big cell should not grow a headline. */
const MAX_VALUE_LABEL_PX = 13;

/**
 * Default side of the no-data outline, as a fraction of the cell's shorter
 * side. Overridable per chart via `HeatmapChartProps.emptyMarkScale` (#280).
 */
export const DEFAULT_EMPTY_MARK_SCALE = 0.6;

/**
 * The no-data mark: a hairline outline in the grid ink with nothing inside it —
 * the cell is there, its value is not. Shared with the legend key so the key
 * and the plot can never drift apart. A different SHAPE from the zero pinprick
 * and from the diverging hatch, so no colour is needed to tell them apart.
 */
export const HeatmapMissingMark = forwardRef<
  SVGRectElement,
  Omit<SVGProps<SVGRectElement>, "fill" | "stroke" | "ref">
>(function HeatmapMissingMark(props, ref) {
  return (
    <rect
      aria-hidden="true"
      data-slot="heatmap-missing-mark"
      fill="none"
      ref={ref}
      stroke="var(--chart-grid)"
      strokeWidth={CHART_HAIRLINE_WIDTH}
      {...props}
    />
  );
});

export interface HeatmapCellProps {
  /** The laid-out cell to draw. */
  cell: HeatmapCellDatum;
}

export const HeatmapCell = memo(function HeatmapCell({ cell }: HeatmapCellProps) {
  const {
    mode,
    emptyValue,
    cellRadius,
    showValues,
    showValueHalo,
    emptyMarkScale,
    maxAbs,
    dotMaxRadius,
    formatValue,
    setHovered,
    revealed,
    staggerMs,
    negativeHatchId,
    activateCell,
  } = useHeatmap();

  const cx = cell.x0 + cell.width / 2;
  const cy = cell.y0 + cell.height / 2;
  // Zero is not missing (#251). A `0` was measured and came back flat — the
  // `QuietDot` pinprick. A `null` was never measured — a hairline outline of
  // the empty cell. Two shapes, so the pair survives greyscale and a chart
  // with its value labels turned off.
  const isEmpty = cell.state !== "value";
  const isNegative = cell.value !== null && cell.value < 0;
  const radius = cell.value === null ? 0 : dotRadius(cell.value, maxAbs, dotMaxRadius);
  const labelSize = Math.min(cell.height * 0.42, cell.width * 0.34, MAX_VALUE_LABEL_PX);
  // Inset so the outline reads as "this cell is empty", not as grid furniture
  // touching its neighbours.
  const missingSide = Math.max(0, Math.min(cell.width, cell.height) * emptyMarkScale);

  return (
    <g
      className={revealed ? CELL_ENTER_CLASS : "opacity-0"}
      data-slot="heatmap-cell"
      data-heatmap-cell={cell.id}
      data-state={cell.state}
      data-peak={cell.isPeak ? "" : undefined}
      onClick={activateCell ? (event) => activateCell(cell, event) : undefined}
      onMouseEnter={() => setHovered(cell)}
      style={{
        animationDelay: revealed ? `${(cell.column + cell.row) * staggerMs}ms` : undefined,
        // A CSS transform on an SVG element is resolved against the user-space
        // origin unless `fill-mode`'s box is named, which would scale every cell
        // out of the top-left corner of the chart instead of its own centre.
        transformBox: "fill-box",
        transformOrigin: "center",
      }}
    >
      {/* The hover/pointer surface. Always present — including on an empty cell,
          so the tooltip can say "0" instead of leaving the reader to guess what
          a pinprick means. */}
      <rect fill="transparent" height={cell.height} width={cell.width} x={cell.x0} y={cell.y0} />

      {isEmpty ? (
        emptyValue === "quiet" ? (
          cell.state === "zero" ? (
            <QuietDot cx={cx} cy={cy} />
          ) : (
            // A full circle at every size (#280) — clamping rx to `cellRadius`
            // made a LARGE cell's mark read as a squared-off outline while a
            // small one rounded down to a circle, so the same chart looked
            // like two different marks depending on cell size. One shape,
            // always: the ring, never the corners, carries "no data".
            <HeatmapMissingMark
              height={missingSide}
              rx={missingSide / 2}
              width={missingSide}
              x={cx - missingSide / 2}
              y={cy - missingSide / 2}
            />
          )
        ) : null
      ) : mode === "cell" ? (
        <rect
          fill={cell.color ?? "none"}
          fillOpacity={cell.fillOpacity}
          height={cell.height}
          rx={Math.min(cellRadius, cell.width / 2, cell.height / 2)}
          width={cell.width}
          x={cell.x0}
          y={cell.y0}
        />
      ) : (
        <circle
          cx={cx}
          cy={cy}
          fill={cell.color ?? "none"}
          fillOpacity={cell.fillOpacity}
          r={radius}
        />
      )}

      {/* The diverging ramp's second, non-hue channel (WCAG 1.4.1). See
          `heatmap-chart.tsx` — in greyscale a `-1` and a `+1` step are
          indistinguishable by construction, so sign gets a texture. */}
      {negativeHatchId && isNegative ? (
        mode === "cell" ? (
          <rect
            fill={`url(#${negativeHatchId})`}
            height={cell.height}
            rx={Math.min(cellRadius, cell.width / 2, cell.height / 2)}
            width={cell.width}
            x={cell.x0}
            y={cell.y0}
          />
        ) : (
          <circle cx={cx} cy={cy} fill={`url(#${negativeHatchId})`} r={radius} />
        )
      ) : null}

      {showValues && cell.value !== null && labelSize >= MIN_VALUE_LABEL_PX ? (
        <HaloText
          dominantBaseline="central"
          fill={cell.ink}
          fontSize={labelSize}
          halo={cell.inkHalo}
          haloWidth={showValueHalo ? undefined : 0}
          textAnchor="middle"
          x={cx}
          y={cy}
        >
          {formatValue(cell.value)}
        </HaloText>
      ) : null}

      {cell.isPeak ? (
        <PeakRing
          cx={cx}
          cy={cy}
          r={
            mode === "cell"
              ? Math.min(cell.width, cell.height) / 2
              : Math.max(radius + 2.5, Math.min(cell.width, cell.height) / 4)
          }
          shape={mode === "cell" ? "square" : "circle"}
        />
      ) : null}
    </g>
  );
});

HeatmapCell.displayName = "HeatmapCell";
