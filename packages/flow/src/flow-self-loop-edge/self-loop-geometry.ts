/**
 * self-loop-geometry — pure, framework-free arc math for a self-referencing edge.
 *
 * Kept out of the component (and out of React) so the loop's shape can be
 * unit-tested without a canvas, and so a sibling that needs the same apex
 * point (a legend, an overlay, a screenshot harness) can compute it directly.
 */

/** Default arc radius, in px. A loop this size clears `FlowNode`'s header without dominating it. */
export const DEFAULT_LOOP_RADIUS = 28;

/**
 * How far the cubic's control points reach sideways and upwards, as multiples
 * of `loopRadius`. Tuned so the arc reads as a closed loop rather than a bump:
 * the horizontal reach opens the throat of the loop, the vertical reach sets
 * its height.
 */
const CONTROL_REACH_X = 1.2;
const CONTROL_REACH_Y = 2.4;
/** A symmetric cubic's midpoint sits at 3/4 of its control-point height — see `selfLoopPath`. */
const APEX_FACTOR = (3 / 4) * CONTROL_REACH_Y;

/** The box a self-loop is drawn above. Matches a React Flow `InternalNode` structurally. */
export interface SelfLoopAnchor {
  /** Horizontal centre of the node the loop belongs to. */
  centerX: number;
  /** Top edge of that node — the loop is drawn above this line. */
  topY: number;
}

export interface SelfLoopPath {
  /** SVG `d` for the arc. */
  path: string;
  /** Where a label belongs: the arc's apex. */
  labelX: number;
  labelY: number;
}

/**
 * A cubic arc that leaves the node's top-RIGHT, bulges up over the node, and
 * re-enters at its top-LEFT — the conventional "this step repeated" mark in a
 * process map, and a SHAPE rather than a colour, so it survives greyscale.
 *
 * The curve is symmetric about `centerX`, which puts its `t = 0.5` midpoint
 * exactly at `(centerX, topY - APEX_FACTOR × loopRadius)` — the apex the label
 * is anchored to. Never returns `NaN`: a non-finite input falls back to `0`
 * and a non-positive radius falls back to the default.
 */
export function selfLoopPath(anchor: SelfLoopAnchor, loopRadius: number): SelfLoopPath {
  const cx = Number.isFinite(anchor.centerX) ? anchor.centerX : 0;
  const ay = Number.isFinite(anchor.topY) ? anchor.topY : 0;
  const r = Number.isFinite(loopRadius) && loopRadius > 0 ? loopRadius : DEFAULT_LOOP_RADIUS;

  const startX = cx + r;
  const endX = cx - r;
  const controlY = ay - r * CONTROL_REACH_Y;

  return {
    path: `M ${startX},${ay} C ${startX + r * CONTROL_REACH_X},${controlY} ${
      endX - r * CONTROL_REACH_X
    },${controlY} ${endX},${ay}`,
    labelX: cx,
    labelY: ay - r * APEX_FACTOR,
  };
}
