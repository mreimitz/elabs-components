"use client";

import { HaloText } from "../../marks/halo-text";
import type { LabelPlacement } from "./label-layout";
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
 */
export function SeriesEndLabels({ placements }: SeriesEndLabelsProps) {
  if (placements.length === 0) return null;
  return (
    <g aria-hidden="true" data-slot="series-end-labels">
      {placements.map((p) => {
        const midY = p.y + LABEL_LINE_HEIGHT / 2;
        return (
          <g data-series={p.label.dataKey} key={p.id}>
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
              fontSize={LABEL_FONT_SIZE}
              x={p.x}
              y={midY}
            >
              {p.label.text}
            </HaloText>
          </g>
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
