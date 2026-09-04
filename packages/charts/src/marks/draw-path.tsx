"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { forwardRef, type SVGProps } from "react";

/** Default draw duration in seconds — long enough to read as a hand, short enough not to wait. */
const DEFAULT_DRAW_SECONDS = 0.9;

export interface DrawPathProps extends Omit<
  SVGProps<SVGPathElement>,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
  | "pathLength"
  | "strokeDasharray"
  | "strokeDashoffset"
  | "style"
  // `values` is SVG's feColorMatrix attribute (a string) in React's types and a
  // MotionValue map in motion's — same name, unrelated meanings, so it cannot
  // be carried through this wrapper.
  | "values"
> {
  /** Draw duration in seconds (default 0.9). */
  duration?: number;
  /** Delay before drawing starts, in seconds — pair it with `stagger(i, …)`. */
  delay?: number;
  /** Full transition override. Wins over `duration`/`delay`. */
  transition?: Transition;
}

/**
 * DrawPath — a `<path>` that draws itself in, left end to right end, the way a
 * pen would.
 *
 * Provenance: the `pathLength=1` draw-in every line card in the lieflat gallery
 * opens with (`L7 Slope Ledger`, `L4 Thread Ledger`).
 *
 * ## Why `pathLength={1}`
 *
 * Setting `pathLength` re-scales the path's own coordinate system so its total
 * length is exactly 1, whatever its real geometry. That is what lets the dash
 * offset animate from 1 to 0 with no measurement step: without it the animation
 * needs `getTotalLength()`, which is a layout read in render (forbidden — see
 * `.claude/rules/interaction-guidelines.md`) and returns 0 under jsdom, so every
 * mocked test would draw nothing.
 *
 * ## Reduced motion is a BRANCH, not a shorter duration
 *
 * Under `useReducedMotion()` this renders a plain `<path>` with no dash
 * attributes at all — the finished drawing, immediately. It deliberately does not
 * render a `motion.path` with `duration: 0`: the dash attributes would still be
 * in the DOM, and a stroke carrying `stroke-dasharray: 1` is one browser
 * rounding error away from a visible seam. The final state has to be the
 * ordinary, undecorated path.
 *
 * ## Contract notes
 *
 * - **`d` is yours.** This wraps the drawing, not the geometry — pass the same
 *   `d` you would have passed a `<path>`.
 * - **Stroke it, do not fill it.** A dash offset acts on the stroke; a filled
 *   path appears in one frame and the draw-in does nothing.
 * - Decorative. A chart's meaning must never depend on an animation having run.
 */
export const DrawPath = forwardRef<SVGPathElement, DrawPathProps>(function DrawPath(
  { duration = DEFAULT_DRAW_SECONDS, delay = 0, transition, fill, ...props },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  const resolvedFill = fill ?? "none";

  if (prefersReducedMotion) {
    return <path data-slot="draw-path" fill={resolvedFill} ref={ref} {...props} />;
  }

  return (
    <motion.path
      animate={{ strokeDashoffset: 0 }}
      data-slot="draw-path"
      fill={resolvedFill}
      initial={{ strokeDashoffset: 1 }}
      pathLength={1}
      ref={ref}
      strokeDasharray={1}
      transition={transition ?? { delay, duration, ease: "easeInOut" }}
      {...props}
    />
  );
});
