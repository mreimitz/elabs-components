"use client";

import { forwardRef, type SVGProps } from "react";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";

export interface RulerProps extends Omit<SVGProps<SVGGElement>, "orientation" | "ref"> {
  /** Where the spine starts (its top for `"vertical"`, its left for `"horizontal"`). */
  x: number;
  y: number;
  /** Length of the spine, in px. */
  length: number;
  /** Which way the spine runs. Default `"vertical"`. */
  orientation?: "vertical" | "horizontal";
  /**
   * Which side of the spine the ticks stand on: `1` (default) is right of a
   * vertical spine / below a horizontal one, `-1` the opposite.
   */
  side?: 1 | -1;
  /** Distance between ticks, in px. Default 8. */
  pitch?: number;
  /** Every n-th tick draws long. Default 5; `0` for none. */
  every?: number;
  /** Short-tick length in px. Default 3. */
  tick?: number;
  /** Long-tick length in px. Default 6. */
  longTick?: number;
  /** Draw the spine itself. Default true. */
  spine?: boolean;
}

/**
 * Ruler — a spine with evenly spaced ticks, every n-th one long: the edge of a
 * drafting scale. It gives a small plot a sense of MEASURE without an axis, a
 * label or a gridline — the hairline counterpart of `Grid mode="ticks"` for a
 * card-sized chart whose numbers are already printed on the marks.
 *
 * `HairlineFloor` is the mark to reach for when each tick must sit on a real
 * period of a scale. A `Ruler` is deliberately scale-free: its ticks are
 * decoration at a fixed pitch, so never let a reader count them as values.
 *
 * Grid furniture: `--chart-grid` at the one hairline weight, `aria-hidden`.
 */
export const Ruler = forwardRef<SVGGElement, RulerProps>(function Ruler(
  {
    x,
    y,
    length,
    orientation = "vertical",
    side = 1,
    pitch = 8,
    every = 5,
    tick = 3,
    longTick = 6,
    spine = true,
    stroke,
    strokeWidth,
    ...props
  },
  ref,
) {
  const vertical = orientation === "vertical";
  const count = pitch > 0 && length > 0 ? Math.floor(length / pitch) + 1 : 0;
  return (
    <g
      ref={ref}
      aria-hidden="true"
      data-slot="ruler"
      stroke={stroke ?? "var(--chart-grid)"}
      strokeWidth={strokeWidth ?? CHART_HAIRLINE_WIDTH}
      {...props}
    >
      {spine ? (
        <line x1={x} x2={vertical ? x : x + length} y1={y} y2={vertical ? y + length : y} />
      ) : null}
      {Array.from({ length: count }, (_, i) => {
        const at = i * pitch;
        const size = (every > 0 && i % every === 0 ? longTick : tick) * side;
        return vertical ? (
          // Positional marks: the index is the identity.
          <line key={i} x1={x} x2={x + size} y1={y + at} y2={y + at} />
        ) : (
          <line key={i} x1={x + at} x2={x + at} y1={y} y2={y + size} />
        );
      })}
    </g>
  );
});
