/**
 * fonts.test.ts — Inter ships as WOFF2, with full subset coverage (issue #16).
 *
 * The regression this locks: `themes.css` used to declare Inter as a single
 * `.woff` file per style (normal/italic), with an in-file comment admitting the
 * gap ("shipped as .woff … the sandbox couldn't run the woff2/brotli step").
 * `.woff` is ~30% larger than `.woff2` for identical content, for browsers that
 * have all supported `.woff2` for years (see docs/CONSUMING.md's browser floor).
 *
 * The fix is not a same-shape swap, though: the original `.woff` was a single
 * unsubsetted file covering Latin, Latin Extended, Cyrillic, Cyrillic Extended,
 * Greek and Vietnamese (verified via a `fontTools` cmap dump before this change
 * landed). @fontsource-variable/inter — the vendoring source — splits each style
 * into seven per-script `unicode-range` subsets instead of one file, so Inter is
 * now declared as 14 `@font-face` blocks (7 subsets × {normal, italic}), each
 * scoped by `unicode-range`, so browsers still get exactly the same script
 * coverage the old single file did — just only fetching the subset(s) the
 * rendered text actually needs.
 *
 * This test asserts the SHAPE of that fix so a future edit can't silently
 * regress it: every Inter block is WOFF2 (never plain WOFF), carries a
 * `unicode-range`, and the full set of seven scripts is present for BOTH
 * styles — the exact failure mode of shipping only the "latin" file, which
 * would silently drop Cyrillic/Greek/Vietnamese/Latin-Extended text to a
 * system-font fallback.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINE_CSS_PATH } from "./_theme-css-source";

const FONTS_DIR = join(dirname(ENGINE_CSS_PATH), "fonts");

/** The seven per-script unicode-range subsets @fontsource-variable/inter ships. */
const EXPECTED_SUBSETS = [
  "latin",
  "latin-ext",
  "cyrillic",
  "cyrillic-ext",
  "greek",
  "greek-ext",
  "vietnamese",
] as const;

interface FontFaceBlock {
  family: string;
  style: string;
  url: string;
  format: string;
  unicodeRange: string | null;
}

/** Every `@font-face { … }` block in a stylesheet, parsed into its key fields. */
function parseFontFaces(css: string): FontFaceBlock[] {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? "");
  return blocks.map((body) => {
    const family = /font-family:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const style = /font-style:\s*(\w+)/.exec(body)?.[1] ?? "";
    const url = /url\("([^"]+)"\)/.exec(body)?.[1] ?? "";
    const format = /format\("([^"]+)"\)/.exec(body)?.[1] ?? "";
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? null;
    return { family, style, url, format, unicodeRange };
  });
}

describe("Inter ships as WOFF2 with full-script coverage (#16)", () => {
  const css = readFileSync(ENGINE_CSS_PATH, "utf8");
  const interFaces = parseFontFaces(css).filter((f) => f.family === "Inter");

  it("declares one @font-face per subset per style — 14 total", () => {
    expect(interFaces).toHaveLength(EXPECTED_SUBSETS.length * 2);
  });

  it("never declares a plain (non-woff2) format for Inter", () => {
    for (const face of interFaces) {
      expect(face.format, `${face.url} format`).toBe("woff2-variations");
      expect(face.url.endsWith(".woff2"), face.url).toBe(true);
      // The exact regression: a same-shape swap that quietly left the .woff
      // extension in the url() while only fixing the format() string.
      expect(face.url.endsWith(".woff")).toBe(false);
    }
  });

  it("every Inter @font-face carries a unicode-range", () => {
    for (const face of interFaces) {
      expect(face.unicodeRange, face.url).not.toBeNull();
      expect(face.unicodeRange).not.toBe("");
    }
  });

  it.each(["normal", "italic"] as const)(
    "covers all seven script subsets for font-style %s",
    (style) => {
      const urls = interFaces.filter((f) => f.style === style).map((f) => f.url);
      for (const subset of EXPECTED_SUBSETS) {
        const matched = urls.some((u) => u.includes(`-${subset}.woff2`));
        expect(matched, `expected a "${subset}" subset among: ${urls.join(", ")}`).toBe(true);
      }
    },
  );

  it("every referenced Inter font file resolves on disk", () => {
    for (const face of interFaces) {
      // url()s are relative to themes.css itself, e.g. "./fonts/inter/Inter-Variable-latin.woff2".
      const resolved = join(dirname(ENGINE_CSS_PATH), face.url);
      expect(existsSync(resolved), resolved).toBe(true);
    }
  });

  it("no stale .woff/no-woff2 comment remains", () => {
    // Split on the Source Code Pro section's own comment heading, not a bare
    // "Source Code Pro" substring — the Inter comment block itself now
    // mentions Source Code Pro by name (the no-fallback precedent), so a bare
    // match would cut the Inter section short before that sentence.
    const interSection = css.slice(0, css.indexOf("/* Source Code Pro —"));
    expect(interSection).not.toMatch(/sandbox couldn't run the woff2/i);
    // Negative lookahead for the trailing "2": the CURRENT comment legitimately
    // says "Shipped as .woff2 …", which is a substring match for a naive
    // `/shipped as \.woff/` — only the STALE "shipped as .woff (the sandbox…"
    // phrasing (bare .woff, no "2") is the regression this guards against.
    expect(interSection).not.toMatch(/shipped as \.woff(?!2)\b/i);
  });

  it("no leftover .woff (non-woff2) Inter binaries are vendored", () => {
    // Guards against a stale file surviving a partial migration — everything
    // under fonts/inter/ should be .woff2 (plus the OFL licence text).
    const interDir = join(FONTS_DIR, "inter");
    const entries = readdirSync(interDir);
    for (const entry of entries) {
      if (entry === "OFL.txt") continue;
      expect(entry.endsWith(".woff2"), entry).toBe(true);
    }
  });
});
