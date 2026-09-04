"use client";

import { forwardRef, type SVGProps } from "react";

/** The outline shape drawn around the highlighted mark. */
export type PeakRingShape = "circle" | "square";

export interface PeakRingProps extends Omit<SVGProps<SVGGElement>, "r"> {
  /** Centre x of the mark being ringed. */
  cx: number;
  /** Centre y of the mark being ringed. */
  cy: number;
  /** Radius (for `square`, half the side) — leave a px or two of air around the mark. */
  r: number;
  /** `circle` for a point/bubble, `square` for a matrix cell (default `circle`). */
  shape?: PeakRingShape;
}

/**
 * PeakRing — a dashed outline around the one mark that matters: the peak, the
 * outlier, the cell the caption is about.
 *
 * Provenance: `L9 Bubble Almanac` (circle, around the busiest day) and
 * `L5 Matrix Almanac` (square, around the hottest cell) in the lieflat gallery.
 *
 * ## Why dashed, and why it is not a highlight colour
 *
 * Emphasis here is carried by SHAPE, not by hue — an added outline reads as
 * "this one" in greyscale, in every theme, and to a user who cannot separate the
 * highlight colour from the series colour (WCAG 1.4.1; see
 * `.claude/rules/accessibility.md`). The `2 3` dash is what stops the ring being
 * mistaken for a data mark of its own: nothing that is plotted is dashed.
 *
 * ## It is decorative — name the thing it rings
 *
 * The ring is `aria-hidden` and carries no accessible name, exactly like the
 * chart body it sits in. A peak worth ringing is worth SAYING, so put the
 * statement in the caption, the summary or a `HaloText` label — never leave the
 * ring as the only carrier of the fact.
 *
 * `shape="square"` renders a `<rect>` inscribing the same radius, so a matrix
 * cell can be ringed with the identical call the bubble uses.
 */
export const PeakRing = forwardRef<SVGGElement, PeakRingProps>(function PeakRing(
  { cx, cy, r, shape = "circle", stroke, strokeWidth, ...props },
  ref,
) {
  const shared = {
    fill: "none",
    stroke: stroke ?? "var(--chart-foreground)",
    strokeDasharray: "2 3",
    strokeWidth: strokeWidth ?? 0.8,
  } as const;

  return (
    <g aria-hidden="true" data-slot="peak-ring" ref={ref} {...props}>
      {shape === "circle" ? (
        <circle cx={cx} cy={cy} r={r} {...shared} />
      ) : (
        <rect height={r * 2} width={r * 2} x={cx - r} y={cy - r} {...shared} />
      )}
    </g>
  );
});
