import { describe, expect, it } from "vitest";
import { backEdgeDetour, type BackEdgeNodeRect } from "./back-edge-geometry";

/** Three cards on one rank, the shape a rework edge has to get around. */
const rank: BackEdgeNodeRect[] = [
  { x: 0, y: 200, width: 176, height: 83 },
  { x: 220, y: 200, width: 176, height: 83 },
  { x: 440, y: 200, width: 176, height: 83 },
];

describe("backEdgeDetour", () => {
  it("clears the OUTERMOST card in the band, not just the edge's own two nodes", () => {
    // The edge runs between the rank above (y 0) and the rank at y 200. Clearing only
    // its own endpoints would put the leg at 396 + 40 — inside the third card.
    expect(backEdgeDetour(rank, "vertical", [283, 100], 40)).toBe(656);
  });

  it("ignores a card on another rank entirely", () => {
    const withFarRank = [...rank, { x: 2000, y: 600, width: 176, height: 83 }];
    expect(backEdgeDetour(withFarRank, "vertical", [283, 100], 40)).toBe(656);
  });

  it("includes a card the span only touches at its edge", () => {
    // Span ends exactly on the rank's top edge: the leg still has to pass it.
    expect(backEdgeDetour(rank, "vertical", [100, 200], 40)).toBe(656);
  });

  it("measures along the other axis in a left-to-right layout", () => {
    // Ranks advance horizontally, so the return leg runs BELOW the cards.
    expect(backEdgeDetour(rank, "horizontal", [0, 616], 40)).toBe(323);
  });

  it("skips unmeasured cards rather than treating them as zero-size boxes at the origin", () => {
    const unmeasured = [{ x: 900, y: 200, width: 0, height: 0 }, ...rank];
    expect(backEdgeDetour(unmeasured, "vertical", [283, 100], 40)).toBe(656);
  });

  it("returns null when nothing is measured, so React Flow's own midpoint stands", () => {
    expect(backEdgeDetour([], "vertical", [283, 100], 40)).toBeNull();
    expect(
      backEdgeDetour([{ x: 0, y: 0, width: 0, height: 0 }], "vertical", [0, 1], 40),
    ).toBeNull();
  });

  it("reads the span in either order", () => {
    expect(backEdgeDetour(rank, "vertical", [100, 283], 40)).toBe(
      backEdgeDetour(rank, "vertical", [283, 100], 40),
    );
  });

  it("returns null when every card sits outside the span", () => {
    expect(backEdgeDetour(rank, "vertical", [400, 500], 40)).toBeNull();
  });
});
