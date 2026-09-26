import { describe, expect, it } from "vitest";
import { hasSelection, resolveSelection } from "./selection";

const pts = {
  x: Float32Array.from([0, 1, 2, 3, 4]),
  y: Float32Array.from([0, 1, 2, 3, 4]),
  n: 5,
  values: {},
  categories: {},
};
const cls = new Uint8Array(5);

describe("DensityScatterSelection.points", () => {
  it("counts as a selection", () => {
    expect(hasSelection({ points: [2] })).toBe(true);
    expect(hasSelection({ points: [] })).toBe(false);
  });

  it("selects only the picked rows when nothing else constrains", () => {
    const out = new Uint8Array(5);
    resolveSelection(pts, cls, [], { points: [1, 3] }, out);
    expect(Array.from(out)).toEqual([0, 255, 0, 255, 0]);
  });

  it("unions picked rows with the shape constraints", () => {
    const out = new Uint8Array(5);
    resolveSelection(pts, cls, [], { x: [0, 1], points: [4] }, out);
    expect(Array.from(out)).toEqual([255, 255, 0, 0, 255]);
  });
});
