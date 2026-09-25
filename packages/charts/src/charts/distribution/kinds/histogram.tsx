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

/**
 * Legibility floor for the rung pitch: below this a stack is a blur. It is a
 * FLOOR only — the pitch is otherwise the count scale's own px-per-`unit`, so
 * the rungs fill the plot exactly like the bars do (#242).
 */
const MIN_RUNG_STEP = 1.6;

/**
 * Countability band for the TALLEST stack, in rungs. Fewer and `unit` is too
 * coarse (a comb that hides the shape); more and it is too fine (a texture, the
 * ceiling `UnitStack` documents). Both are the caller's `unit`, so both warn
 * rather than silently re-scaling the mark.
 */
const MIN_TALLEST_RUNGS = 3;
const MAX_TALLEST_RUNGS = 60;

/** Messages already warned about, so a re-rendering chart does not re-log every frame. */
const warnedRungMessages = new Set<string>();

function warnRungOnce(message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warnedRungMessages.has(message)) return;
  warnedRungMessages.add(message);
  console.warn(message);
}

/**
 * How many rungs a bin draws. Nearest whole unit, but a bin holding ANY records
 * draws at least one rung — an occupied bin must never read as an empty one.
 */
export function rungCount(count: number, unit: number): number {
  if (!(count > 0) || !(unit > 0)) return 0;
  return Math.max(1, Math.round(count / unit));
}

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
  fill,
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
  const rungs = unit !== undefined && unit > 0;
  // The rung pitch IS the count scale: one rung is `unit` records on the same
  // px-per-record scale the bars use, so a stack grows with the plot (#242).
  const rungStep = rungs ? Math.max(MIN_RUNG_STEP, scaleCount(unit)) : MIN_RUNG_STEP;
  if (rungs) {
    const tallest = rungCount(countMax, unit);
    if (tallest > 0 && tallest < MIN_TALLEST_RUNGS) {
      warnRungOnce(
        `[DistributionChart] unit=${unit} draws the tallest bin as ${tallest} rung(s) — too coarse to count. Use a smaller unit.`,
      );
    } else if (tallest > MAX_TALLEST_RUNGS) {
      warnRungOnce(
        `[DistributionChart] unit=${unit} draws the tallest bin as ${tallest} rungs — too many to count. Use a larger unit, or omit unit for bars.`,
      );
    }
  }

  return (
    <g data-slot="distribution-chart-histogram">
      {bins.map((bin, binIndex) => {
        const a = geometry.valuePos(bin.x0);
        const b = geometry.valuePos(bin.x1);
        const lo = Math.min(a, b);
        const thickness = Math.max(1, Math.abs(b - a) - BIN_GAP);
        const centre = (a + b) / 2;
        const length = scaleCount(bin.count);
        // The bar (or rung stack) as drawn, from the baseline out.
        const reach = rungs ? rungCount(bin.count, unit) * rungStep : length;
        const enter = () =>
          onHover({
            ...toPlot(horizontal, centre, base - (geometry.countSign === -1 ? length : -length)),
            mark: horizontal
              ? { x: lo, y: base - reach, width: thickness, height: reach }
              : { x: base, y: lo, width: reach, height: thickness },
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
            {rungs ? (
              // Offset by one pitch: rung `i` sits at `(i + 1) × step`, so the
              // top rung lands where the bar would end and a one-rung bin is
              // drawn ABOVE the baseline, not on it.
              <UnitStack
                direction={horizontal ? "up" : "right"}
                jitter
                kind="rung"
                length={thickness}
                n={rungCount(bin.count, unit)}
                seed={group.index * 31 + binIndex}
                step={rungStep}
                stroke={color}
                strokeWidth={1.25}
                x={horizontal ? centre : base + rungStep}
                y={horizontal ? base - rungStep : centre}
              />
            ) : (
              <rect
                fill={fill ?? color}
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
