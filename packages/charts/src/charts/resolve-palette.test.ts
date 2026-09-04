/**
 * resolve-palette.test.ts — the ordered-ramp resolver (RM-018).
 *
 * `resolvePalette` is the one place "which colours does this chart draw with"
 * is decided, so the things worth locking are the CONTRACTS a container relies
 * on, not the literal strings: every result is a `var(--chart-…)` reference (so
 * a theme flip re-colours with no re-render), a spread always includes both
 * ends of its ramp, and the six-category cap degrades rather than hands back
 * near-neighbour hues that only look like categories.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CATEGORICAL_SOFT_CAP,
  chartAccentColor,
  chartDivergingRamp,
  chartMonoRamp,
  chartSequentialRamp,
  defaultScatterColors,
  resolvePalette,
} from "./chart-context";

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe("resolvePalette", () => {
  it("only ever returns token references, never colour literals", () => {
    for (const palette of ["categorical", "sequential", "diverging", "mono", "accent"] as const) {
      for (const value of resolvePalette(palette, 5)) {
        expect(value, `${palette} returned ${value}`).toMatch(/^var\(--chart-[\w-]+\)$/);
      }
    }
  });

  it("returns nothing for a non-positive count", () => {
    expect(resolvePalette("sequential", 0)).toEqual([]);
    expect(resolvePalette("categorical", -1)).toEqual([]);
  });

  // The acceptance case from RM-018: five buckets over a seven-step ladder.
  it("spreads a sequential request evenly across the seven steps, ends included", () => {
    expect(resolvePalette("sequential", 5)).toEqual([
      "var(--chart-seq-1)",
      "var(--chart-seq-3)",
      "var(--chart-seq-4)",
      "var(--chart-seq-6)",
      "var(--chart-seq-7)",
    ]);
    const full = resolvePalette("sequential", 7);
    expect(full).toEqual([...chartSequentialRamp]);
  });

  it("gives a single bucket the MOST intense step, not the palest", () => {
    expect(resolvePalette("sequential", 1)).toEqual(["var(--chart-seq-7)"]);
    expect(resolvePalette("mono", 1)).toEqual(["var(--chart-mono-7)"]);
  });

  it("keeps both ends of the diverging ramp whatever the count", () => {
    for (const n of [2, 3, 4, 5, 9]) {
      const out = resolvePalette("diverging", n);
      expect(out).toHaveLength(n);
      expect(out[0]).toBe(chartDivergingRamp[0]);
      expect(out.at(-1)).toBe(chartDivergingRamp.at(-1));
    }
  });

  it("draws the accent palette as one hero over the neutral ladder", () => {
    const out = resolvePalette("accent", 4);
    expect(out[0]).toBe(chartAccentColor);
    expect(out.slice(1).every((c) => (chartMonoRamp as readonly string[]).includes(c))).toBe(true);
    expect(resolvePalette("accent", 1)).toEqual([chartAccentColor]);
  });

  it("hands back the categorical ramp in order up to the cap", () => {
    expect(resolvePalette("categorical", CATEGORICAL_SOFT_CAP)).toEqual(
      defaultScatterColors.slice(0, CATEGORICAL_SOFT_CAP),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("degrades past the six-category cap to the neutral ladder, warning once", () => {
    const out = resolvePalette("categorical", 9);
    expect(out).toHaveLength(9);
    expect(out.every((c) => (chartMonoRamp as readonly string[]).includes(c))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("9 categorical series");
    // A container re-renders; the warning must not re-log every frame.
    resolvePalette("categorical", 9);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("honours an EXPLICIT categorical request past the cap, in silence", () => {
    const out = resolvePalette("categorical", 8, { explicit: true });
    expect(out).toEqual(defaultScatterColors.slice(0, 8));
    expect(warn).not.toHaveBeenCalled();
  });

  it("defaults to categorical", () => {
    expect(resolvePalette(undefined, 3)).toEqual(defaultScatterColors.slice(0, 3));
  });
});
