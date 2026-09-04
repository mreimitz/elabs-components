"use client";

import type { SVGProps } from "react";

/**
 * A positional scale: one calendar period in, one x (or y) coordinate out.
 *
 * `undefined` is an accepted return because that is what `d3`'s band scale
 * answers for a value outside its domain — the tick is skipped rather than
 * drawn at `NaN`, which SVG renders as a stray mark at the origin.
 */
export type HairlineScale<T> = (value: T) => number | undefined;

export interface HairlineFloorProps<T> extends Omit<SVGProps<SVGGElement>, "scale"> {
  /** Projects a period onto the axis. Pass the same scale the series uses. */
  scale: HairlineScale<T>;
  /** One entry per calendar period — months, weeks, sprints, quarters. */
  periods: readonly T[];
  /** Every `n`-th tick is drawn long (default 12 — one long tick per year of months). */
  every?: number;
  /** The floor's baseline y. Ticks hang below it. */
  y: number;
  /** Short-tick length in px (default 3). */
  height?: number;
  /** Long-tick length in px (default 6). */
  longHeight?: number;
}

/**
 * HairlineFloor — one tick per calendar period along the bottom of a plot, with
 * every n-th tick drawn longer.
 *
 * Provenance: `L4 Thread Ledger` and `L2 Weather Almanac` in the lieflat gallery —
 * the ruled foot of a ledger page, which is how those cards give a reader the
 * passage of TIME without an axis, a label or a gridline.
 *
 * ## What it replaces, and why that is the point
 *
 * A conventional axis answers "what date is this?" — it needs labels, tick
 * selection and room. A hairline floor answers "how long is this?", which is the
 * question a small multiple or a sparkline-sized card is actually asking, and it
 * answers it in 0.55px of ink with nothing to read. The long tick is the ONLY
 * navigational cue: pick `every` so the long ticks land on a boundary a reader
 * already holds (12 for months, 7 for days, 4 for quarters).
 *
 * ## Contract notes
 *
 * - **One tick per period, always.** Do not decimate it — an irregular floor
 *   reads as missing data. If there are too many periods to draw, the chart is
 *   too small for this mark; use an axis.
 * - **`--chart-grid`, not `--chart-foreground`.** The floor is grid furniture and
 *   sits at the grid's weight, below every series.
 * - Generic over the period type, so a `Date[]` with a time scale and a
 *   `string[]` with a band scale both typecheck without a cast. Written as a
 *   plain function rather than `forwardRef` for that reason — a generic
 *   `forwardRef` cannot preserve `T` without a wrapper cast, and a `<g>` of inert
 *   ticks has no behaviour a ref would reach.
 */
export function HairlineFloor<T>({
  scale,
  periods,
  every = 12,
  y,
  height = 3,
  longHeight = 6,
  stroke,
  strokeWidth,
  ...props
}: HairlineFloorProps<T>) {
  return (
    <g
      aria-hidden="true"
      data-slot="hairline-floor"
      stroke={stroke ?? "var(--chart-grid)"}
      strokeWidth={strokeWidth ?? 0.55}
      {...props}
    >
      {periods.map((period, i) => {
        const x = scale(period);
        if (x === undefined || !Number.isFinite(x)) return null;
        const long = every > 0 && i % every === 0;
        return (
          <line
            // The index IS the identity here: ticks are positional, and a
            // period value may legitimately repeat within one floor.
            key={`${i}-${x}`}
            x1={x}
            x2={x}
            y1={y}
            y2={y + (long ? longHeight : height)}
          />
        );
      })}
    </g>
  );
}
