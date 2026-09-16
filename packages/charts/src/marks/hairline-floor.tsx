"use client";

import type { SVGProps } from "react";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";

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
  /**
   * Which ticks draw long. A `number` is an index stride (default 12 — one
   * long tick per year of months); pass a predicate over the period itself
   * (e.g. `(date) => date.getDay() === 1`) to anchor the long tick to a real
   * calendar boundary instead of counting from wherever `periods` happens to
   * start (#253 — an index stride from an arbitrary origin marks nothing a
   * reader's own calendar holds).
   */
  every?: number | ((period: T, index: number) => boolean);
  /** The floor's baseline y. Ticks hang below it. */
  y: number;
  /** Short-tick length in px (default 3). */
  height?: number;
  /** Long-tick length in px (default 6). */
  longHeight?: number;
  /**
   * Stroke for long ticks only. Defaults to `stroke` (today's behaviour —
   * every tick the same ink). Pass a higher-contrast token
   * (`--chart-foreground-muted`) so the long tick — the mark's ONLY
   * navigational cue — clears the perceptual floor at the short ticks'
   * grid-furniture weight (#253).
   */
  longStroke?: string;
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
 *   sits at the grid's weight, below every series. `longStroke` may raise the
 *   long tick alone — it is the mark's one navigational cue, not more grid.
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
  longStroke,
  ...props
}: HairlineFloorProps<T>) {
  return (
    <g
      aria-hidden="true"
      data-slot="hairline-floor"
      stroke={stroke ?? "var(--chart-grid)"}
      strokeWidth={strokeWidth ?? CHART_HAIRLINE_WIDTH}
      {...props}
    >
      {periods.map((period, i) => {
        const x = scale(period);
        if (x === undefined || !Number.isFinite(x)) return null;
        const long = typeof every === "function" ? every(period, i) : every > 0 && i % every === 0;
        return (
          <line
            // The index IS the identity here: ticks are positional, and a
            // period value may legitimately repeat within one floor.
            key={`${i}-${x}`}
            // Omitted (rather than set to `stroke`) when unused, so a caller
            // that never passes `longStroke` renders byte-identically to
            // before — the `<line>` inherits the group's `stroke` (#253).
            stroke={long && longStroke ? longStroke : undefined}
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
