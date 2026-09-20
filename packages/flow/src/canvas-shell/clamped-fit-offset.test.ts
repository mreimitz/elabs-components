import { describe, expect, it } from "vitest";
import { clampedFitOffset } from "./clamped-fit-offset";

describe("clampedFitOffset", () => {
  const axis = { size: 1000, pad: 100, start: 0, extent: 4000, zoom: 0.75 };

  it("pins the content's start at the padding when there is no anchor", () => {
    expect(clampedFitOffset(axis)).toBe(100);
    expect(clampedFitOffset({ ...axis, start: 200 })).toBe(100 - 200 * 0.75);
  });

  it("an anchor at the content's start lands exactly where the corner pin does", () => {
    expect(clampedFitOffset({ ...axis, anchorCentre: 90 })).toBe(100);
  });

  it("centres an anchor that sits in the middle of the overflowing axis", () => {
    // Anchor centre at 2000 → 1500 px at zoom 0.75 → offset 500 - 1500.
    expect(clampedFitOffset({ ...axis, anchorCentre: 2000 })).toBe(-1000);
  });

  it("never scrolls past the content's end", () => {
    // End pinned: 1000 - 100 - 4000 * 0.75 = -2100; an anchor at the very end asks for less.
    expect(clampedFitOffset({ ...axis, anchorCentre: 3990 })).toBe(-2100);
  });
});
