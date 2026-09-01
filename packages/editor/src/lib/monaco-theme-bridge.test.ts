/**
 * monaco-theme-bridge.test.ts — locks #88: Monaco composites a translucent
 * `editor.lineHighlightBackground` UNDER every token's text on the cursor's
 * line, so the REAL, on-screen ground a syntax color renders against on that
 * line is `flattenOver(lineHighlight, background)`, not the bare
 * `--background`. `buildBrandThemeData()` used to AA-clamp every rule's
 * foreground against the bare background alone, so a rule could pass its own
 * nominal check and still fail WCAG AA once Monaco actually painted it.
 *
 * This derives REAL numbers from the shipped theme tokens (parsed straight out
 * of `packages/tokens/src/themes/{light,dark}.css`, the same technique
 * `packages/tokens/src/themes-contrast.test.ts` uses) rather than asserting on
 * a hand-picked ratio — before the fix this fails at `token: "string"` in the
 * `light` theme (measured ~4.16:1 against the composited ground, short of the
 * 4.5:1 AA bar); after the fix every rule clears its bar in both themes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildBrandThemeData,
  contrast,
  flattenOver,
  LINE_HIGHLIGHT_ALPHA,
  withAlpha,
} from "./monaco-theme-bridge";

type ThemeSlug = "light" | "dark";

/**
 * Resolve `packages/tokens/src/themes/<theme>.css` regardless of whether the
 * test runner's cwd is this package (`pnpm --filter … test`) or the repo root
 * (`pnpm test` via Turborepo) — same multi-candidate approach as
 * `packages/ai/src/dark-theme-variant.test.ts`.
 */
function themeCssPath(theme: ThemeSlug): string {
  const candidates = [
    resolve(process.cwd(), `../tokens/src/themes/${theme}.css`), // cwd = packages/editor
    resolve(process.cwd(), `packages/tokens/src/themes/${theme}.css`), // cwd = repo root
    resolve(process.cwd(), `../../packages/tokens/src/themes/${theme}.css`),
  ].find((candidate) => existsSync(candidate));
  if (!candidates) {
    throw new Error(`themes/${theme}.css not found from cwd ${process.cwd()}`);
  }
  return candidates;
}

/**
 * All `--token: oklch(...)` declarations in a `[data-theme="name"]` block,
 * with single-level `var(--other)` aliases resolved (`--chart-1`/`--ring` both
 * alias `--primary` in the shipped themes) — same technique as
 * `themes-contrast.test.ts`'s `tokenMap`.
 */
function tokenMap(theme: ThemeSlug): Record<string, string> {
  const css = readFileSync(themeCssPath(theme), "utf8");
  const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (block == null) {
    throw new Error(`[data-theme="${theme}"] block not found in ${theme}.css`);
  }
  const literals: Record<string, string> = {};
  const aliases: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*(oklch\([^;]+\)|var\(\s*--[\w-]+\s*\))\s*;/g)) {
    const name = m[1];
    const value = m[2]?.trim();
    if (name == null || value == null) continue;
    if (value.startsWith("var(")) {
      const target = value.match(/var\(\s*(--[\w-]+)\s*\)/)?.[1];
      if (target != null) aliases[name] = target;
    } else {
      literals[name] = value;
    }
  }
  const map: Record<string, string> = { ...literals };
  for (const [name, firstTarget] of Object.entries(aliases)) {
    let target: string | undefined = firstTarget;
    const seen = new Set<string>([name]);
    while (target != null && !seen.has(target)) {
      seen.add(target);
      const literal = literals[target];
      if (literal != null) {
        map[name] = literal;
        break;
      }
      target = aliases[target];
    }
  }
  return map;
}

// Every semantic token `buildBrandThemeData` reads (see monaco-theme-bridge.ts).
const TOKEN_NAMES = [
  "--background",
  "--foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--primary",
  "--ring",
  "--popover",
  "--popover-foreground",
  "--input",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--success",
  "--destructive",
  "--calc-result",
  "--warning",
] as const;

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

/** Build real Monaco theme data from the shipped `theme`'s actual tokens, on a
 * DETACHED element (never appended to `document`) so this is pure token → theme
 * math with no dependency on any particular DOM/render state. */
function buildThemeDataFor(theme: ThemeSlug) {
  const tokens = tokenMap(theme);
  const el = document.createElement("div");
  for (const name of TOKEN_NAMES) {
    const value = tokens[name];
    if (value != null) el.style.setProperty(name, value);
  }
  return buildBrandThemeData(el);
}

// `comment`/`delimiter` are intentionally softer (3.2:1, "muted but legible");
// every other rule with a foreground targets full AA (4.5:1).
const SOFT_RATIO_TOKENS = new Set(["comment", "delimiter"]);

describe.each<ThemeSlug>(["light", "dark"])("buildBrandThemeData (%s)", (theme) => {
  const data = buildThemeDataFor(theme);
  const colors = data.colors;
  const background = colors["editor.background"]!;
  const foreground = colors["editor.foreground"]!;
  const lineHighlight = colors["editor.lineHighlightBackground"]!;

  it("derives editor.lineHighlightBackground from the exported LINE_HIGHLIGHT_ALPHA expression (no drift)", () => {
    // If the overlay Monaco actually paints (`colors["editor.lineHighlightBackground"]`)
    // is ever computed from a DIFFERENT alpha/expression than the one used to
    // derive the ground syntax colors are clamped against, this catches it —
    // both must be `withAlpha(foreground, LINE_HIGHLIGHT_ALPHA)`.
    expect(lineHighlight).toBe(withAlpha(foreground, LINE_HIGHLIGHT_ALPHA));
  });

  it("AA-clamps every syntax rule's foreground against the COMPOSITED line-highlight ground, not the bare background (#88)", () => {
    // The real, on-screen ground for text painted on the cursor's line: Monaco
    // renders `editor.lineHighlightBackground` UNDER the token text there.
    const tokenGround = flattenOver(lineHighlight, background);

    const failures: string[] = [];
    for (const rule of data.rules ?? []) {
      if (!rule.foreground) continue;
      const minRatio = SOFT_RATIO_TOKENS.has(rule.token) ? 3.2 : 4.5;
      const ratio = contrast(`#${rule.foreground}`, tokenGround);
      if (ratio < minRatio) {
        failures.push(
          `token "${rule.token || "(base)"}" measures ${ratio.toFixed(2)}:1 against the ` +
            `composited line-highlight ground, needs >= ${minRatio}:1`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("still clamps the calc-result inlay color against the composited ground", () => {
    const tokenGround = flattenOver(lineHighlight, background);
    const calcResult = colors["editorInlayHint.foreground"]!;
    expect(contrast(calcResult, tokenGround)).toBeGreaterThanOrEqual(4.5);
  });
});
