/**
 * annotation-layout — collision placement for annotation text (RM-111), on
 * RM-110's `layoutLabels` solver.
 *
 * Painted text notes and row notes are label boxes in plot px. The labels the
 * chart already painted (RM-110 end and value labels, a waterfall's value
 * labels) are fixed obstacles, so a note moves out of their way and never the
 * reverse: a series name outranks a remark about it.
 *
 * Two passes, so a note is not given up at the first obstacle:
 * 1. every box on its preferred free axis, within the solver's default nudge;
 * 2. each box the first pass dropped, on its retry axis, with a longer reach,
 *    around everything the first pass placed.
 *
 * A box both passes drop is reported in `dropped`. The layer never hides it:
 * with an annotation key listening it becomes a numbered marker plus a key
 * row, otherwise it paints at its preferred position.
 */

import {
  type LabelAnchorSide,
  type LabelBox,
  type LabelRect,
  layoutLabels,
} from "../labels/label-layout";

/** Reach of the second pass, px: about three note lines. */
export const ANNOTATION_RETRY_MAX_NUDGE = 48;

/** One painted annotation to place: its preferred box, plus how it may move. */
export interface AnnotationBox extends LabelBox {
  /** Index of the annotation in the `annotations` array. */
  index: number;
  /** Free axis of the second pass. Default: the other axis than `anchorSide`'s. */
  retryAnchorSide?: LabelAnchorSide;
}

/** Final placement of the painted annotations. */
export interface AnnotationLayout {
  /** Move to apply to each placed annotation, by index. Absent: paint where preferred. */
  moves: ReadonlyMap<number, { dx: number; dy: number }>;
  /** Indices neither pass could place without an overlap. */
  dropped: ReadonlySet<number>;
}

const OTHER_AXIS_SIDE: Record<LabelAnchorSide, LabelAnchorSide> = {
  left: "top",
  right: "top",
  top: "left",
  bottom: "left",
};

/** No moves, nothing dropped. */
export const EMPTY_ANNOTATION_LAYOUT: AnnotationLayout = { moves: new Map(), dropped: new Set() };

function rectOf(x: number, y: number, box: LabelRect): LabelRect {
  return { x, y, width: box.width, height: box.height };
}

/**
 * Place annotation boxes clear of each other and of `obstacles`. Pure and
 * deterministic: boxes are visited by `priority` (higher first), then input
 * order, exactly as `layoutLabels` does.
 */
export function layoutAnnotationBoxes(
  boxes: readonly AnnotationBox[],
  options: { obstacles?: readonly LabelRect[]; bounds?: LabelRect } = {},
): AnnotationLayout {
  if (boxes.length === 0) return EMPTY_ANNOTATION_LAYOUT;
  const obstacles = options.obstacles ?? [];
  const moves = new Map<number, { dx: number; dy: number }>();

  const first = layoutLabels(boxes, { bounds: options.bounds, obstacles });
  for (const p of first.placed) moves.set(p.label.index, { dx: p.dx, dy: p.dy });
  if (first.dropped.length === 0) return { moves, dropped: new Set() };

  const retry = layoutLabels(
    first.dropped.map((box) => ({
      ...box,
      anchorSide: box.retryAnchorSide ?? OTHER_AXIS_SIDE[box.anchorSide ?? "left"],
    })),
    {
      bounds: options.bounds,
      maxNudge: ANNOTATION_RETRY_MAX_NUDGE,
      obstacles: [...obstacles, ...first.placed.map((p) => rectOf(p.x, p.y, p.label))],
    },
  );
  for (const p of retry.placed) moves.set(p.label.index, { dx: p.dx, dy: p.dy });
  return { moves, dropped: new Set(retry.dropped.map((box) => box.index)) };
}

/**
 * The horizontal extent notes may use: the plot width, widened to any box
 * that already starts outside it (a note anchored near an edge), so the
 * solver never drops a note for an overflow it did not cause. Vertically the
 * notes stay inside the plot.
 */
export function annotationLayoutBounds(
  boxes: readonly LabelRect[],
  innerWidth: number,
  innerHeight: number,
): LabelRect {
  let left = 0;
  let right = innerWidth;
  let top = 0;
  let bottom = innerHeight;
  for (const box of boxes) {
    left = Math.min(left, box.x);
    right = Math.max(right, box.x + box.width);
    top = Math.min(top, box.y);
    bottom = Math.max(bottom, box.y + box.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
