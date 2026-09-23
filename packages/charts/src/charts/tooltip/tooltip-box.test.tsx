/**
 * #605 — the `table` tooltip preset (RM-119, #481) is wide enough (~245px)
 * that at a 380px container it can overflow the viewport's left edge: the X
 * placement only ever flips between "right of cursor" and "left of cursor"
 * (`shouldFlipX` in `tooltip-box.tsx`) with no clamp into
 * `[offset, containerWidth - tw - offset], unlike Y (`targetY`), which has
 * always had that clamp. `computeTooltipTarget` is the shared, exported
 * flip + clamp math both the initial render and the `useLayoutEffect`
 * resize recompute call, so this is unit-tested directly rather than through
 * a Motion-animated DOM render.
 */

import { describe, expect, it } from "vitest";
import { computeTooltipTarget } from "./tooltip-box";

describe("computeTooltipTarget", () => {
  const offset = 16;
  const tw = 180;
  const th = 80;
  const containerHeight = 300;

  it("clamps a left-flipped placement to the container's left edge instead of going negative", () => {
    // Narrow container (250px) relative to the tooltip (180px + 2*16px
    // margin = 212px doesn't leave much room): an anchor in the left half
    // still triggers the flip (x + tw + offset > containerWidth), and the
    // unclamped "left of cursor" position (x - offset - tw) goes negative.
    const containerWidth = 250;
    const x = 60;
    expect(x + tw + offset).toBeGreaterThan(containerWidth); // flip triggers
    expect(x - offset - tw).toBeLessThan(0); // the unclamped bug

    const result = computeTooltipTarget({
      x,
      y: 100,
      tw,
      th,
      containerWidth,
      containerHeight,
      offset,
    });

    expect(result.flipped).toBe(true);
    expect(result.x).toBeGreaterThanOrEqual(offset);
    expect(result.x + tw).toBeLessThanOrEqual(containerWidth - offset);
  });

  it("reproduces the #605 repro shape: a 380px container with the ~245px table variant", () => {
    // Matches the issue's real numbers (variant="table", tw≈245.1,
    // containerWidth 380) rather than the component's own 180px default.
    const containerWidth = 380;
    const wideTw = 245.1;
    const x = 190; // hover near the right side of the plot

    const result = computeTooltipTarget({
      x,
      y: 100,
      tw: wideTw,
      th,
      containerWidth,
      containerHeight,
      offset,
    });

    expect(result.x).toBeGreaterThanOrEqual(offset);
    expect(result.x + wideTw).toBeLessThanOrEqual(containerWidth - offset);
  });

  it("clamps an unflipped placement to the container's right edge instead of touching it", () => {
    // Same narrow 250px container: just below the flip threshold, the
    // unclamped "right of cursor" position (x + offset) plus the tooltip
    // width lands flush on the container's right edge (0 margin) instead of
    // respecting the offset margin.
    const containerWidth = 250;
    const x = 54;
    expect(x + tw + offset).toBeLessThanOrEqual(containerWidth); // flip does NOT trigger
    expect(x + offset + tw).toBeGreaterThan(containerWidth - offset); // the unclamped bug

    const result = computeTooltipTarget({
      x,
      y: 100,
      tw,
      th,
      containerWidth,
      containerHeight,
      offset,
    });

    expect(result.flipped).toBe(false);
    expect(result.x).toBeGreaterThanOrEqual(offset);
    expect(result.x + tw).toBeLessThanOrEqual(containerWidth - offset);
  });

  it("still clamps Y within [offset, containerHeight - th - offset] (regression guard)", () => {
    const result = computeTooltipTarget({
      x: 100,
      y: 5,
      tw,
      th,
      containerWidth: 380,
      containerHeight,
      offset,
    });
    expect(result.y).toBeGreaterThanOrEqual(offset);
    expect(result.y).toBeLessThanOrEqual(containerHeight - th - offset);
  });

  it("does not flip and does not clamp when the tooltip already fits comfortably", () => {
    const result = computeTooltipTarget({
      x: 50,
      y: 100,
      tw,
      th,
      containerWidth: 800,
      containerHeight,
      offset,
    });
    expect(result.flipped).toBe(false);
    expect(result.x).toBe(50 + offset);
  });
});
