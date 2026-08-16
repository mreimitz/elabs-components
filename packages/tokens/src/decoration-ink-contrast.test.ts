/**
 * decoration-ink-contrast.test.ts — the per-palette gate on the DECORATION inks (#29).
 *
 * The reprographic grid/hatch is drawn in ONE shared ink recipe: the active theme's
 * own `--foreground` at an alpha that rides the dial
 * (`oklch(from var(--foreground) l c h / calc(var(--decoration-factor) * α))`). That
 * makes the texture hue-independent — but it also means the SAME multiplier lands on
 * palettes with very different foreground/surface separation, so a palette whose
 * `--foreground` is a mid grey (light: `oklch(0.37 0 0)`) gets a much weaker
 * line than one with a near-white ink on charcoal (dark).
 *
 * #29 asked whether the shared multipliers still serve every SHIPPED palette (three
 * now, not the six the issue was filed against). This test makes that answer
 * deterministic instead of a memory: it composites each theme's ink over each surface
 * the ground grid is actually painted on, and asserts the resulting hairline lands in
 * the "legible but quiet" band — visible enough to read as ruled paper, faint enough
 * never to compete with content. Too faint fails; too hot fails.
 *
 * Observed 2026-08-01 (Chromium 1280×900, real render, not inferred): the shared
 * multipliers read correctly on both themes — `foundations-decoration--dial`
 * (`globals=decoration:4` and `:10`) and the real app screen
 * `patterns-scenarios-agentic-ai-workspace--default` (`globals=decoration:8`) under
 * `theme:light` and `theme:dark`. No per-palette fork
 * was needed. This test locks that reading so a future palette edit cannot silently
 * erase (or over-ink) the grid.
 */
import { describe, expect, it } from "vitest";

import { readThemeCss } from "./_theme-css-source";
import { oklchToSrgb, parseOklch, relativeLuminance } from "./color-contrast";
// The shipped, user-selectable themes — read from the source of truth, never re-listed.
import { BUILT_IN_THEMES } from "./theme-types";

// ADR 0029 — the reference themes live in their own stylesheets now, so read
// the SET. The helper throws if a theme's block is missing rather than let a
// block regex match less and pass vacuously.
const css = readThemeCss();

/**
 * The surfaces `decoration.css` paints the ground grid on. `--surface-muted` and
 * friends are same-tone variants of these; the three below are the extremes.
 */
const GROUND_SURFACES = ["--canvas", "--background", "--card"] as const;

/**
 * Legible-but-quiet bands, as WCAG contrast of the composited hairline against the
 * surface it is drawn on, at FULL decoration (dial = 10). Below the floor the grid
 * stops reading as ruled paper; above the ceiling it starts competing with content.
 * Deliberately wider than the current spread (minor 1.18–1.32, major 1.36–1.71) so
 * an intentional palette tweak has room, but tight enough to catch an erased or
 * shouting grid.
 */
const BANDS = {
  "--bp-grid-ink": { min: 1.12, max: 1.55 },
  "--bp-grid-ink-major": { min: 1.25, max: 2.0 },
  "--bp-hatch-ink": { min: 1.12, max: 1.55 },
  "--bp-hatch-strong-ink": { min: 1.2, max: 1.9 },
} as const;

type InkToken = keyof typeof BANDS;

function extractBlock(re: RegExp): string {
  const body = css.match(re)?.[1];
  if (body == null) throw new Error(`Block not found for ${re}`);
  return body;
}

/** First `[data-theme="name"] { … }` block (blueprint has a 2nd, non-color one). */
function themeBlock(name: string): string {
  return extractBlock(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
}

/** All `--token: oklch(...)` declarations in a block body. */
function tokenMap(body: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(oklch\([^;]+\))\s*;/g)) {
    const [, name, value] = m;
    if (name != null && value != null) map[name] = value.trim();
  }
  return map;
}

/**
 * The alpha MULTIPLIER an ink token applies to the dial, read out of its
 * `calc(var(--decoration-factor) * α)` alpha slot in `:root`. Reading it (rather than
 * hard-coding it here) is what makes a future retune flow through this gate.
 */
function inkMultiplier(token: InkToken): number {
  const re = new RegExp(
    `${token}:\\s*oklch\\(\\s*from var\\(--foreground\\) l c h /\\s*calc\\(\\s*var\\(--decoration-factor\\)\\s*\\*\\s*([\\d.]+)\\s*\\)`,
    "s",
  );
  const raw = css.match(re)?.[1];
  if (raw == null) {
    throw new Error(
      `${token} is not declared as \`oklch(from var(--foreground) l c h / calc(var(--decoration-factor) * α))\` — ` +
        "the dial-derived ink recipe changed; re-derive this gate before relaxing it.",
    );
  }
  return Number(raw);
}

/** Source-over composite of an ink over an opaque surface, in gamma-encoded sRGB. */
function composite(
  ink: [number, number, number],
  surface: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [
    alpha * ink[0] + (1 - alpha) * surface[0],
    alpha * ink[1] + (1 - alpha) * surface[1],
    alpha * ink[2] + (1 - alpha) * surface[2],
  ];
}

function ratio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Contrast of `token`'s hairline against `surface`, at dial level `level`. */
function inkContrast(theme: string, token: InkToken, surface: string, level: number): number {
  const tokens = tokenMap(themeBlock(theme));
  const foreground = tokens["--foreground"];
  const surfaceValue = tokens[surface];
  if (foreground == null) throw new Error(`${theme} does not define --foreground`);
  if (surfaceValue == null) throw new Error(`${theme} does not define ${surface}`);

  const surfaceRgb = oklchToSrgb(parseOklch(surfaceValue));
  const alpha = (level / 10) * inkMultiplier(token);
  const line = composite(oklchToSrgb(parseOklch(foreground)), surfaceRgb, alpha);
  return ratio(relativeLuminance(line), relativeLuminance(surfaceRgb));
}

describe("decoration ink (#29) — one recipe, every shipped palette", () => {
  const inks = Object.keys(BANDS) as InkToken[];

  it("derives every ink from --foreground so the texture stays hue-independent", () => {
    for (const token of inks) expect(inkMultiplier(token)).toBeGreaterThan(0);
  });

  describe.each(BUILT_IN_THEMES)("%s", (theme) => {
    it.each(inks)("%s reads legible-but-quiet on every ground surface at dial 10", (token) => {
      const band = BANDS[token];
      for (const surface of GROUND_SURFACES) {
        const c = inkContrast(theme, token, surface, 10);
        expect(
          c,
          `${theme} ${token} on ${surface} = ${c.toFixed(3)}:1 — outside the ` +
            `${band.min}–${band.max} legible-but-quiet band`,
        ).toBeGreaterThanOrEqual(band.min);
        expect(c).toBeLessThanOrEqual(band.max);
      }
    });

    it("is fully inert at dial 0 — zero ink leak into an undecorated screen", () => {
      for (const token of inks) {
        for (const surface of GROUND_SURFACES) {
          expect(inkContrast(theme, token, surface, 0)).toBe(1);
        }
      }
    });

    it("ramps monotonically with the dial (4 < 8 < 10)", () => {
      for (const surface of GROUND_SURFACES) {
        const [d4, d8, d10] = [4, 8, 10].map((level) =>
          inkContrast(theme, "--bp-grid-ink-major", surface, level),
        ) as [number, number, number];
        expect(d4).toBeLessThan(d8);
        expect(d8).toBeLessThan(d10);
      }
    });
  });

  it("keeps the major grid line stronger than the minor one (the 80px rhythm reads)", () => {
    for (const theme of BUILT_IN_THEMES) {
      expect(inkMultiplier("--bp-grid-ink-major")).toBeGreaterThan(inkMultiplier("--bp-grid-ink"));
      expect(inkContrast(theme, "--bp-grid-ink-major", "--card", 10)).toBeGreaterThan(
        inkContrast(theme, "--bp-grid-ink", "--card", 10),
      );
    }
  });
});
