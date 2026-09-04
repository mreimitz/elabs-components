import { describe, expect, it } from "vitest";
import { areaRadius } from "./area-radius";

describe("areaRadius", () => {
  it("draws the max value at rMax", () => {
    expect(areaRadius(100, 100, 20)).toBe(20);
  });

  it("scales by sqrt, not linearly — half the value is ~71% of rMax, not 50%", () => {
    const half = areaRadius(50, 100, 20);
    expect(half).toBeCloseTo(20 * Math.sqrt(0.5), 10);
    expect(half).toBeGreaterThan(10); // a linear scale would give exactly 10
  });

  it("doubling the value scales the radius by sqrt(2), so the AREA doubles too", () => {
    const r1 = areaRadius(25, 100, 20);
    const r2 = areaRadius(50, 100, 20);
    expect(r2 / r1).toBeCloseTo(Math.sqrt(2), 10);
    // area ratio (π r²) is what actually doubled:
    expect((r2 * r2) / (r1 * r1)).toBeCloseTo(2, 10);
  });

  it("value 0 draws radius 0", () => {
    expect(areaRadius(0, 100, 20)).toBe(0);
  });

  it("clamps a negative value to 0 rather than an imaginary radius", () => {
    expect(areaRadius(-10, 100, 20)).toBe(0);
  });

  it("returns 0 for every mark when max is 0 or negative (no divide-by-zero)", () => {
    expect(areaRadius(5, 0, 20)).toBe(0);
    expect(areaRadius(5, -3, 20)).toBe(0);
  });

  it("returns 0 when rMax is 0 or negative", () => {
    expect(areaRadius(5, 100, 0)).toBe(0);
    expect(areaRadius(5, 100, -1)).toBe(0);
  });
});
