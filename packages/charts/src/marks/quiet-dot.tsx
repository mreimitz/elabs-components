"use client";

import { forwardRef, type SVGProps } from "react";

/**
 * The pinprick's DIAMETER in px. 0.9 is the lieflat value — the smallest mark
 * that still resolves as ink on a 1× display rather than disappearing into
 * anti-aliasing.
 */
export const QUIET_DOT_SIZE = 0.9;

export interface QuietDotProps extends Omit<SVGProps<SVGCircleElement>, "r"> {
  /** Cell centre x. */
  cx: number;
  /** Cell centre y. */
  cy: number;
  /** Diameter in px (default 0.9). Raise it only for a very large cell. */
  size?: number;
}

/**
 * QuietDot — a 0.9px pinprick. The default render for a `null` or `0` cell in a
 * matrix chart, and the reason those charts have no holes in them.
 *
 * Provenance: "silence made visible" — `L5 Matrix Almanac` and `L3 Calendar
 * Ledger` in the lieflat gallery.
 *
 * ## Why a zero is drawn at all
 *
 * A blank cell is ambiguous in exactly the way that matters: it reads
 * identically to "no data collected", to "the grid ends here", and to a
 * rendering bug. A pinprick says the cell was VISITED and the answer was
 * nothing. It costs a rounding error's worth of ink and removes the single most
 * common misreading of a matrix chart.
 *
 * ## Contract notes
 *
 * - **`0` and `null` are still two different facts.** The dot says "measured";
 *   it does not say which. Where the difference is load-bearing, keep the dot for
 *   the zero and leave the missing cell to a hatch or an explicit gap — and say
 *   so in the legend.
 * - **Muted, not foreground.** It is the quietest thing on the chart by
 *   construction; painting it at series weight turns absence into a series.
 * - Decorative and `aria-hidden`, like every mark in this layer — the value
 *   reaches AT through the chart's data table / summary, not through the dot.
 */
export const QuietDot = forwardRef<SVGCircleElement, QuietDotProps>(function QuietDot(
  { cx, cy, size = QUIET_DOT_SIZE, fill, ...props },
  ref,
) {
  return (
    <circle
      aria-hidden="true"
      cx={cx}
      cy={cy}
      data-slot="quiet-dot"
      fill={fill ?? "var(--chart-foreground-muted)"}
      r={size / 2}
      ref={ref}
      {...props}
    />
  );
});
