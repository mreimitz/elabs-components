/**
 * Pure alignment-guide geometry for the helper-lines feature.
 *
 * Implemented fresh from the documented "helper lines" behaviour (the React Flow
 * Pro example is paid — only the concept is reused): while a single node drags,
 * compare its left / horizontal-center / right against every other node's
 * left / center / right (and top / middle / bottom on the vertical axis). When a
 * pair falls within `threshold` flow-coordinate pixels, record the guide's
 * absolute coordinate and the snapped top-left position for the dragged node.
 *
 * Everything here is a pure function of plain rectangles so it is unit-testable
 * without a live React Flow instance.
 */

/** A node's bounding box in absolute flow coordinates (top-left origin). */
export interface HelperLineRect {
  /** Left edge (top-left x) in flow coordinates. */
  x: number;
  /** Top edge (top-left y) in flow coordinates. */
  y: number;
  width: number;
  height: number;
}

export interface HelperLinesResult {
  /** New top-left x for the dragged node once snapped to the vertical guide. */
  snapX?: number;
  /** New top-left y for the dragged node once snapped to the horizontal guide. */
  snapY?: number;
  /** Absolute flow-x of the active vertical guide line, if any. */
  vertical?: number;
  /** Absolute flow-y of the active horizontal guide line, if any. */
  horizontal?: number;
}

/**
 * Fractional anchor offsets along an axis: 0 = start edge (left/top),
 * 0.5 = center/middle, 1 = end edge (right/bottom). Comparing all three anchors
 * of the dragged node against all three of every other node yields
 * edge-to-edge, edge-to-center and center-to-center alignment.
 */
const ANCHORS = [0, 0.5, 1] as const;

/**
 * Compute the closest vertical + horizontal alignment guides (and the snapped
 * position) for a dragged rectangle against the other rectangles.
 *
 * @param dragged   the dragged node's proposed bounding box (flow coordinates)
 * @param others    every other node's bounding box
 * @param threshold max distance (flow px) at which alignment engages; a pair at
 *                  exactly `threshold` does NOT match (strict boundary)
 */
export function getHelperLines(
  dragged: HelperLineRect,
  others: Iterable<HelperLineRect>,
  threshold = 5,
): HelperLinesResult {
  const result: HelperLinesResult = {};
  // Track the closest match on each axis; initialising to `threshold` makes the
  // boundary strict (a distance equal to threshold never wins).
  let bestVerticalDist = threshold;
  let bestHorizontalDist = threshold;

  // Each anchor as { a: fractional offset, pos: absolute coordinate }.
  const draggedX = ANCHORS.map((a) => ({ a, pos: dragged.x + dragged.width * a }));
  const draggedY = ANCHORS.map((a) => ({ a, pos: dragged.y + dragged.height * a }));

  for (const other of others) {
    const otherX = ANCHORS.map((a) => other.x + other.width * a);
    const otherY = ANCHORS.map((a) => other.y + other.height * a);

    // Vertical guide (align on the X axis).
    for (const d of draggedX) {
      for (const oPos of otherX) {
        const dx = Math.abs(d.pos - oPos);
        if (dx < bestVerticalDist) {
          bestVerticalDist = dx;
          result.vertical = oPos;
          result.snapX = oPos - dragged.width * d.a;
        }
      }
    }

    // Horizontal guide (align on the Y axis).
    for (const d of draggedY) {
      for (const oPos of otherY) {
        const dy = Math.abs(d.pos - oPos);
        if (dy < bestHorizontalDist) {
          bestHorizontalDist = dy;
          result.horizontal = oPos;
          result.snapY = oPos - dragged.height * d.a;
        }
      }
    }
  }

  return result;
}
