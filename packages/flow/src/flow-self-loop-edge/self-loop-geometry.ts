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

/**
 * The two handle anchors a self-loop actually joins, plus the box it has to clear.
 *
 * A self-loop's `sourceX/sourceY` and `targetX/targetY` are the SAME node's two handle
 * points, which is why they describe no useful straight line — but they are still the
 * only two points on the canvas the reader recognises as connectors, so the arc has to
 * start and end exactly on them. {@link selfLoopHandleArc} is the geometry that does
 * that; {@link selfLoopPath} remains the node-box arc used before a node is measured.
 */
export interface SelfLoopHandleAnchor {
  /** Where the loop leaves the node — React Flow's own SOURCE handle anchor. */
  sourceX: number;
  sourceY: number;
  /** Where it re-enters — React Flow's own TARGET handle anchor. */
  targetX: number;
  targetY: number;
  /** The node's centre. Decides which way is "out of the card". */
  centerX: number;
  centerY: number;
  /** The node's rendered size, so the arc clears the card instead of crossing it. */
  width: number;
  height: number;
}

/** Unit vector from the node's centre to a handle point, or `fallback` when degenerate. */
function outward(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  fallback: readonly [number, number],
): readonly [number, number] {
  const dx = x - centerX;
  const dy = y - centerY;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) return fallback;
  return [dx / length, dy / length];
}

/**
 * A cubic that leaves the SOURCE handle dot, bulges clear of the node on one side, and
 * re-enters at the TARGET handle dot.
 *
 * It is direction-agnostic by construction: the bulge is the source normal rotated a
 * quarter turn, so a top-to-bottom layout (handles on the bottom and top) gets a lasso
 * down the node's right-hand side, and a left-to-right layout (handles on the right and
 * left) gets an arc over the top — with no `direction` prop, and no list of cases to keep
 * in step with `layoutFlow`'s `HANDLE_BY_DIRECTION`.
 *
 * `loopRadius` is how far the curve shoots straight out of each dot before it turns, and
 * also the gap the arc's widest point keeps from the card's edge. The label sits at that
 * widest point — the cubic's `t = 0.5` midpoint — so it is off the node by construction.
 *
 * Never returns `NaN`: non-finite inputs fall back to `0`, a non-positive radius to
 * {@link DEFAULT_LOOP_RADIUS}, and a handle point sitting on the node's centre (nothing
 * measured yet) to a downward source normal.
 */
export function selfLoopHandleArc(anchor: SelfLoopHandleAnchor, loopRadius: number): SelfLoopPath {
  const num = (value: number) => (Number.isFinite(value) ? value : 0);
  const sx = num(anchor.sourceX);
  const sy = num(anchor.sourceY);
  const tx = num(anchor.targetX);
  const ty = num(anchor.targetY);
  const cx = num(anchor.centerX);
  const cy = num(anchor.centerY);
  const width = Math.max(0, num(anchor.width));
  const height = Math.max(0, num(anchor.height));
  const r = Number.isFinite(loopRadius) && loopRadius > 0 ? loopRadius : DEFAULT_LOOP_RADIUS;

  const [osx, osy] = outward(sx, sy, cx, cy, [0, 1]);
  const [otx, oty] = outward(tx, ty, cx, cy, [-osx, -osy]);
  // A quarter turn from the source normal: the side the loop bulges out on.
  const lx = osy;
  const ly = -osx;
  // How far the card extends along the bulge, plus the clearance we want beyond it.
  const clearance = Math.abs(lx) * (width / 2) + Math.abs(ly) * (height / 2) + r;
  // A cubic reaches only 3/4 of the way to its control points at the midpoint — its
  // WIDEST point — so `clearance` has to be divided by that factor, not used directly.
  // Used directly (the first cut of this function did) the apex lands at 0.75 × clearance,
  // which for a 176 px card is 87 px against an 88 px half-width: the loop is drawn ON the
  // card it is supposed to encircle, and its label — anchored at that same midpoint —
  // prints on top of the activity's own name. Measured on the process map: one collision
  // per direction that no amount of layout spacing could remove, because the arc's reach
  // is a property of the node it belongs to, not of the gap to its neighbours.
  const reach = (4 / 3) * clearance;

  const c1x = sx + osx * r + lx * reach;
  const c1y = sy + osy * r + ly * reach;
  const c2x = tx + otx * r + lx * reach;
  const c2y = ty + oty * r + ly * reach;

  return {
    path: `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`,
    // A cubic's midpoint is (P0 + 3·C1 + 3·C2 + P3) / 8 — the arc's apex, which `reach`
    // above places `loopRadius` clear of the card, so the label sits off the node.
    labelX: (sx + 3 * c1x + 3 * c2x + tx) / 8,
    labelY: (sy + 3 * c1y + 3 * c2y + ty) / 8,
  };
}
