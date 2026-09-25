/**
 * `resolveValueDomain` (RM-165): the raw value domain for a set of values —
 * zero-anchored or fitted to the data — before `computeYDomainsByAxis` nices it.
 */

import { describe, expect, it } from "vitest";
import { resolveValueDomain } from "./y-domain-utils";

describe("resolveValueDomain", () => {
  it("anchors non-negative values at zero with headroom above the max", () => {
    // Exactly ScatterChart's historical `[0, max * 1.1]`.
    expect(resolveValueDomain([420, 510, 390], { includeZero: true, pad: 0.1 })).toEqual([
      0,
      510 * 1.1,
    ]);
    expect(resolveValueDomain([7], { includeZero: true, pad: 0.1 })).toEqual([0, 7 * 1.1]);
  });

  it("falls back to [0, 100] with no finite value or only zeros under a zero anchor", () => {
    expect(resolveValueDomain([], { includeZero: true })).toEqual([0, 100]);
    expect(resolveValueDomain([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0, 100]);
    expect(resolveValueDomain([0, 0], { includeZero: true })).toEqual([0, 100]);
  });

  it("pads each signed end away from zero under a zero anchor", () => {
    const [lo, hi] = resolveValueDomain([-20, 50], { includeZero: true, pad: 0.1 });
    expect(lo).toBeCloseTo(-22);
    expect(hi).toBeCloseTo(55);
    // All negative: zero stays the (unpadded) top.
    const [negLo, negHi] = resolveValueDomain([-40, -10], { includeZero: true, pad: 0.1 });
    expect(negLo).toBeCloseTo(-44);
    expect(negHi).toBe(0);
  });

  it("fits the data with span padding when not anchored at zero", () => {
    const [lo, hi] = resolveValueDomain([-40, 0, 60], { pad: 0.1 });
    expect(lo).toBeCloseTo(-50);
    expect(hi).toBeCloseTo(70);
    const [allNegLo, allNegHi] = resolveValueDomain([-80, -20], { pad: 0.1 });
    expect(allNegLo).toBeCloseTo(-86);
    expect(allNegHi).toBeCloseTo(-14);
  });

  it("gives a single value a non-empty span from its own magnitude", () => {
    const [lo, hi] = resolveValueDomain([-40], { pad: 0.1 });
    expect(lo).toBeCloseTo(-44);
    expect(hi).toBeCloseTo(-36);
    const [zeroLo, zeroHi] = resolveValueDomain([0], { pad: 0.1 });
    expect(zeroLo).toBeCloseTo(-0.1);
    expect(zeroHi).toBeCloseTo(0.1);
  });

  it("skips non-finite values", () => {
    expect(resolveValueDomain([Number.NaN, 10, 20], { includeZero: true, pad: 0.1 })).toEqual([
      0,
      20 * 1.1,
    ]);
  });
});
