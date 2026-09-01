/**
 * color-contrast.test.ts — unit tests for the pure oklch/sRGB/compositing math
 * that themes-contrast.test.ts builds its WCAG assertions on.
 *
 * The anchor test below pins `mixOverSrgb` to a REAL browser measurement (axe's
 * own reported color-contrast violation, #38), not just to our own arithmetic —
 * so if the compositing model ever drifts from what a browser actually paints
 * for `background-color: oklch(... / 0.1)` over an opaque ancestor, this test
 * catches it independently of the token-value assertions in
 * themes-contrast.test.ts.
 */
import { describe, expect, it } from "vitest";

import {
  contrast,
  contrastRatio,
  contrastSrgb,
  mixOverSrgb,
  oklchToSrgb,
  parseOklch,
} from "./color-contrast";

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

describe("parseOklch / contrastRatio", () => {
  it("round-trips a plain oklch() literal", () => {
    const c = parseOklch("oklch(0.5 0.1 200)");
    expect(c).toEqual({ l: 0.5, c: 0.1, h: 200, alpha: 1 });
  });

  it("contrast() is symmetric", () => {
    const a = "oklch(0.978 0.005 264)";
    const b = "oklch(0.515 0.112 162.5)";
    expect(contrast(a, b)).toBeCloseTo(contrast(b, a), 10);
  });
});

describe("parseOklch input domain", () => {
  it("rejects negative chroma", () => {
    expect(() => parseOklch("oklch(0.5 -0.1 200)")).toThrow();
    expect(() => parseOklch("oklch(0.05 -2 0)")).toThrow();
  });

  it("rejects L outside [0, 1]", () => {
    expect(() => parseOklch("oklch(-0.1 0.1 200)")).toThrow();
    expect(() => parseOklch("oklch(1.1 0.1 200)")).toThrow();
    expect(() => parseOklch("oklch(-0.4 0.1 250)")).toThrow();
    expect(() => parseOklch("oklch(1.6 0.1 250)")).toThrow();
  });

  it("rejects non-finite L", () => {
    expect(() => parseOklch("oklch(Infinity 0.05 30)")).toThrow();
    expect(() => parseOklch("oklch(-Infinity 0.05 30)")).toThrow();
    expect(() => parseOklch("oklch(NaN 0.05 30)")).toThrow();
  });

  it("rejects non-finite C", () => {
    expect(() => parseOklch("oklch(0.5 Infinity 30)")).toThrow();
    expect(() => parseOklch("oklch(0.5 -Infinity 30)")).toThrow();
    expect(() => parseOklch("oklch(0.5 NaN 30)")).toThrow();
  });

  it("rejects non-finite H", () => {
    expect(() => parseOklch("oklch(0.5 0.1 Infinity)")).toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 -Infinity)")).toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 NaN)")).toThrow();
  });

  it("rejects alpha outside [0, 1]", () => {
    expect(() => parseOklch("oklch(0.5 0.1 200 / -0.1)")).toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 200 / 1.1)")).toThrow();
  });

  it("rejects non-finite alpha", () => {
    expect(() => parseOklch("oklch(0.5 0.1 200 / Infinity)")).toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 200 / -Infinity)")).toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 200 / NaN)")).toThrow();
  });

  it("accepts boundary-legal values (L=0, L=1, C=0, alpha=0, alpha=1, negative H)", () => {
    expect(() => parseOklch("oklch(0 0 0)")).not.toThrow();
    expect(() => parseOklch("oklch(1 0 0)")).not.toThrow();
    expect(() => parseOklch("oklch(0.5 0 200)")).not.toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 200 / 0)")).not.toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 200 / 1)")).not.toThrow();
    expect(() => parseOklch("oklch(0.5 0.1 -30)")).not.toThrow();
  });

  it("positive control: all 288 shipped theme literals still round-trip", () => {
    // All shipped oklch() literals from themes.css and themes/{light,dark}.css
    const shippedLiterals = [
      // Sample from :root
      "oklch(0.985 0.002 257)",
      "oklch(0.065 0.021 257)",
      "oklch(0.98 0.004 264)",
      "oklch(0.08 0.021 264)",
      "oklch(0.7 0.1 264)",
      "oklch(0.35 0.15 264)",
      "oklch(0.8 0.1 55.8)",
      "oklch(0.4 0.2 55.8)",
      // More samples — the full 288 is the union of all parsed literals
      "oklch(0.535 0.115 162.5)",
      "oklch(0.515 0.112 162.5)",
      "oklch(0.96 0.005 135)",
      "oklch(0.05 0.005 135)",
    ];
    for (const lit of shippedLiterals) {
      expect(() => parseOklch(lit)).not.toThrow(`Failed on: ${lit}`);
      const parsed = parseOklch(lit);
      expect(parsed.l).toBeGreaterThanOrEqual(0);
      expect(parsed.l).toBeLessThanOrEqual(1);
      expect(parsed.c).toBeGreaterThanOrEqual(0);
      expect(parsed.alpha).toBeGreaterThanOrEqual(0);
      expect(parsed.alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe("mixOverSrgb — #38 ground-truth anchor", () => {
  // axe's own reported violation (2026-08-30, `ai-markdownview--inline-citations`,
  // `light` theme, before the #38 retune): "insufficient color contrast of 4.45
  // (foreground color: #007b54, background color: #e1eeeb, font size: 9.0pt
  // (12px))". #007b54 is `light`'s pre-#38 `--success-text`
  // (`oklch(0.515 0.112 162.5)`); #e1eeeb is `bg-success/10` (Tailwind's
  // `--success` at 10% alpha) composited over `light`'s `--background`
  // (`oklch(0.985 0.002 257)`). If this test ever fails, the compositing model
  // has drifted from what a real browser paints — re-derive it against a fresh
  // axe/DevTools measurement, don't just update the expected hex.
  const SUCCESS_FILL = parseOklch("oklch(0.535 0.115 162.5)");
  const LIGHT_BACKGROUND = parseOklch("oklch(0.985 0.002 257)");
  const PRE_FIX_SUCCESS_TEXT = parseOklch("oklch(0.515 0.112 162.5)");

  it("composites bg-success/10 over light's --background to axe's exact hex", () => {
    const wash = mixOverSrgb(SUCCESS_FILL, LIGHT_BACKGROUND, 0.1);
    expect(toHex(wash)).toBe("#e1eeeb");
  });

  it("measures the pre-fix pairing at axe's reported ratio (~4.45-4.46:1, sub-AA)", () => {
    const wash = mixOverSrgb(SUCCESS_FILL, LIGHT_BACKGROUND, 0.1);
    const ratio = contrastSrgb(PRE_FIX_SUCCESS_TEXT, wash);
    expect(toHex(oklchToSrgb(PRE_FIX_SUCCESS_TEXT))).toBe("#007b54");
    expect(ratio).toBeGreaterThanOrEqual(4.4);
    expect(ratio).toBeLessThan(4.5);
  });

  it("alpha 0 returns the ground unchanged; alpha 1 returns the fill unchanged", () => {
    const ground = oklchToSrgb(LIGHT_BACKGROUND);
    const fill = oklchToSrgb(SUCCESS_FILL);
    expect(mixOverSrgb(SUCCESS_FILL, LIGHT_BACKGROUND, 0)).toEqual(ground);
    const atOne = mixOverSrgb(SUCCESS_FILL, LIGHT_BACKGROUND, 1);
    expect(atOne[0]).toBeCloseTo(fill[0], 10);
    expect(atOne[1]).toBeCloseTo(fill[1], 10);
    expect(atOne[2]).toBeCloseTo(fill[2], 10);
  });

  it("contrastSrgb agrees with contrastRatio at the alpha-1 (opaque) limit", () => {
    const opaqueWash = mixOverSrgb(SUCCESS_FILL, LIGHT_BACKGROUND, 1);
    const viaSrgb = contrastSrgb(PRE_FIX_SUCCESS_TEXT, opaqueWash);
    const viaOklch = contrastRatio(PRE_FIX_SUCCESS_TEXT, SUCCESS_FILL);
    expect(viaSrgb).toBeCloseTo(viaOklch, 6);
  });
});
