/**
 * Where a back edge's return leg runs, so it stays VISIBLE.
 *
 * A back edge is drawn as a smoothstep with one long cross-segment running against the
 * layout direction. React Flow puts that segment halfway between the two handles by
 * default, and a fixed nudge off the midpoint does not help: in a top-down layout the
 * midpoint of a rework edge sits between two ranks, i.e. squarely inside the column of
 * cards it is supposed to run past. Edges paint UNDER nodes, so the segment vanishes
 * behind the cards and all the reader is left with is a dashed stub below one node and
 * another above the other — which reads as a stray rectangle, not as a loop back.
 *
 * So the leg is placed OUTSIDE every card it would otherwise pass behind: past the far
 * side of every node whose extent overlaps the span the edge crosses. That is how a
 * process-mining tool draws a rework loop — out, around the rank, back in — and it is
 * the only placement that is correct for a graph rather than for a pair of nodes.
 */

/** One node's laid-out box, in flow coordinates. */
export interface BackEdgeNodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which axis the layout's ranks advance along. */
export type BackEdgeAxis = "vertical" | "horizontal";

/**
 * The `centerX` (vertical layout) or `centerY` (horizontal layout) to hand
 * `getSmoothStepPath`, or `null` when nothing is measured yet and React Flow's own
 * midpoint should stand.
 *
 * @param rects  Every laid-out node on the canvas. Nodes that cannot be hit are filtered
 *               out here rather than by the caller, so the caller stays a plain map.
 * @param span   The interval the edge crosses on the RANK axis (`[min, max]` of the two
 *               handle coordinates) — a node outside it is never behind this edge.
 * @param clearance  Gap left between the leg and the outermost card it clears.
 */
export function backEdgeDetour(
  rects: readonly BackEdgeNodeRect[],
  axis: BackEdgeAxis,
  span: readonly [number, number],
  clearance: number,
): number | null {
  const [lo, hi] = span[0] <= span[1] ? span : [span[1], span[0]];
  let far = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    if (!(rect.width > 0) || !(rect.height > 0)) continue;
    // Overlap on the RANK axis (the one the edge travels along): a node beside the
    // corridor but on another rank cannot be crossed by this leg.
    const [near, beyond] =
      axis === "vertical" ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
    if (beyond < lo || near > hi) continue;
    far = Math.max(far, axis === "vertical" ? rect.x + rect.width : rect.y + rect.height);
  }

  return Number.isFinite(far) ? far + clearance : null;
}
