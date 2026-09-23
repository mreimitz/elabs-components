"use client";

/**
 * analytics/error-bars.tsx — per-datum whiskers for `analytics[{ kind:
 * "errorBars" }]` (RM-139): a rule from the low to the high bound with a cap
 * at each end, centred on the datum (a bar's own column, a line's point).
 *
 * Ink only, `aria-hidden` like every mark: the fact ("error bars on Revenue")
 * reaches AT through the container's `describeAnalytics` sentence, and each
 * datum's range through the tooltip's muted row.
 */

import { memo } from "react";

/** One whisker in plot pixels. */
export interface ErrorBarGeometry {
  /** Position along the category / x axis (the whisker's centre line). */
  at: number;
  /** Pixel positions of the two bounds along the value axis. */
  from: number;
  to: number;
  /** Raw datum x, painted as `data-x` for tests. */
  x: string;
  /** The bounds in data units, painted as `data-low` / `data-high`. */
  low: number;
  high: number;
}

export interface ErrorBarsProps {
  bars: readonly ErrorBarGeometry[];
  /** `true` when the value axis runs horizontally (a horizontal bar chart). */
  horizontal?: boolean;
  stroke: string;
  strokeWidth?: number;
  /** Cap length in px. Default 6. */
  cap?: number;
}

/** The whiskers of one analytic. */
export const ErrorBars = memo(function ErrorBars({
  bars,
  horizontal = false,
  stroke,
  strokeWidth = 1.25,
  cap = 6,
}: ErrorBarsProps) {
  const half = cap / 2;
  return (
    <g aria-hidden="true" data-slot="analytic-error-bars">
      {bars.map((bar) =>
        horizontal ? (
          <g data-high={bar.high} data-low={bar.low} data-x={bar.x} key={bar.x}>
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.from}
              x2={bar.to}
              y1={bar.at}
              y2={bar.at}
            />
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.from}
              x2={bar.from}
              y1={bar.at - half}
              y2={bar.at + half}
            />
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.to}
              x2={bar.to}
              y1={bar.at - half}
              y2={bar.at + half}
            />
          </g>
        ) : (
          <g data-high={bar.high} data-low={bar.low} data-x={bar.x} key={bar.x}>
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.at}
              x2={bar.at}
              y1={bar.from}
              y2={bar.to}
            />
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.at - half}
              x2={bar.at + half}
              y1={bar.from}
              y2={bar.from}
            />
            <line
              stroke={stroke}
              strokeWidth={strokeWidth}
              x1={bar.at - half}
              x2={bar.at + half}
              y1={bar.to}
              y2={bar.to}
            />
          </g>
        ),
      )}
    </g>
  );
});
ErrorBars.displayName = "ErrorBars";
