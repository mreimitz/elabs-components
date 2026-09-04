"use client";

/**
 * histogram.tsx — the `kind="histogram"` mark (RM-026).
 *
 * Provenance: `F14 Rung Histogram`. Two readings of the same bins:
 *
 * - **bars** (default) — one rect per bin, the ordinary reading;
 * - **rungs** (`unit` set) — each bin drawn as `count / unit` countable rungs
 *   via {@link UnitStack}, so the reader COUNTS the bin instead of comparing
 *   two heights. That is the card's editorial trick and the reason `unit` is a
 *   number rather than a boolean: the number is the legend ("one rung = 5
 *   tickets").
 *
 * The dashed median flag is the second half of the card: a histogram tells you
 * the shape but not the middle, and the flag puts the middle ON the shape
 * instead of in a caption.
 */
import { memo } from "react";
import { UnitStack } from "../../../marks";
import { chartCssVars } from "../../chart-context";
import type { DistributionBin } from "../bins";
import type { DistributionKindProps } from "../distribution-kind";

/** Cross-axis room a bar/rung stack may use, as a fraction of the band's inner extent. */
const COUNT_FRACTION = 0.86;

/** Gap between neighbouring bins, in px, so the bins stay countable as bins. */
const BIN_GAP = 1;

/** Rung spacing is clamped to this range so a stack is neither a blur nor a comb. */
const MIN_RUNG_STEP = 1.6;
const MAX_RUNG_STEP = 6;

export interface DistributionHistogramProps extends DistributionKindProps {
  /** The SHARED bins — identical edges for every group, computed by the container. */
  bins: DistributionBin[];
  /** The largest bin count across ALL groups, so every group is drawn on one count scale. */
  countMax: number;
  /** Records per rung. Unset draws ordinary bars. */
  unit?: number;
}

function DistributionHistogramImpl({
  bins,
  color,
  countMax,
  formatValue,
  geometry,
  group,
  onHover,
  showMedian,
  unit,
}: DistributionHistogramProps) {
  const horizontal = geometry.orientation === "horizontal";
  const base = geometry.baseline(group.index);
  const room = geometry.bandInner * COUNT_FRACTION;
  const scaleCount = (count: number) => (countMax > 0 ? (count / countMax) * room : 0);
  const rungTotal = unit && unit > 0 ? Math.max(1, Math.ceil(countMax / unit)) : 0;
  const rungStep =
    rungTotal > 0
      ? Math.min(MAX_RUNG_STEP, Math.max(MIN_RUNG_STEP, room / rungTotal))
      : MIN_RUNG_STEP;

  return (
    <g data-slot="distribution-chart-histogram">
      {bins.map((bin, binIndex) => {
        const a = geometry.valuePos(bin.x0);
        const b = geometry.valuePos(bin.x1);
        const lo = Math.min(a, b);
        const thickness = Math.max(1, Math.abs(b - a) - BIN_GAP);
        const centre = (a + b) / 2;
        const length = scaleCount(bin.count);
        const enter = () =>
          onHover({
            ...toPlot(horizontal, centre, base - (geometry.countSign === -1 ? length : -length)),
            title: `${formatValue(bin.x0)} – ${formatValue(bin.x1)}`,
            rows: [{ color, label: "Records", value: bin.count }],
          });

        return (
          <g
            key={`${bin.x0}-${bin.x1}`}
            onPointerEnter={enter}
            onPointerLeave={() => onHover(null)}
          >
            {/* A full-band hit area, so the pointer finds a short bin too. */}
            <rect
              fill="transparent"
              height={horizontal ? geometry.bandInner : thickness}
              width={horizontal ? thickness : geometry.bandInner}
              x={horizontal ? lo : base}
              y={horizontal ? base - geometry.bandInner : lo}
            />
            {unit && unit > 0 ? (
              <UnitStack
                direction={horizontal ? "up" : "right"}
                jitter
                kind="rung"
                length={thickness}
                n={Math.round(bin.count / unit)}
                seed={group.index * 31 + binIndex}
                step={rungStep}
                stroke={color}
                strokeWidth={1.25}
                x={horizontal ? centre : base}
                y={horizontal ? base : centre}
              />
            ) : (
              <rect
                fill={color}
                height={horizontal ? length : thickness}
                opacity={0.86}
                width={horizontal ? thickness : length}
                x={horizontal ? lo : base}
                y={horizontal ? base - length : lo}
              />
            )}
          </g>
        );
      })}

      {showMedian && group.summary ? (
        <MedianFlag
          base={base}
          formatValue={formatValue}
          horizontal={horizontal}
          inner={geometry.bandInner}
          median={group.summary.median}
          position={geometry.valuePos(group.summary.median)}
        />
      ) : null}
    </g>
  );
}

/** Resolve a (value-axis, cross-axis) pair onto screen coordinates. */
function toPlot(horizontal: boolean, value: number, cross: number): { x: number; y: number } {
  return horizontal ? { x: value, y: cross } : { x: cross, y: value };
}

/**
 * The dashed median flag. It is a DASHED line on purpose: a solid hairline in a
 * plot of solid bars reads as another bin edge, and the whole point is that the
 * median is an annotation, not part of the data.
 */
function MedianFlag({
  base,
  formatValue,
  horizontal,
  inner,
  median,
  position,
}: {
  base: number;
  formatValue: (value: number) => string;
  horizontal: boolean;
  inner: number;
  median: number;
  position: number;
}) {
  const far = horizontal ? base - inner : base + inner;
  return (
    <g data-slot="distribution-chart-median">
      <line
        stroke={chartCssVars.foreground}
        strokeDasharray="3 3"
        strokeWidth={1}
        x1={horizontal ? position : base}
        x2={horizontal ? position : far}
        y1={horizontal ? base : position}
        y2={horizontal ? far : position}
      />
      <text
        className="text-meta"
        fill={chartCssVars.label}
        textAnchor={horizontal ? "middle" : "start"}
        x={horizontal ? position : far + 4}
        y={horizontal ? far - 4 : position - 4}
      >
        {formatValue(median)}
      </text>
    </g>
  );
}

/**
 * Memoized: a hover anywhere in the chart re-renders the container's tooltip
 * state, and a histogram of a few thousand records must not redraw with it.
 */
export const DistributionHistogram = memo(DistributionHistogramImpl);
DistributionHistogram.displayName = "DistributionHistogram";
