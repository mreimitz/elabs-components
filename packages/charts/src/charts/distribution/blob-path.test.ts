import { describe, expect, it } from "vitest";
import { blobPath, type BlobPoint } from "./blob-path";

const square: BlobPoint[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("blobPath", () => {
  it("returns an empty (valid, invisible) d for fewer than two points", () => {
    expect(blobPath([])).toBe("");
    expect(blobPath([{ x: 1, y: 1 }])).toBe("");
  });

  it("starts and ends exactly on the caller's points when open", () => {
    const d = blobPath([
      { x: 0, y: 0 },
      { x: 5, y: 8 },
      { x: 10, y: 0 },
    ]);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("10 0")).toBe(true);
  });

  it("draws a straight segment for two points", () => {
    expect(
      blobPath([
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ]),
    ).toBe("M 0 0 Q 0 0 4 4");
  });

  it("closes a closed path and gives it one Q per point", () => {
    const d = blobPath(square, true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(square.length);
    // The closed form starts at the SEAM's midpoint, never at a sample — that is
    // what stops the wrap-around from being the one corner in the outline.
    expect(d.startsWith("M 0 5")).toBe(true);
  });

  it("never leaves the control polygon — the reason this is not a cubic", () => {
    // Every coordinate a quadratic-midpoint path emits is either a sample or a
    // midpoint of two samples, so the whole path is inside the samples' bounding
    // box. An overshooting spline would put a violin's outline outside its own
    // density estimate.
    const numbers = blobPath(square, true)
      .split(/[^\d.-]+/)
      .filter(Boolean)
      .map(Number);
    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});
