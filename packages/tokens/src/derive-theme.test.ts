/**
 * Locking test for `deriveTheme` (issue #39).
 *
 * Computes REAL WCAG contrast ratios and OKLab ΔE from the function's actual
 * output — nothing here is a docstring claim. Covers a spread of ordinary
 * seeds plus four named HOSTILE cases (very light primary, very dark primary,
 * low-chroma primary, primary close to background) that are the ones most
 * likely to break a naive derivation.
 *
 * Fix round 1 (an independent validator's review of the first commit, de9307a)
 * found three correctness holes this file's original 10 hand-picked seeds
 * didn't cover — a rounding-boundary `--ring` (finding 1), an alpha-carrying
 * seed (finding 2), and a `--ring`/`--accent-foreground` collapse for
 * zero-chroma seeds (finding 3). Each got its OWN reproduction case below
 * (not just a fix to the implementation) so the exact regression can't come
 * back silently, PLUS a wide property sweep (`describe("property sweep")`)
 * over many more seeds than any hand-picked list would think to try — the
 * validator's own stated lesson: hand-picked cases miss whatever seed shape
 * nobody thought to name.
 *
 * Fix round 2 (the same validator, re-reviewing round 1's fix) found one more
 * correctness hole in NEW code this branch shipped — `--accent` could land
 * byte-identical to `background` (finding C) — plus a ΔE implementation that
 * disagreed with the gate it claims to mirror by exactly one ulp at the floor
 * (finding D was a docstring-only correction, no test needed; finding E is
 * fixed by aligning this file's own `oklabDistance` to `Math.hypot`, see
 * below). Finding C got the same treatment as round 1: a named reproduction
 * case, a per-case assertion, and the invariant added to the property sweep.
 */
import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch, type Oklch } from "./color-contrast";
import { deriveTheme, type DeriveThemeOptions } from "./derive-theme";
import { THEME_TOKEN_NAMES, type ThemeTokenName } from "./theme-token-names.generated";

const AA_TEXT = 4.5;
const AA_NONTEXT = 3;
const ROLE_SEPARATION_DELTA_E = 0.05;

/**
 * OKLab ΔE — matches themes-contrast.test.ts's own helper, INCLUDING its
 * `Math.hypot` call (fix round 2, issue #39, finding E: a plain
 * `Math.sqrt(dL**2+da**2+db**2)` disagrees with `Math.hypot` by exactly one
 * ulp at the 0.05 floor, and this file's property sweep deliberately
 * exercises seeds that land near that floor).
 */
function oklabDistance(a: Oklch, b: Oklch): number {
  const toLab = (o: Oklch) => {
    const hr = (o.h * Math.PI) / 180;
    return { L: o.l, a: o.c * Math.cos(hr), b: o.c * Math.sin(hr) };
  };
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
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
  // --- Fix round 1 (#39) regression cases — the validator's exact reproductions ---
  {
    // Finding 1: pre-fix, findAALightness validated the UNROUNDED candidate
    // (3.0000:1) then formatOklch rounded L/C to 3 decimals without
    // re-measuring, shipping a --ring that actually measured 2.9936:1 — below
    // the 3:1 floor. This exact seed is the validator's reproduction.
    name: "FIX ROUND 1 finding 1: rounding must not push --ring below 3:1",
    options: { primary: "oklch(0.1 0.03 340)", background: DARK_BACKGROUND },
  },
  {
    // Finding 3: pre-fix, a zero-chroma primary derived a --ring identical to
    // --accent-foreground (both oklch(0 0 0), ΔE 0.0000) — a direct collision
    // with the MUST_DIFFER pair ["--accent-foreground", "--ring"] enforced on
    // committed theme CSS by scripts/check-role-distinctness.mjs. A
    // runtime-derived patch can't be seen by that gate, so the invariant has
    // to be enforced here instead (see the "ring/accent-fg ΔE" case below).
    name: "FIX ROUND 1 finding 3: zero-chroma primary must not collapse --ring onto --accent-foreground",
    options: { primary: "oklch(0 0 0)" },
  },
  // --- Fix round 2 (#39) regression case — the validator's finding C reproduction ---
  {
    // Finding C: pre-fix, deriveAccent's escape from colliding with --primary
    // could land --accent exactly ON `background` (an invisible hover state).
    // This seed is the validator's own reproduction: the primary/background
    // lightness gap (0.14) happens to equal MIN_ACCENT_DELTA_L exactly, so the
    // "push primary.l by +MIN_ACCENT_DELTA_L" escape lands precisely on
    // background.l.
    name: "FIX ROUND 2 finding C: --accent must not collapse onto background",
    options: { primary: "oklch(0.42 0 0)", background: "oklch(0.56 0 0)" },
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

    it("--ring and --accent-foreground stay perceptibly distinct (ΔE >= 0.05 OKLab)", () => {
      // FIX ROUND 1 finding 3: scripts/check-role-distinctness.mjs's MUST_DIFFER
      // includes ["--accent-foreground", "--ring"] for committed theme CSS. That
      // gate cannot see a runtime-derived patch, so deriveTheme must enforce the
      // same pair on its OWN emitted output — this is the exact assertion the
      // original 10-case suite was missing, which is why the zero-chroma
      // collision (both oklch(0 0 0)) shipped without any test failing.
      const ring = parseOklch(result["--ring"]!);
      const accentForeground = parseOklch(result["--accent-foreground"]!);
      expect(oklabDistance(ring, accentForeground)).toBeGreaterThanOrEqual(ROLE_SEPARATION_DELTA_E);
    });

    it("--accent stays perceptibly distinct from the resolved background (ΔE >= 0.05 OKLab)", () => {
      // FIX ROUND 2 finding C: --accent is a hover/active surface FOR
      // `background` — nothing previously stopped it from landing byte-identical
      // to that surface (an invisible hover state). This is the exact assertion
      // the round-1 suite was missing, which is why the collision shipped
      // undetected.
      const accent = parseOklch(result["--accent"]!);
      expect(oklabDistance(accent, background)).toBeGreaterThanOrEqual(ROLE_SEPARATION_DELTA_E);
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

  it("FIX ROUND 1 finding 2: throws on an alpha-carrying primary instead of silently treating it as opaque", () => {
    // Pre-fix, an alpha-carrying `primary` was accepted and returned verbatim
    // (JSDoc even claimed `oklch(L C H / A)` support), but every contrast
    // check measured the OPAQUE value — deriveTheme believed 17.97:1 while
    // the real value, composited over the default background with the
    // repo's own mixOverSrgb, measured 1.16:1. Chose "reject" over
    // "composite" (the validator offered both): every token in themes.css is
    // stored fully opaque by convention, and --primary can legitimately
    // render over surfaces OTHER than the caller-supplied background (a
    // card, a popover), so compositing against just one ground would still
    // misrepresent the others.
    expect(() => deriveTheme({ primary: "oklch(0.2 0.1 250 / 0.05)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(0.55 0.18 250 / 0.999)" })).toThrow();
  });

  it("FIX ROUND 1 finding 2: throws on an alpha-carrying background for the same reason", () => {
    expect(() =>
      deriveTheme({ primary: "oklch(0.55 0.18 250)", background: "oklch(0.5 0.1 250 / 0.5)" }),
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

  it("throws on negative chroma in primary (Issue #100)", () => {
    expect(() => deriveTheme({ primary: "oklch(0.05 -2 0)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(0.5 -0.1 200)" })).toThrow();
  });

  it("throws on negative chroma in background (Issue #100)", () => {
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(0.5 -0.1 200)",
      }),
    ).toThrow();
  });

  it("throws on L outside [0, 1] in primary (Issue #100)", () => {
    expect(() => deriveTheme({ primary: "oklch(1.6 0.1 250)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(-0.4 0.1 250)" })).toThrow();
  });

  it("throws on L outside [0, 1] in background (Issue #100)", () => {
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(1.6 0.1 250)",
      }),
    ).toThrow();
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(-0.4 0.1 250)",
      }),
    ).toThrow();
  });

  it("throws on non-finite L in primary (Issue #100)", () => {
    expect(() => deriveTheme({ primary: "oklch(Infinity 0.05 30)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(-Infinity 0.05 30)" })).toThrow();
  });

  it("throws on non-finite L in background (Issue #100)", () => {
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(Infinity 0.05 30)",
      }),
    ).toThrow();
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(-Infinity 0.05 30)",
      }),
    ).toThrow();
  });

  it("throws on non-finite C in primary (Issue #100)", () => {
    expect(() => deriveTheme({ primary: "oklch(0.5 Infinity 30)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(0.5 -Infinity 30)" })).toThrow();
  });

  it("throws on non-finite C in background (Issue #100)", () => {
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(0.5 Infinity 30)",
      }),
    ).toThrow();
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(0.5 -Infinity 30)",
      }),
    ).toThrow();
  });

  it("throws on non-finite H in primary (Issue #100)", () => {
    expect(() => deriveTheme({ primary: "oklch(0.5 0.1 Infinity)" })).toThrow();
    expect(() => deriveTheme({ primary: "oklch(0.5 0.1 -Infinity)" })).toThrow();
  });

  it("throws on non-finite H in background (Issue #100)", () => {
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(0.5 0.1 Infinity)",
      }),
    ).toThrow();
    expect(() =>
      deriveTheme({
        primary: "oklch(0.55 0.18 250)",
        background: "oklch(0.5 0.1 -Infinity)",
      }),
    ).toThrow();
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

/**
 * Fix round 1's stated lesson: "Add a property-style sweep over many seeds
 * asserting every invariant on the formatted output — that is what would
 * have caught all three [findings]." A hand-picked CASES list only tests the
 * seed shapes someone thought to name; this sweep tests a broad L x C x H x
 * background grid so a future regression in ANY corner of the search space
 * fails here instead of shipping. Scaled down from the exploratory ~3024-seed
 * sweep used to verify the fix (same grid shape, fewer chroma/hue steps) to
 * keep the suite fast while still covering hundreds of seeds per run.
 */
describe("deriveTheme property sweep (fix rounds 1-2)", () => {
  const Ls = Array.from({ length: 11 }, (_, i) => i / 10); // 0, 0.1, ..., 1
  const Cs = [0, 0.02, 0.1, 0.3];
  const Hs = [0, 60, 120, 180, 240, 300];
  const BGs = [LIGHT_BACKGROUND, DARK_BACKGROUND];

  it(`holds every invariant on the formatted output across ${Ls.length * Cs.length * Hs.length * BGs.length} seeds`, () => {
    const violations: string[] = [];

    for (const bgStr of BGs) {
      const background = parseOklch(bgStr);
      for (const l of Ls) {
        for (const c of Cs) {
          for (const h of Hs) {
            const primaryStr = `oklch(${l} ${c} ${h})`;
            const seed = `primary=${primaryStr} background=${bgStr}`;
            let result: ReturnType<typeof deriveTheme>;
            try {
              result = deriveTheme({ primary: primaryStr, background: bgStr });
            } catch (e) {
              violations.push(`${seed}: threw unexpectedly — ${(e as Error).message}`);
              continue;
            }

            const primary = parseOklch(result["--primary"]!);
            const primaryForeground = parseOklch(result["--primary-foreground"]!);
            const accent = parseOklch(result["--accent"]!);
            const accentForeground = parseOklch(result["--accent-foreground"]!);
            const ring = parseOklch(result["--ring"]!);

            const primaryFgRatio = contrastRatio(primaryForeground, primary);
            if (primaryFgRatio < AA_TEXT) {
              violations.push(`${seed}: --primary-foreground ratio ${primaryFgRatio} < ${AA_TEXT}`);
            }

            const accentFgRatio = contrastRatio(accentForeground, accent);
            if (accentFgRatio < AA_TEXT) {
              violations.push(`${seed}: --accent-foreground ratio ${accentFgRatio} < ${AA_TEXT}`);
            }

            // FIX ROUND 1 finding 1: measure the ACTUAL emitted string, not an
            // internal pre-rounding value — this is what the validate-then-round
            // bug would have failed.
            const ringRatio = contrastRatio(ring, background);
            if (ringRatio < AA_NONTEXT) {
              violations.push(`${seed}: --ring ratio ${ringRatio} < ${AA_NONTEXT}`);
            }

            const rawHueGap = Math.abs(ring.h - primary.h);
            const hueGap = Math.min(rawHueGap, 360 - rawHueGap);
            if (hueGap > 20) {
              violations.push(`${seed}: --ring hue gap ${hueGap} > 20`);
            }

            const primaryAccentDeltaE = oklabDistance(primary, accent);
            if (primaryAccentDeltaE < ROLE_SEPARATION_DELTA_E) {
              violations.push(
                `${seed}: --primary/--accent deltaE ${primaryAccentDeltaE} < ${ROLE_SEPARATION_DELTA_E}`,
              );
            }

            // FIX ROUND 1 finding 3: the MUST_DIFFER pair, on formatted output.
            const ringAccentFgDeltaE = oklabDistance(ring, accentForeground);
            if (ringAccentFgDeltaE < ROLE_SEPARATION_DELTA_E) {
              violations.push(
                `${seed}: --ring/--accent-foreground deltaE ${ringAccentFgDeltaE} < ${ROLE_SEPARATION_DELTA_E}`,
              );
            }

            // FIX ROUND 2 finding C: --accent must not collapse onto the
            // resolved background (an invisible hover state) — the exact
            // invariant the round-1 grid was missing.
            const accentBackgroundDeltaE = oklabDistance(accent, background);
            if (accentBackgroundDeltaE < ROLE_SEPARATION_DELTA_E) {
              violations.push(
                `${seed}: --accent/background deltaE ${accentBackgroundDeltaE} < ${ROLE_SEPARATION_DELTA_E}`,
              );
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
