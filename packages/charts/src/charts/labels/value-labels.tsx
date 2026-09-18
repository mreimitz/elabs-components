"use client";

import { HaloText } from "../../marks/halo-text";
import { chartCssVars } from "../chart-context";
import { StaticSeriesPointMarker } from "../series-point-marker";
import type { LabelPlacement } from "./label-layout";
import { type ChartLabelBox, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "./use-chart-labels";

export interface ValueLabelsProps {
  /** Placed value labels (plot px), from `placeChartLabels`. */
  placements: readonly LabelPlacement<ChartLabelBox>[];
}

/** Baseline of a label inside its solver box. */
const BASELINE_INSET = 3;

/**
 * Automatic value labels (RM-110): first / last / all / peaks of a series, a
 * marker at each labelled point and the formatted value above it. Grouped per
 * series under the spec's `data-slot` (`line-peak-labels` for the
 * `labelPeaks` alias, `line-value-labels` otherwise). Ink only — `aria-hidden`.
 */
export function ValueLabels({ placements }: ValueLabelsProps) {
  if (placements.length === 0) return null;
  const groups = new Map<string, LabelPlacement<ChartLabelBox>[]>();
  for (const p of placements) {
    const list = groups.get(p.label.dataKey) ?? [];
    list.push(p);
    groups.set(p.label.dataKey, list);
  }
  return (
    <>
      {[...groups.entries()].map(([dataKey, list]) => {
        const spec = list[0]?.label.spec;
        if (!spec) return null;
        const ink = spec.matchColor ? list[0]?.label.stroke : chartCssVars.foreground;
        return (
          <g aria-hidden="true" data-series={dataKey} data-slot={spec.slot} key={dataKey}>
            {list.map((p) => {
              const x = p.x + p.label.width / 2;
              const y = p.y + LABEL_LINE_HEIGHT - BASELINE_INSET;
              return (
                <g key={p.id}>
                  <StaticSeriesPointMarker
                    cx={p.label.anchorX}
                    cy={p.label.anchorY}
                    fill={p.label.stroke}
                    radius={spec.markerRadius}
                    ringGap={0}
                    stroke={p.label.stroke}
                    strokeWidth={0}
                  />
                  {spec.outline ? (
                    <HaloText fill={ink} fontSize={LABEL_FONT_SIZE} textAnchor="middle" x={x} y={y}>
                      {p.label.text}
                    </HaloText>
                  ) : (
                    <text
                      aria-hidden="true"
                      fill={ink}
                      fontSize={LABEL_FONT_SIZE}
                      textAnchor="middle"
                      x={x}
                      y={y}
                    >
                      {p.label.text}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}
