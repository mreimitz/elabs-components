"use client";

import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import { HaloText } from "../marks/halo-text";
import { seededRnd } from "../marks/seeded-rnd";

export interface HairlineAreaProps {
  /** Key in data to use for y values. */
  dataKey: string;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Ink color for hairlines + peak mark. Default: `var(--chart-foreground)`. */
  stroke?: string;
  /**
   * Seed for the deterministic per-sample opacity jitter (default 0) — vary it
   * per series (e.g. the series index) so neighbouring single-series charts on
   * one page don't jitter in lockstep. See `seededRnd`.
   */
  seed?: number;
  /** Ring the peak sample with a filled dot + value label. Default: false. */
  labelPeaks?: boolean;
}

/**
 * HairlineArea — the high-decoration rendering for a SINGLE-series `Area`
 * (ADR 0011 / issue #164, RM-029): one 0.55px vertical hairline per sample,
 * from the floor to the value, opacity seeded 0.3–1 — lieflat's F3 Hairline
 * Area ("the area is made of days, not paint"). `Area` swaps this in for its
 * usual pattern-fill decoration when it is the chart's only series; the
 * existing crest stroke (`Area`'s own `LinePath`) is forced to 1.2px and the
 * series' own solid color ("peak in ink") for the same reason — see `Area`'s
 * `useHairline` branch.
 *
 * Multi-series areas keep the pattern-fill decoration instead: a field of
 * hairlines only reads cleanly for one series — with two or more overlapping
 * fields it degenerates into noise, which is why this component is never used
 * when `lines.length > 1`.
 *
 * Decorative and `aria-hidden`, like every mark in `../marks/` — the values
 * reach AT through the chart's own summary/description, not through the ink.
 */
export function HairlineArea({
  dataKey,
  yAxisId,
  stroke,
  seed = 0,
  labelPeaks = false,
}: HairlineAreaProps) {
  const { renderData, xScale, innerHeight, xAccessor } = useChartStable();
  const yScale = useYScale(yAxisId);
  const ink = stroke || chartCssVars.foreground;

  const getX = (d: Record<string, unknown>) => xScale(xAccessor(d)) ?? 0;
  const getValue = (d: Record<string, unknown>) => {
    const v = d[dataKey];
    return typeof v === "number" ? v : 0;
  };
  const getY = (d: Record<string, unknown>) => yScale(getValue(d)) ?? innerHeight;
  const floorY = yScale(0) ?? innerHeight;

  let peakIndex = -1;
  let peakValue = Number.NEGATIVE_INFINITY;
  if (labelPeaks) {
    renderData.forEach((d, i) => {
      const v = getValue(d);
      if (v > peakValue) {
        peakValue = v;
        peakIndex = i;
      }
    });
  }
  const peakDatum = peakIndex >= 0 ? renderData[peakIndex] : undefined;

  return (
    <g aria-hidden="true" data-slot="hairline-area">
      {renderData.map((d, i) => {
        const x = getX(d);
        const y = getY(d);
        const opacity = 0.3 + 0.7 * seededRnd(i, seed);
        return (
          <line
            key={i}
            opacity={opacity}
            stroke={ink}
            strokeWidth={0.55}
            x1={x}
            x2={x}
            y1={floorY}
            y2={y}
          />
        );
      })}
      {peakDatum ? (
        <>
          <circle
            cx={getX(peakDatum)}
            cy={getY(peakDatum)}
            data-slot="hairline-area-peak"
            fill={ink}
            r={2.5}
          />
          <HaloText
            fill={ink}
            fontSize={11}
            textAnchor="middle"
            x={getX(peakDatum)}
            y={getY(peakDatum) - 8}
          >
            {peakValue.toLocaleString()}
          </HaloText>
        </>
      ) : null}
    </g>
  );
}

HairlineArea.displayName = "HairlineArea";

export default HairlineArea;
