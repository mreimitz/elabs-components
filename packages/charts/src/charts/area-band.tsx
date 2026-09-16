"use client";

import { curveMonotoneX } from "@visx/curve";
import { Area as VisxArea } from "@visx/shape";
import { useCallback } from "react";
import { useChartStable, useYScale } from "./chart-context";
import type { CurveFactory } from "./curve-types";

export interface AreaBandProps {
  /** Key in data for the band's lower edge. */
  lowKey: string;
  /** Key in data for the band's upper edge. */
  highKey: string;
  /**
   * Fill colour. Default `var(--chart-ring-background)` — the same quiet
   * "normal range" wash `Sparkline`'s `band` prop already draws with.
   */
  fill?: string;
  /** Fill opacity. Default 1 — the token itself already carries the wash. */
  fillOpacity?: number;
  /** Curve function, matching the series it brackets. Default `curveMonotoneX`. */
  curve?: CurveFactory;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  className?: string;
}

/**
 * A shaded region between two data keys at the same x — a confidence
 * interval, a forecast range, a "normal operating range" on a full axis
 * chart. `Sparkline`'s `band` is the word-sized equivalent of this same
 * idea; this is the `LineChart`/`AreaChart` version, for when the range
 * itself needs to widen or narrow over time instead of staying one fixed
 * `[lo, hi]`.
 *
 * Pure furniture: no stroke, no legend entry, no tooltip row, `aria-hidden`
 * on its own root like every mark in `../marks` (RM-017) — state the range
 * in the chart's `accessibleDescription` or a caption instead, never rely on
 * this shape alone to carry the fact.
 */
export function AreaBand({
  lowKey,
  highKey,
  fill = "var(--chart-ring-background)",
  fillOpacity = 1,
  curve = curveMonotoneX,
  yAxisId,
  className,
}: AreaBandProps) {
  const { renderData, xScale, xAccessor } = useChartStable();
  const yScale = useYScale(yAxisId);

  const getX = useCallback(
    (d: Record<string, unknown>) => xScale(xAccessor(d)) ?? 0,
    [xScale, xAccessor],
  );
  const getLow = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[lowKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [lowKey, yScale],
  );
  const getHigh = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[highKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [highKey, yScale],
  );

  return (
    <g aria-hidden="true" className={className} data-slot="area-band">
      <VisxArea
        curve={curve}
        data={renderData}
        fill={fill}
        fillOpacity={fillOpacity}
        x={getX}
        y0={getLow}
        y1={getHigh}
      />
    </g>
  );
}

AreaBand.displayName = "AreaBand";

export default AreaBand;
