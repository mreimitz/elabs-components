/**
 * threshold-band.test.ts — the ascending-band lookup Bullet's qualitative
 * ranges and Gauge's threshold bands share (RM-204 fix round, P2 item 7: this
 * had no unit test of its own, only indirect coverage through those two
 * families).
 */
import { describe, expect, it } from "vitest";
import { findThresholdBand } from "./threshold-band";

interface Band {
  to: number;
  label: string;
}

const bands: Band[] = [
  { to: 30, label: "poor" },
  { to: 70, label: "satisfactory" },
  { to: 100, label: "good" },
];
const upperBound = (band: Band) => band.to;

describe("findThresholdBand", () => {
  it("returns the first band whose upper bound is at least the value", () => {
    expect(findThresholdBand(10, bands, upperBound)?.label).toBe("poor");
    expect(findThresholdBand(50, bands, upperBound)?.label).toBe("satisfactory");
  });

  it("is inclusive at a band's own boundary", () => {
    expect(findThresholdBand(30, bands, upperBound)?.label).toBe("poor");
    expect(findThresholdBand(70, bands, upperBound)?.label).toBe("satisfactory");
  });

  it("falls to the last (open-ended, top) band once value exceeds every bound", () => {
    expect(findThresholdBand(500, bands, upperBound)?.label).toBe("good");
  });

  it("returns the first band for a value below every bound (no band is open at the bottom)", () => {
    expect(findThresholdBand(-10, bands, upperBound)?.label).toBe("poor");
  });

  it("returns undefined for an empty band list", () => {
    expect(findThresholdBand(50, [], upperBound)).toBeUndefined();
  });

  it("returns the one band in a single-band list, whatever the value", () => {
    const one: Band[] = [{ to: 50, label: "only" }];
    expect(findThresholdBand(-5, one, upperBound)?.label).toBe("only");
    expect(findThresholdBand(500, one, upperBound)?.label).toBe("only");
  });
});
