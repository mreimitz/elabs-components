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

import { TokenTheme } from "monaco-editor/esm/vs/editor/common/languages/supports/tokenization.js";
import { vs, vs_dark } from "monaco-editor/esm/vs/editor/standalone/common/themes.js";

import {
  buildBrandThemeData,
  contrast,
  flattenOver,
  IGNORED_BASE_SCOPES,
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
  "--ring-contour",
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

  it("gives Monaco's focusBorder a layer of the compound indicator that clears 1.4.11 (#67)", () => {
    // Monaco's `focusBorder` is a SINGLE colour key, so it cannot carry the DOM's
    // two-layer `focus-ring` (ring + `--ring-contour` outline). It must therefore be
    // whichever layer actually clears the non-text 3:1 bar against the editor ground.
    // Before the fix this was hard-wired to `--ring`, which on `light` IS `--primary`
    // and measures ~1.36:1 — a focus indicator nobody can see.
    const focusBorder = colors.focusBorder!;
    expect(contrast(focusBorder, background)).toBeGreaterThanOrEqual(3);
  });

  it("still clamps the calc-result inlay color against the composited ground", () => {
    const tokenGround = flattenOver(lineHighlight, background);
    const calcResult = colors["editorInlayHint.foreground"]!;
    expect(contrast(calcResult, tokenGround)).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Locks #90: Monaco's `vs`/`vs-dark` base themes (inherited at
 * `buildBrandThemeData`'s `inherit: true`) ship LANGUAGE-SUFFIXED rules —
 * `string.key.json`, `string.value.json`, `keyword.json`, … — that the
 * bridge's shorter, unsuffixed rules (`string.key`, `string.value`,
 * `keyword`) can never beat: Monaco's token-theme trie resolves the DEEPEST
 * matching scope, and rules are sorted lexicographically before insertion, so
 * `string.key` is always inserted before `string.key.json` regardless of
 * which array it came from — the base's `.json` child then overwrites the
 * clone it inherited from our shorter rule.
 *
 * This asserts against Monaco's REAL resolution — `TokenTheme` built from
 * `base.rules.concat(data.rules)`, exactly mirroring
 * `standaloneThemeService.js`'s `tokenTheme` getter — rather than against the
 * bridge's returned `rules` array, since the array has ALWAYS looked correct
 * (the `// JSON keys` comment on `key`/`string.key` records exactly that
 * mistaken belief). Before the fix this fails on `string.key.json`,
 * `string.value.json` and `keyword.json` in BOTH bases (`number.json` and
 * `delimiter.bracket.json` were already branded — `vs`/`vs-dark` don't
 * specialise those two scopes, so they fall through to the bridge's
 * unsuffixed `number`/`delimiter` rules even pre-fix); after the fix every
 * scope below resolves to a brand colour in both bases.
 */
describe.each<[ThemeSlug, typeof vs]>([
  ["light", vs],
  ["dark", vs_dark],
])("Monaco real trie resolution (%s base) — #90", (theme, base) => {
  const data = buildThemeDataFor(theme);
  // Mirror `standaloneThemeService.js`: `rules = baseData.rules.concat(this.themeData.rules)`.
  const merged = [...base.rules, ...(data.rules ?? [])];
  const tokenTheme = TokenTheme.createFromRawTokenTheme(merged, []);
  const colorMap = tokenTheme.getColorMap();

  const toHexByte = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  const resolvedForegroundHex = (scope: string): string | undefined => {
    const rule = tokenTheme._match(scope);
    const color = colorMap[rule._foreground];
    if (!color) return undefined;
    return `${toHexByte(color.rgba.r)}${toHexByte(color.rgba.g)}${toHexByte(color.rgba.b)}`;
  };

  // Every foreground the bridge itself declares (uppercased 6-hex, no `#`) —
  // a scope resolving to one of these IS branded, whatever its numeric colour id.
  const brandForegrounds = new Set(
    (data.rules ?? [])
      .map((rule) => rule.foreground)
      .filter((fg): fg is string => typeof fg === "string" && fg.length > 0)
      .map((fg) => fg.toUpperCase()),
  );

  it.each([
    "string.key.json",
    "string.value.json",
    "keyword.json",
    "number.json",
    "delimiter.bracket.json",
  ])(
    "scope %s resolves through the real trie to a brand colour, not a stock base colour",
    (scope) => {
      const hex = resolvedForegroundHex(scope);
      expect(hex).toBeDefined();
      expect(brandForegrounds.has(hex!)).toBe(true);
    },
  );

  // PR #119 review thread 2 (chatgpt-codex-connector): `CodeEditorProps.language`
  // is a plain, unrestricted `string` passed straight to
  // `monaco.editor.setModelLanguage` (`code-editor.tsx`) — it is NOT limited
  // to `EDITOR_LANGUAGES`, so a consumer passing `language="pug"` (or
  // `"handlebars"`) really does reach these scopes. `IGNORED_BASE_SCOPES`'s
  // old "nothing in this package can ever render them" premise was false for
  // these three; only `metatag.php` (no `foreground` in the base themes —
  // nothing to un-brand) is legitimately left out.
  it.each(["tag.id.pug", "tag.class.pug", "variable.parameter"])(
    "scope %s (reachable via an unrestricted CodeEditor `language` prop) resolves to a brand colour",
    (scope) => {
      const hex = resolvedForegroundHex(scope);
      expect(hex).toBeDefined();
      expect(brandForegrounds.has(hex!)).toBe(true);
    },
  );
});

/**
 * Drift guard (#90): every DOTTED scope Monaco's `vs`/`vs-dark` base themes
 * specialise must be either (a) re-declared by the bridge's own `rules`, or
 * (b) named in `IGNORED_BASE_SCOPES` with a reason it can never reach this
 * package's editors. This is what survives a `monaco-editor` UPGRADE: today's
 * fix hand-lists the scopes evidenced against 0.55.1 — if a future version
 * specialises a new one (or changes what `EDITOR_LANGUAGES` can reach), this
 * test reds instead of silently shipping another un-branded scope.
 */
describe("drift guard against monaco-editor's base themes — #90", () => {
  const light = buildThemeDataFor("light");
  const dark = buildThemeDataFor("dark");
  const bridgeTokens = new Set(
    [...(light.rules ?? []), ...(dark.rules ?? [])].map((rule) => rule.token),
  );

  const dottedBaseTokens = new Set(
    [...vs.rules, ...vs_dark.rules]
      .map((rule) => rule.token)
      .filter((token) => token.includes(".")),
  );

  it("has at least one dotted scope to guard (sanity — a stale extraction would vacuously pass)", () => {
    expect(dottedBaseTokens.size).toBeGreaterThan(0);
  });

  it.each([...dottedBaseTokens].sort())(
    "base scope %s is either overridden by the bridge or explicitly ignored",
    (token) => {
      const covered = bridgeTokens.has(token) || IGNORED_BASE_SCOPES.has(token);
      expect(covered).toBe(true);
    },
  );
});
