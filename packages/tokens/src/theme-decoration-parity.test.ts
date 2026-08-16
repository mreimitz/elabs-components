/**
 * theme-decoration-parity.test.ts — `BUILT_IN_THEME_META[…].decorationLevel` must equal the
 * `--decoration` the theme's own block sets in themes.css.
 *
 * Why this needs teeth: the CSS is what actually RENDERS the dial, but
 * `ThemeProvider` derives `effectiveDecoration` from its theme REGISTRY
 * (`decoration ?? registryEntry?.decorationLevel ?? 0`). While nothing read that
 * field the drift was invisible; the moment a UI reads it — the playground's
 * decoration slider (#31) — a stale value shows "Theme default (2)" and parks the
 * thumb at 2 on a screen rendering the full dial-10 reprographic texture. That is
 * exactly the drift this test locks out (a registry entry saying `2` while the
 * theme's own block sets `--decoration: 10`).
 *
 * Browser-free: parses themes.css directly, so it cannot be fooled by a mock.
 */
import { describe, expect, it } from "vitest";

import { readThemeCss } from "./_theme-css-source";
import { BUILT_IN_THEMES, BUILT_IN_THEME_META, type ThemeName } from "./theme-types";

// ADR 0029 — the reference themes live in their own stylesheets now, so read
// the SET. The helper throws if a theme's block is missing rather than let a
// block regex match less and pass vacuously.
const css = readThemeCss();

/**
 * The `--decoration` a theme's CSS blocks declare, or 0 when none does (the token
 * then falls back to the `:root` default). A theme may own more than one
 * `[data-theme="x"] { … }` block (a palette block plus a mechanism block), so
 * every block is scanned and the LAST declaration wins — as the cascade does.
 */
function cssDecorationLevel(theme: ThemeName, source: string = css): number {
  const blockRe = new RegExp(`\\[data-theme="${theme}"\\][^{]*\\{([\\s\\S]*?)\\n\\}`, "g");
  let level = 0;
  for (const block of source.matchAll(blockRe)) {
    const body = block[1] ?? "";
    // `--decoration:` only — never the derived `--decoration-factor`.
    for (const decl of body.matchAll(/--decoration\s*:\s*(\d+)\s*;/g)) {
      level = Number(decl[1]);
    }
  }
  return level;
}

describe("theme decoration parity (themes.css ⇄ BUILT_IN_THEME_META)", () => {
  it.each(BUILT_IN_THEMES)("%s declares the same dial in CSS and in the registry", (theme) => {
    expect(BUILT_IN_THEME_META[theme].decorationLevel ?? 0).toBe(cssDecorationLevel(theme));
  });

  it("reads a real non-zero value (the parser itself is not vacuous)", () => {
    // Guards against a regex that silently matches nothing and passes 0 === 0.
    // Both SHIPPED themes sit at dial 0, so the fixture is synthetic: it proves
    // the parser can see a non-zero dial and that the LAST block wins, which is
    // the property the parity assertions above depend on.
    const fixture = [
      '[data-theme="drafting"] {',
      "  --decoration: 4;",
      "}",
      '[data-theme="drafting"] {',
      "  --decoration: 9;",
      "}",
      '[data-theme="plain"] {',
      "  --background: white;",
      "}",
    ].join("\n");
    expect(cssDecorationLevel("drafting" as ThemeName, fixture)).toBe(9);
    expect(cssDecorationLevel("plain" as ThemeName, fixture)).toBe(0);
  });

  it("every declared level is a valid dial position", () => {
    for (const theme of BUILT_IN_THEMES) {
      const level = BUILT_IN_THEME_META[theme].decorationLevel ?? 0;
      expect(Number.isInteger(level)).toBe(true);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(10);
    }
  });
});
