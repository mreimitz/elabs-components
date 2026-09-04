"use client";

import { forwardRef, type SVGProps } from "react";

/** A point in the parent SVG's user space. */
export type LeaderPoint = readonly [x: number, y: number];

/**
 * How a leader gets from its anchor to its label.
 *
 * - `elbow` — out horizontally to the midpoint, across, then in. The ledger form:
 *   it reads as a ruled line and never crosses a neighbouring mark diagonally.
 * - `curve` — a cubic with horizontal control handles. The marginalia form: softer,
 *   and unmistakably an annotation rather than part of the plot.
 */
export type LeaderKind = "elbow" | "curve";

/**
 * The two dash rhythms the lieflat cards use, and nothing else.
 *
 * `1 3` is the quieter of the two (a dotted trail — for a leader that must not
 * compete with the data); `2 3` is the emphatic one (a dashed trail — for a
 * callout that is meant to be followed). Keeping this a closed union is the
 * point: a third rhythm invented at a call site is how a vocabulary becomes
 * eleven slightly different vocabularies.
 */
export type LeaderDash = "1 3" | "2 3";

export interface LeaderProps extends Omit<SVGProps<SVGPathElement>, "from" | "to" | "d"> {
  /** Where the leader starts — normally the mark it points at. */
  from: LeaderPoint;
  /** Where the leader ends — normally the edge of the label. */
  to: LeaderPoint;
  /** Path shape (default `elbow`). */
  kind?: LeaderKind;
  /** Dash rhythm (default `1 3`). */
  dash?: LeaderDash;
}

/**
 * The `d` attribute for a leader — exported so `Marginalia` and any future
 * annotation mark draw the SAME geometry instead of re-deriving it.
 */
export function leaderPath(from: LeaderPoint, to: LeaderPoint, kind: LeaderKind = "elbow"): string {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  return kind === "curve"
    ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
    : `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
}

/**
 * Leader — the dashed hairline that ties an annotation to the mark it describes.
 *
 * Provenance: `L2 Weather Almanac`, `L7 Slope Ledger` and `F6 Dumbbell` in the
 * lieflat gallery — every one of them annotates in the margin and connects with
 * one of these two dash rhythms.
 *
 * ## Why 0.6px, and why muted
 *
 * A leader is FURNITURE: it must be followable and must never be mistaken for
 * data. 0.6px in `--chart-foreground-muted` sits below the weight of every series
 * stroke in the system, so the eye reads it as a rule rather than a line on the
 * chart. Do not thicken it to make it easier to see — move the label closer.
 *
 * The stroke is `fill="none"` on purpose: an elbow path is open, and a filled
 * open path paints a triangle between its endpoints.
 */
export const Leader = forwardRef<SVGPathElement, LeaderProps>(function Leader(
  { from, to, kind = "elbow", dash = "1 3", stroke, strokeWidth, ...props },
  ref,
) {
  return (
    <path
      d={leaderPath(from, to, kind)}
      data-slot="leader"
      fill="none"
      ref={ref}
      stroke={stroke ?? "var(--chart-foreground-muted)"}
      strokeDasharray={dash}
      strokeWidth={strokeWidth ?? 0.6}
      {...props}
    />
  );
});
