"use client";

import { Area as VisxArea } from "@visx/shape";
import { useCallback } from "react";
import { useChartStable, useYScale } from "./chart-context";
import { type CurveAlias, type CurveFactory, resolveCurve } from "./curve-types";

export interface AreaBandProps {
  /**
   * Key in data for the band's lower edge. Ignored (and optional) when
   * `from="zero"` — the low edge is the value-axis zero line instead.
   */
  lowKey?: string;
  /** Key in data for the band's upper edge. */
  highKey: string;
  /**
   * Bracket the band between `highKey` and the value-axis zero line instead
   * of a second series (Datawrapper: area fill "between a line and zero").
   * `lowKey` is ignored when set.
   */
  from?: "zero";
  /**
   * Fill colour. Default `var(--chart-ring-background)` — the same quiet
   * "normal range" wash `Sparkline`'s `band` prop already draws with.
   */
  fill?: string;
  /** Fill opacity. Default 1 — the token itself already carries the wash. */
  fillOpacity?: number;
  /**
   * Fill colour for any segment where the high edge dips BELOW the low edge
   * (`highKey < lowKey`, or `highKey < 0` under `from="zero"`) —
   * Datawrapper's negative-difference fill (River bar-line combination
   * recipe). Unset: the whole band paints `fill` regardless of sign —
   * today's behaviour.
   */
  negativeFill?: string;
  /** Curve function, matching the series it brackets. Default `curveMonotoneX`. */
  curve?: CurveFactory | CurveAlias;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  className?: string;
}

/**
 * A shaded region between two data keys at the same x — a confidence
 * interval, a forecast range, a "normal operating range" on a full axis
 * chart, or (`from="zero"`) a single series against the zero line.
 * `Sparkline`'s `band` is the word-sized equivalent of this same idea; this
 * is the `LineChart`/`AreaChart` version, for when the range itself needs to
 * widen or narrow over time instead of staying one fixed `[lo, hi]`.
 *
 * Pure furniture: no stroke, no legend entry, no tooltip row, `aria-hidden`
 * on its own root like every mark in `../marks` (RM-017) — state the range
 * in the chart's `accessibleDescription` or a caption instead, never rely on
 * this shape alone to carry the fact.
 */
export function AreaBand({
  lowKey,
  highKey,
  from,
  fill = "var(--chart-ring-background)",
  fillOpacity = 1,
  negativeFill,
  curve = "monotone",
  yAxisId,
  className,
}: AreaBandProps) {
  const { renderData, xScale, xAccessor } = useChartStable();
  const yScale = useYScale(yAxisId);
  const resolvedCurve = resolveCurve(curve);

  const getX = useCallback(
    (d: Record<string, unknown>) => xScale(xAccessor(d)) ?? 0,
    [xScale, xAccessor],
  );
  const getLow = useCallback(
    (d: Record<string, unknown>) => {
      if (from === "zero") {
        return yScale(0) ?? 0;
      }
      const value = lowKey ? d[lowKey] : undefined;
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [from, lowKey, yScale],
  );
  const getHigh = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[highKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [highKey, yScale],
  );

  // Sign of `high - low` in DATA units (never pixels — pixel y is inverted).
  // `null` when either edge is missing for this row.
  const getDiff = useCallback(
    (d: Record<string, unknown>) => {
      const highValue = d[highKey];
      const lowValue = from === "zero" ? 0 : lowKey ? d[lowKey] : undefined;
      if (typeof highValue !== "number" || typeof lowValue !== "number") {
        return null;
      }
      return highValue - lowValue;
    },
    [highKey, lowKey, from],
  );
  const isPositiveSegment = useCallback(
    (d: Record<string, unknown>) => {
      const diff = getDiff(d);
      return diff !== null && diff >= 0;
    },
    [getDiff],
  );
  const isNegativeSegment = useCallback(
    (d: Record<string, unknown>) => {
      const diff = getDiff(d);
      return diff !== null && diff < 0;
    },
    [getDiff],
  );

  return (
    <g aria-hidden="true" className={className} data-slot="area-band">
      {negativeFill ? (
        <>
          <VisxArea
            curve={resolvedCurve}
            data={renderData}
            defined={isPositiveSegment}
            fill={fill}
            fillOpacity={fillOpacity}
            x={getX}
            y0={getLow}
            y1={getHigh}
          />
          <VisxArea
            curve={resolvedCurve}
            data={renderData}
            defined={isNegativeSegment}
            fill={negativeFill}
            fillOpacity={fillOpacity}
            x={getX}
            y0={getLow}
            y1={getHigh}
          />
        </>
      ) : (
        <VisxArea
          curve={resolvedCurve}
          data={renderData}
          fill={fill}
          fillOpacity={fillOpacity}
          x={getX}
          y0={getLow}
          y1={getHigh}
        />
      )}
    </g>
  );
}

AreaBand.displayName = "AreaBand";

export default AreaBand;
