import { describe, expect, it, vi } from "vitest";

// getEdgeParams imports the `Position` enum (a value) from @xyflow/react. The
// real package needs browser layout; mock it down to the Position constants so
// the PURE geometry can be exercised in jsdom.
vi.mock("@xyflow/react", () => ({
  Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
}));

import { getEdgeParams, type FloatingNodeGeometry } from "./floating-edge-geometry";

/** 100×60 node whose top-left sits at (x, y). */
function node(x: number, y: number, width = 100, height = 60): FloatingNodeGeometry {
  return { internals: { positionAbsolute: { x, y } }, measured: { width, height } };
}

describe("getEdgeParams (floating edge border intersection)", () => {
  it("target directly to the right → source exits right, target enters left", () => {
    const source = node(0, 0);
    const target = node(300, 0);
    const p = getEdgeParams(source, target);

    expect(p.sourcePos).toBe("right");
    expect(p.targetPos).toBe("left");
    // Source border point is on the right edge (x = 100), target on left (x = 300).
    expect(p.sx).toBeCloseTo(100);
    expect(p.tx).toBeCloseTo(300);
    // Both attach at the vertical center (y = 30).
    expect(p.sy).toBeCloseTo(30);
    expect(p.ty).toBeCloseTo(30);
  });

  it("target directly to the left → source exits left, target enters right", () => {
    const p = getEdgeParams(node(300, 0), node(0, 0));
    expect(p.sourcePos).toBe("left");
    expect(p.targetPos).toBe("right");
    expect(p.sx).toBeCloseTo(300);
    expect(p.tx).toBeCloseTo(100);
  });

  it("target directly below → source exits bottom, target enters top", () => {
    const source = node(0, 0);
    const target = node(0, 300);
    const p = getEdgeParams(source, target);

    expect(p.sourcePos).toBe("bottom");
    expect(p.targetPos).toBe("top");
    // Source bottom edge (y = 60), target top edge (y = 300).
    expect(p.sy).toBeCloseTo(60);
    expect(p.ty).toBeCloseTo(300);
    // Horizontal center (x = 50).
    expect(p.sx).toBeCloseTo(50);
    expect(p.tx).toBeCloseTo(50);
  });

  it("target directly above → source exits top, target enters bottom", () => {
    const p = getEdgeParams(node(0, 300), node(0, 0));
    expect(p.sourcePos).toBe("top");
    expect(p.targetPos).toBe("bottom");
    expect(p.sy).toBeCloseTo(300);
    expect(p.ty).toBeCloseTo(60);
  });

  it("diagonal placement → the point lands EXACTLY on a border (not inside)", () => {
    const source = node(0, 0);
    const target = node(300, 300);
    const p = getEdgeParams(source, target);

    // Facing down-right, this 100×60 node exits its BOTTOM edge (y = 60) at x = 80.
    expect(p.sourcePos).toBe("bottom");
    expect(p.sy).toBeCloseTo(60); // exactly on the border, never a hair inside
    expect(p.sx).toBeCloseTo(80);
    // The target (up-left of its own centre) enters its TOP edge (y = 300).
    expect(p.targetPos).toBe("top");
    expect(p.ty).toBeCloseTo(300);
    expect(p.tx).toBeCloseTo(320);
  });

  it("wide node (story aspect ratio) → the near-horizontal edge exits the right side on-border", () => {
    // ~176×80 card (min-w-44) with a target up and to the right.
    const source = node(0, 0, 180, 80);
    const target = node(500, -200, 180, 80);
    const p = getEdgeParams(source, target);

    expect(p.sourcePos).toBe("right");
    expect(p.sx).toBeCloseTo(180); // exactly the right border, not inside the card
    expect(p.sy).toBeGreaterThanOrEqual(0);
    expect(p.sy).toBeLessThanOrEqual(80);
  });

  it("an unmeasured node does not throw and yields finite coordinates", () => {
    const source: FloatingNodeGeometry = {
      internals: { positionAbsolute: { x: 0, y: 0 } },
      measured: {},
    };
    const p = getEdgeParams(source, node(300, 0));
    expect(Number.isFinite(p.sx)).toBe(true);
    expect(Number.isFinite(p.sy)).toBe(true);
  });
});
