"use client";

import { svgIdPart } from "./svg-id";
import { curveLinear } from "@visx/curve";
import { LinePath } from "@visx/shape";
import { useCallback, useId, useMemo } from "react";
import { useChart, useChartStable } from "./chart-context";
import { type CurveAlias, type CurveFactory, resolveCurve } from "./curve-types";
import { type FadeEdges, fadeGradientStops, resolveFadeSides } from "./fade-edges";
import { useProfitLossLegendHover } from "./profit-loss-legend-hover";
import { splitProfitLossSegments } from "./profit-loss-segments";

export const PROFIT_LOSS_POSITIVE_COLOR = "var(--success)";
export const PROFIT_LOSS_NEGATIVE_COLOR = "var(--destructive)";

const LEGEND_DIM_OPACITY = 0.25;

export function profitLossColor(value: number) {
  return value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;
}

export const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

export function resolveProfitLossTooltipLabel(label: string) {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

export interface ProfitLossLineProps {
  dataKey: string;
  xDataKey?: string;
  strokeWidth?: number;
  positiveColor?: string;
  negativeColor?: string;
  /**
   * Curve between points: a named alias (RM-196, ADR 0042 A.7 — same vocabulary as
   * `Line`/`Area`/`AreaBand`'s `curve`, resolved through the same `resolveCurve`) or a raw
   * d3/visx curve factory. Default: `curveLinear`.
   */
  curve?: CurveFactory | CurveAlias;
  /**
   * Fade the line stroke toward transparent at the chart edges.
   * Default: false
   */
  fadeEdges?: FadeEdges;
}

function segmentLegendIndex(isPositive: boolean) {
  return isPositive ? 0 : 1;
}

export function ProfitLossLine({
  dataKey,
  xDataKey = "date",
  strokeWidth = 2.5,
  positiveColor = PROFIT_LOSS_POSITIVE_COLOR,
  negativeColor = PROFIT_LOSS_NEGATIVE_COLOR,
  curve = curveLinear,
  fadeEdges = false,
}: ProfitLossLineProps) {
  const { tooltipData } = useChart();
  const { hoveredIndex } = useProfitLossLegendHover();
  const { renderData, xScale, yScale, xAccessor, innerWidth } = useChartStable();
  const reactId = useId();
  const fadeSides = resolveFadeSides(fadeEdges);
  const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : null;
  const positiveGradientId = `profit-loss-gradient-pos-${svgIdPart(dataKey)}-${reactId}`;
  const negativeGradientId = `profit-loss-gradient-neg-${svgIdPart(dataKey)}-${reactId}`;

  const focusedLegendIndex = useMemo(() => {
    if (hoveredIndex !== null) {
      return hoveredIndex;
    }
    if (!tooltipData) {
      return null;
    }
    const value = tooltipData.point[dataKey];
    if (typeof value !== "number") {
      return null;
    }
    return segmentLegendIndex(value >= 0);
  }, [dataKey, hoveredIndex, tooltipData]);

  const segments = useMemo(
    () =>
      splitProfitLossSegments({
        data: renderData,
        dataKey,
        xDataKey,
        xAccessor,
      }),
    [dataKey, renderData, xAccessor, xDataKey],
  );

  const getX = useCallback(
    (d: Record<string, unknown>) => xScale(xAccessor(d)) ?? 0,
    [xAccessor, xScale],
  );

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [dataKey, yScale],
  );

  return (
    <>
      {fadeStops ? (
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={positiveGradientId}
            x1={0}
            x2={innerWidth}
            y1={0}
            y2={0}
          >
            {fadeStops.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                style={{
                  stopColor: positiveColor,
                  stopOpacity: stop.opacity,
                }}
              />
            ))}
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={negativeGradientId}
            x1={0}
            x2={innerWidth}
            y1={0}
            y2={0}
          >
            {fadeStops.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                style={{
                  stopColor: negativeColor,
                  stopOpacity: stop.opacity,
                }}
              />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      {segments.map((segment) => {
        const isDimmed =
          focusedLegendIndex !== null &&
          focusedLegendIndex !== segmentLegendIndex(segment.isPositive);
        const firstPoint = segment.data[0];
        const lastPoint = segment.data.at(-1);
        const segmentKey = `${dataKey}-${segment.isPositive ? "pos" : "neg"}-${String(firstPoint?.[xDataKey])}-${String(lastPoint?.[xDataKey])}`;
        const stroke = segment.isPositive ? positiveColor : negativeColor;
        const segmentStroke = fadeStops
          ? `url(#${segment.isPositive ? positiveGradientId : negativeGradientId})`
          : stroke;

        return (
          <g
            key={segmentKey}
            opacity={isDimmed ? LEGEND_DIM_OPACITY : 1}
            style={{ transition: "opacity var(--t-base) var(--ease-standard)" }}
          >
            <LinePath
              curve={resolveCurve(curve)}
              data={segment.data}
              stroke={segmentStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth}
              x={getX}
              y={getY}
            />
          </g>
        );
      })}
    </>
  );
}

ProfitLossLine.displayName = "ProfitLossLine";
