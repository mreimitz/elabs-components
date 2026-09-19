import { describe, expect, it } from "vitest";
import {
  type AnnotationBox,
  annotationLayoutBounds,
  layoutAnnotationBoxes,
} from "./annotation-layout";

const box = (index: number, rect: Partial<AnnotationBox> = {}): AnnotationBox => ({
  id: `note-${index}`,
  index,
  x: 0,
  y: 0,
  width: 40,
  height: 14,
  anchorSide: "left",
  ...rect,
});

const BOUNDS = { x: 0, y: 0, width: 400, height: 200 };

describe("layoutAnnotationBoxes", () => {
  it("leaves a clear box where it asked to be", () => {
    const layout = layoutAnnotationBoxes([box(2, { x: 10, y: 10 })], { bounds: BOUNDS });
    expect(layout.moves.get(2)).toEqual({ dx: 0, dy: 0 });
    expect(layout.dropped.size).toBe(0);
  });

  it("nudges a note off an obstacle along its free axis", () => {
    const layout = layoutAnnotationBoxes([box(1, { y: 10 })], {
      bounds: BOUNDS,
      obstacles: [{ x: 0, y: 0, width: 40, height: 14 }],
    });
    // Below the obstacle plus the solver's 2px padding: 14 + 2 − 10.
    expect(layout.moves.get(1)).toEqual({ dx: 0, dy: 6 });
  });

  it("moves the later of two equal-priority notes, never the first", () => {
    const layout = layoutAnnotationBoxes([box(3, { y: 20 }), box(4, { y: 24 })], {
      bounds: BOUNDS,
    });
    expect(layout.moves.get(3)).toEqual({ dx: 0, dy: 0 });
    expect(layout.moves.get(4)?.dy).toBe(12);
  });

  it("retries a dropped note on the other axis with the longer reach", () => {
    // A tall obstacle blocks every vertical move within 16px; 12px right clears it.
    const layout = layoutAnnotationBoxes([box(5, { width: 20 })], {
      bounds: { x: 0, y: 0, width: 400, height: 60 },
      obstacles: [{ x: 0, y: 0, width: 10, height: 60 }],
    });
    expect(layout.moves.get(5)).toEqual({ dx: 12, dy: 0 });
    expect(layout.dropped.size).toBe(0);
  });

  it("keeps a row note on its own retry axis", () => {
    // A row note slides along its row: 32px right is past the first pass's 16px
    // reach, so only the retry, still horizontal, places it.
    const layout = layoutAnnotationBoxes(
      [box(6, { anchorSide: "top", retryAnchorSide: "top", x: 100, width: 30 })],
      { bounds: BOUNDS, obstacles: [{ x: 90, y: 0, width: 40, height: 14 }] },
    );
    expect(layout.moves.get(6)).toEqual({ dx: 32, dy: 0 });
  });

  it("reports a note neither pass can place, and gives it no move", () => {
    const layout = layoutAnnotationBoxes([box(7, { x: 100, y: 100 })], {
      bounds: BOUNDS,
      obstacles: [BOUNDS],
    });
    expect([...layout.dropped]).toEqual([7]);
    expect(layout.moves.has(7)).toBe(false);
  });
});

describe("annotationLayoutBounds", () => {
  it("is the plot, widened to a box that already starts outside it", () => {
    expect(annotationLayoutBounds([{ x: 380, y: 10, width: 60, height: 14 }], 400, 200)).toEqual({
      x: 0,
      y: 0,
      width: 440,
      height: 200,
    });
  });
});
