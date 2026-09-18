import { describe, expect, it } from "vitest";
import { type LabelBox, layoutLabels } from "./label-layout";

/** Four end labels stacked at the right edge of a plot `width` px wide. */
function endLabels(width: number, ys: number[]): LabelBox[] {
  return ys.map((y, i) => ({
    id: `series-${i}`,
    x: width - 60,
    y: y - 7,
    width: 56,
    height: 14,
    priority: ys.length - i,
    anchorSide: "left" as const,
  }));
}

/** Thirty bubble labels on a grid, denser (more overlap) the narrower the plot. */
function bubbleLabels(width: number): LabelBox[] {
  return Array.from({ length: 30 }, (_, i) => {
    const col = i % 10;
    const row = Math.floor(i / 10);
    return {
      id: `bubble-${i}`,
      x: (col / 9) * (width - 64),
      y: 20 + row * 40,
      width: 64,
      height: 14,
      priority: i,
      anchorSide: "bottom" as const,
    };
  });
}

describe("layoutLabels", () => {
  it("keeps non-colliding labels at their preferred position", () => {
    const result = layoutLabels(endLabels(900, [20, 80, 140, 200]));
    expect(result.placements.map((p) => p.status)).toEqual([
      "placed",
      "placed",
      "placed",
      "placed",
    ]);
    expect(result.dropped).toEqual([]);
  });

  it("nudges colliding end labels along y (900 px fixture) so none overlap", () => {
    const result = layoutLabels(endLabels(900, [100, 106, 112, 200]), { maxNudge: 40 });
    expect(result.dropped).toEqual([]);
    const ys = result.placed.map((p) => p.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) {
      expect((ys[i] as number) - (ys[i - 1] as number)).toBeGreaterThanOrEqual(14);
    }
    // Nudges are vertical only — the x of an end label never moves.
    expect(result.placed.every((p) => p.dx === 0)).toBe(true);
    expect(result.placements[0]?.status).toBe("placed");
  });

  it("drops the lowest priority first when a nudge cannot clear it", () => {
    const labels = endLabels(380, [100, 100, 100]);
    const result = layoutLabels(labels, { maxNudge: 4 });
    expect(result.placed.map((p) => p.id)).toEqual(["series-0"]);
    expect(result.dropped.map((d) => d.id)).toEqual(["series-1", "series-2"]);
  });

  it("paints fewer bubble labels at 380 px than at 900 px, keeping the highest priorities", () => {
    const wide = layoutLabels(bubbleLabels(900), {
      bounds: { x: 0, y: 0, width: 900, height: 200 },
    });
    const narrow = layoutLabels(bubbleLabels(380), {
      bounds: { x: 0, y: 0, width: 380, height: 200 },
    });
    expect(narrow.placed.length).toBeLessThan(wide.placed.length);
    expect(narrow.placed.length + narrow.dropped.length).toBe(30);
    // The highest-priority label of every row survives the cull.
    for (const id of ["bubble-9", "bubble-19", "bubble-29"]) {
      expect(narrow.placed.some((p) => p.id === id)).toBe(true);
    }
  });

  it("never lets two placed boxes overlap (380 and 900 px)", () => {
    for (const width of [380, 900]) {
      const { placed } = layoutLabels(bubbleLabels(width), {
        bounds: { x: 0, y: 0, width, height: 200 },
      });
      for (let i = 0; i < placed.length; i += 1) {
        for (let j = i + 1; j < placed.length; j += 1) {
          const a = placed[i]!;
          const b = placed[j]!;
          const apart =
            a.x + a.label.width <= b.x ||
            b.x + b.label.width <= a.x ||
            a.y + a.label.height <= b.y ||
            b.y + b.label.height <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it("clamps into bounds along the free axis and drops what overflows the fixed axis", () => {
    const result = layoutLabels(
      [
        { id: "edge", x: 350, y: 10, width: 40, height: 14, anchorSide: "bottom" },
        { id: "above", x: 10, y: -30, width: 40, height: 14, anchorSide: "bottom" },
      ],
      { bounds: { x: 0, y: 0, width: 380, height: 200 } },
    );
    expect(result.placements[0]?.status).toBe("nudged");
    expect(result.placements[0]?.x).toBe(340);
    expect(result.placements[1]?.status).toBe("dropped");
  });

  it("avoids obstacles", () => {
    const result = layoutLabels([{ id: "a", x: 0, y: 0, width: 20, height: 10 }], {
      obstacles: [{ x: 0, y: 0, width: 20, height: 5 }],
      padding: 0,
    });
    expect(result.placements[0]).toMatchObject({ status: "nudged", dy: 5 });
  });

  it("is deterministic — equal input, equal output", () => {
    const a = layoutLabels(bubbleLabels(380));
    const b = layoutLabels(bubbleLabels(380));
    expect(a).toEqual(b);
  });
});
