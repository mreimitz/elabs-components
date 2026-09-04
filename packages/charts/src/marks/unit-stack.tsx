"use client";

import { forwardRef, type SVGProps } from "react";
import { seededRnd } from "./seeded-rnd";

/** The shape of one countable unit. */
export type UnitStackKind = "rung" | "tick" | "dot";

/** The direction the stack grows from its origin. */
export type UnitStackDirection = "up" | "down" | "left" | "right";

export interface UnitStackProps extends Omit<
  SVGProps<SVGGElement>,
  "direction" | "seed" | "kind" | "length"
> {
  /** How many units to draw. Negative and fractional values are floored to a count. */
  n: number;
  /** `rung` (crossbar), `tick` (half-crossbar), or `dot`. */
  kind: UnitStackKind;
  /** Which way the stack grows from `(x, y)`. */
  direction: UnitStackDirection;
  /** Cross-axis extent of one unit in px — the rung's width, or the dot's diameter. */
  length: number;
  /** Distance between consecutive unit centres in px (default 3). */
  step?: number;
  /** Every n-th unit is drawn longer and heavier so the stack stays countable (default 5). */
  markEvery?: number;
  /** Vary each unit's stroke width and opacity through {@link seededRnd} (default false). */
  jitter?: boolean;
  /** The stack's seed — the `k` of {@link seededRnd}. Required whenever `jitter` is on. */
  seed: number;
  /** Origin x (default 0). */
  x?: number;
  /** Origin y (default 0). */
  y?: number;
}

/** Axis (growth) and cross (mark) unit vectors for each direction. */
const VECTORS: Record<UnitStackDirection, { ax: number; ay: number; cx: number; cy: number }> = {
  down: { ax: 0, ay: 1, cx: 1, cy: 0 },
  left: { ax: -1, ay: 0, cx: 0, cy: 1 },
  right: { ax: 1, ay: 0, cx: 0, cy: 1 },
  up: { ax: 0, ay: -1, cx: 1, cy: 0 },
};

/** How much longer and heavier an every-n-th unit is drawn. */
const EMPHASIS = 1.5;

/**
 * UnitStack — `n` countable marks in a row: the ladder of rungs inside a bar, the
 * rim ticks around a dial, the dot column of a unit chart.
 *
 * Provenance: `F1 Rung Bars` (rungs), `L6 Rim Ticker` (ticks) and `F9 Unit Column`
 * (dots) in the lieflat gallery.
 *
 * ## Why draw a quantity you could just scale
 *
 * A 40px bar and a 60px bar are compared; forty rungs and sixty rungs are
 * COUNTED. The moment a reader can count, the chart stops needing a value label
 * to be precise — which is the whole editorial trick these cards run. The
 * `markEvery` unit (default the 5th) is what keeps counting cheap: the eye
 * counts in fives and reads the remainder.
 *
 * ## Contract notes
 *
 * - **`n` is a COUNT, and it must be small enough to count.** Past roughly 60
 *   units the stack stops being countable and becomes a texture — at which point
 *   a bar is the honest mark. This component will happily draw 500; that is your
 *   judgement, not its.
 * - **Jitter is seeded, never random.** `jitter` varies stroke width and opacity
 *   through {@link seededRnd} so the stack reads as drawn rather than printed,
 *   while rendering identically on every run — see that module for why
 *   `Math.random` is banned in this layer. Vary `seed` per stack (per series, per
 *   row) so two neighbouring stacks do not jitter in lockstep.
 * - **Decorative.** The `<g>` is `aria-hidden`; the quantity reaches AT through
 *   the chart's own summary or data table.
 * - Positioned in the parent's user space from `(x, y)`, so a caller can either
 *   pass coordinates or wrap it in a `transform` group.
 */
export const UnitStack = forwardRef<SVGGElement, UnitStackProps>(function UnitStack(
  {
    n,
    kind,
    direction,
    length,
    step = 3,
    markEvery = 5,
    jitter = false,
    seed,
    x = 0,
    y = 0,
    stroke,
    fill,
    strokeWidth,
    ...props
  },
  ref,
) {
  const count = Math.max(0, Math.floor(n));
  const { ax, ay, cx, cy } = VECTORS[direction];
  const ink = stroke ?? "var(--chart-foreground)";
  const baseWidth = typeof strokeWidth === "number" ? strokeWidth : 1;

  return (
    <g aria-hidden="true" data-slot="unit-stack" ref={ref} {...props}>
      {Array.from({ length: count }, (_unit, i) => {
        const px = x + ax * i * step;
        const py = y + ay * i * step;
        const emphatic = markEvery > 0 && (i + 1) % markEvery === 0;
        const len = emphatic ? length * EMPHASIS : length;
        const width =
          (emphatic ? baseWidth * EMPHASIS : baseWidth) *
          (jitter ? 0.7 + 0.6 * seededRnd(i, seed) : 1);
        const opacity = jitter ? 0.65 + 0.35 * seededRnd(i, seed + 1) : 1;

        if (kind === "dot") {
          return (
            <circle
              cx={px}
              cy={py}
              data-slot="unit-stack-unit"
              fill={fill ?? ink}
              key={i}
              opacity={opacity}
              r={len / 2}
            />
          );
        }

        // `rung` is centred on the growth axis; `tick` hangs off it on one side.
        const from = kind === "rung" ? -len / 2 : 0;
        const to = kind === "rung" ? len / 2 : len;

        return (
          <line
            data-slot="unit-stack-unit"
            key={i}
            opacity={opacity}
            stroke={ink}
            strokeWidth={width}
            x1={px + cx * from}
            x2={px + cx * to}
            y1={py + cy * from}
            y2={py + cy * to}
          />
        );
      })}
    </g>
  );
});
