/**
 * Locking test for `deriveTheme` (issue #39).
 *
 * Computes REAL WCAG contrast ratios and OKLab ΔE from the function's actual
 * output — nothing here is a docstring claim. Covers a spread of ordinary
 * seeds plus four named HOSTILE cases (very light primary, very dark primary,
 * low-chroma primary, primary close to background) that are the ones most
 * likely to break a naive derivation.
 */
import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch, type Oklch } from "./color-contrast";
import { deriveTheme, type DeriveThemeOptions } from "./derive-theme";
import { THEME_TOKEN_NAMES, type ThemeTokenName } from "./theme-token-names.generated";

const AA_TEXT = 4.5;
const AA_NONTEXT = 3;

/** OKLab ΔE (simple Euclidean distance in L/a/b — matches themes-contrast.test.ts's own helper). */
function oklabDistance(a: Oklch, b: Oklch): number {
  const toLab = (o: Oklch) => {
    const hr = (o.h * Math.PI) / 180;
    return { L: o.l, a: o.c * Math.cos(hr), b: o.c * Math.sin(hr) };
  };
  const la = toLab(a);
  const lb = toLab(b);
  return Math.sqrt((la.L - lb.L) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

/** `light` reference theme's own `--background` (packages/tokens/src/themes/light.css). */
const LIGHT_BACKGROUND = "oklch(0.985 0.002 257)";
/** `dark` reference theme's own `--background` (packages/tokens/src/themes/dark.css). */
const DARK_BACKGROUND = "oklch(0.21 0.012 257)";

interface Case {
  name: string;
  options: DeriveThemeOptions;
}

const CASES: Case[] = [
  { name: "ordinary blue", options: { primary: "oklch(0.55 0.18 250)" } },
  { name: "ordinary red/orange", options: { primary: "oklch(0.62 0.2 25)" } },
  { name: "ordinary green", options: { primary: "oklch(0.6 0.15 145)" } },
  {
    name: "ordinary purple, dark background",
    options: { primary: "oklch(0.5 0.2 300)", background: DARK_BACKGROUND },
  },
  // --- Named hostile cases (issue #39) ---
  { name: "HOSTILE: very light primary", options: { primary: "oklch(0.95 0.05 250)" } },
  { name: "HOSTILE: very dark primary", options: { primary: "oklch(0.12 0.05 250)" } },
  { name: "HOSTILE: low-chroma (near-grey) primary", options: { primary: "oklch(0.5 0.01 250)" } },
  {
    name: "HOSTILE: primary close to background",
    options: { primary: "oklch(0.98 0.003 257)" }, // ~identical to LIGHT_BACKGROUND
  },
  {
    name: "HOSTILE: very light primary on dark background",
    options: { primary: "oklch(0.95 0.05 250)", background: DARK_BACKGROUND },
  },
  {
    name: "HOSTILE: very dark primary on dark background",
    options: { primary: "oklch(0.12 0.05 250)", background: DARK_BACKGROUND },
  },
];

describe("deriveTheme", () => {
  describe.each(CASES)("$name", ({ options }) => {
    const result = deriveTheme(options);
    const background = parseOklch(options.background ?? LIGHT_BACKGROUND);

    it("returns only real ThemeTokenName keys (no stray/invalid keys)", () => {
      // deriveTheme is a PARTIAL patch, not a full theme (ADR 0031 "partial
      // patch, not a replacement") — assert every key it DOES emit is a
      // genuine member of the token contract, not that it emits all of it.
      for (const key of Object.keys(result)) {
        expect(THEME_TOKEN_NAMES).toContain(key as ThemeTokenName);
      }
      // And it must emit the tokens the issue names.
      expect(Object.keys(result).sort()).toEqual(
        ["--accent", "--accent-foreground", "--primary", "--primary-foreground", "--ring"].sort(),
      );
    });

    it("--primary passes through unchanged", () => {
      expect(result["--primary"]).toBe(options.primary.trim());
    });

    it("--primary-foreground clears AA text contrast (>=4.5:1) against --primary", () => {
      const primary = parseOklch(result["--primary"]!);
      const fg = parseOklch(result["--primary-foreground"]!);
      const ratio = contrastRatio(fg, primary);
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("--accent-foreground clears AA text contrast (>=4.5:1) against --accent", () => {
      const accent = parseOklch(result["--accent"]!);
      const fg = parseOklch(result["--accent-foreground"]!);
      const ratio = contrastRatio(fg, accent);
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("--ring clears WCAG 1.4.11 non-text contrast (>=3:1) against the resolved background", () => {
      const ring = parseOklch(result["--ring"]!);
      const ratio = contrastRatio(ring, background);
      expect(ratio).toBeGreaterThanOrEqual(AA_NONTEXT);
    });

    it("--ring stays within 20 degrees of --primary's hue (ADR 0027 clause 1)", () => {
      const primary = parseOklch(result["--primary"]!);
      const ring = parseOklch(result["--ring"]!);
      const rawGap = Math.abs(ring.h - primary.h);
      const hueGap = Math.min(rawGap, 360 - rawGap);
      expect(hueGap).toBeLessThanOrEqual(20);
    });

    it("--primary and --accent stay perceptibly distinct (ΔE >= 0.05 OKLab)", () => {
      const primary = parseOklch(result["--primary"]!);
      const accent = parseOklch(result["--accent"]!);
      expect(oklabDistance(primary, accent)).toBeGreaterThanOrEqual(0.05);
    });
  });

  it("throws on malformed primary input", () => {
    expect(() => deriveTheme({ primary: "not-a-color" })).toThrow();
    expect(() => deriveTheme({ primary: "#ff0000" })).toThrow();
    expect(() => deriveTheme({ primary: "" })).toThrow();
  });

  it("throws on malformed background input", () => {
    expect(() =>
      deriveTheme({ primary: "oklch(0.55 0.18 250)", background: "rgb(0,0,0)" }),
    ).toThrow();
  });

  it("defaults background to the light reference theme's own --background when omitted", () => {
    const withDefault = deriveTheme({ primary: "oklch(0.55 0.18 250)" });
    const withExplicit = deriveTheme({
      primary: "oklch(0.55 0.18 250)",
      background: LIGHT_BACKGROUND,
    });
    expect(withDefault).toEqual(withExplicit);
  });

  it("proof-check: the true-black/true-white ink pair clears >=4.5:1 against ANY fill lightness", () => {
    // Underpins deriveTheme's AA-safety guarantee: for any background
    // luminance, the worse of {black, white} ink still clears the AA text
    // floor (worst case ~4.58:1, at Lbg ~= 0.564 in this sampling). This is
    // WHY deriveTheme uses true black/white rather than the shipped
    // `--foreground` values (`oklch(0.145 0 0)`/`oklch(0.985 0 0)`), which
    // measure only ~4.35:1 in the same worst case — below the 4.5:1 floor.
    // Sampled densely across L in [0, 1] at a few chromas.
    const DARK_INK: Oklch = { l: 0, c: 0, h: 0, alpha: 1 };
    const LIGHT_INK: Oklch = { l: 1, c: 0, h: 0, alpha: 1 };
    for (const c of [0, 0.05, 0.1, 0.2]) {
      for (let i = 0; i <= 100; i++) {
        const fill: Oklch = { l: i / 100, c, h: 250, alpha: 1 };
        const best = Math.max(contrastRatio(DARK_INK, fill), contrastRatio(LIGHT_INK, fill));
        expect(best).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
