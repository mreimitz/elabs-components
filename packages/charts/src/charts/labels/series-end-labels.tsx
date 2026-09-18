"use client";

import { motion } from "motion/react";
import { HaloText } from "../../marks/halo-text";
import { SELECTION_EXCLUDED_OPACITY } from "../chart-selection";
import { useChartSeriesMode } from "../time-series-chart-shell";
import type { LabelPlacement } from "./label-layout";
import { seriesLabelInk } from "./series-label-ink";
import {
  type ChartLabelBox,
  KEY_ROW_HEIGHT,
  KEY_SWATCH_WIDTH,
  type KeyRowItemLayout,
  LABEL_FONT_SIZE,
  LABEL_LINE_HEIGHT,
} from "./use-chart-labels";

export interface SeriesEndLabelsProps {
  /** Placed end labels (plot px), from `placeChartLabels`. */
  placements: readonly LabelPlacement<ChartLabelBox>[];
}

/**
 * Series names at the line ends (RM-110). A label the solver nudged away from
 * its line end gets a short leader back to the point, in the series' colour.
 * Ink only — `aria-hidden`; the chart's summary names every series.
 *
 * Wave-1 integration (RM-112 `focusOnHover`): each label group reads
 * `useChartSeriesMode()` directly, the same leaf-context trick
 * `SeriesHoverDim` uses on the line/area geometry itself, so a hover change
 * re-renders only this component — never the memoised label-placement
 * solver above it (`ChartSeriesModeProvider`'s docblock in
 * `../time-series-chart-shell`). When a series is dimmed to
 * `SELECTION_EXCLUDED_OPACITY`, its end label dims to the same opacity, on
 * the same tween, so the label never outshines its own now-faded line.
 */
export function SeriesEndLabels({ placements }: SeriesEndLabelsProps) {
  const { focusOnHover, hoveredKey } = useChartSeriesMode();
  if (placements.length === 0) return null;
  return (
    <g aria-hidden="true" data-slot="series-end-labels">
      {placements.map((p) => {
        const midY = p.y + LABEL_LINE_HEIGHT / 2;
        const isDimmed = focusOnHover && hoveredKey !== null && hoveredKey !== p.label.dataKey;
        return (
          <motion.g
            animate={{ opacity: isDimmed ? SELECTION_EXCLUDED_OPACITY : 1 }}
            data-series={p.label.dataKey}
            initial={{ opacity: 1 }}
            key={p.id}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <line
              stroke={p.label.stroke}
              strokeLinecap="round"
              strokeWidth={1.5}
              x1={p.label.anchorX + 1}
              x2={p.x - 1}
              y1={p.label.anchorY}
              y2={midY}
            />
            <HaloText
              data-slot="series-end-label"
              dominantBaseline="central"
              fill={seriesLabelInk(p.label.stroke)}
              fontSize={LABEL_FONT_SIZE}
              x={p.x}
              y={midY}
            >
              {p.label.text}
            </HaloText>
          </motion.g>
        );
      })}
    </g>
  );
}

export interface SeriesKeyRowProps {
  items: readonly KeyRowItemLayout[];
  /** Top of the key band relative to the plot's top edge (negative: inside the top margin), px. */
  top: number;
}

/**
 * The key fallback (RM-110): when end labels do not fit (`seriesLabel` resolves
 * to `"key"`, by default at `narrow` beside a `ChartLegend`), each series' name
 * moves into a swatch row painted above the plot. Ink only — `aria-hidden`.
 */
export function SeriesKeyRow({ items, top }: SeriesKeyRowProps) {
  if (items.length === 0) return null;
  return (
    <g aria-hidden="true" data-slot="series-key" transform={`translate(0,${top})`}>
      {items.map((item) => {
        const cy = item.row * KEY_ROW_HEIGHT + KEY_ROW_HEIGHT / 2;
        return (
          <g data-series={item.dataKey} data-slot="series-key-item" key={item.dataKey}>
            <line
              stroke={item.stroke}
              strokeLinecap="round"
              strokeWidth={2.5}
              x1={item.x + 1}
              x2={item.x + KEY_SWATCH_WIDTH - 5}
              y1={cy}
              y2={cy}
            />
            <HaloText
              dominantBaseline="central"
              fill={seriesLabelInk(item.stroke)}
              fontSize={LABEL_FONT_SIZE}
              x={item.x + KEY_SWATCH_WIDTH}
              y={cy}
            >
              {item.name}
            </HaloText>
          </g>
        );
      })}
    </g>
  );
}
