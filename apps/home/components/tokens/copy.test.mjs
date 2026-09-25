// Locks #592 (hero vs tokens-band theme-family count) and #593 (tokens-band copy defects).
// Reads copy.ts / hero.tsx / theme-swatches.tsx as text rather than importing them, same as
// components/hero/copy.test.mjs, so no TS loader is needed. Run: node --test apps/home/components/tokens/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const COPY = readFileSync(new URL("../../content/copy.ts", import.meta.url), "utf8");
const HERO_TSX = readFileSync(new URL("../hero/hero.tsx", import.meta.url), "utf8");
const THEME_SWATCHES_TSX = readFileSync(new URL("./theme-swatches.tsx", import.meta.url), "utf8");
// #588 — the two themes this page actually ships: the real "light" theme (NOT the `:root`
// fallback in themes.css, which is a different, unshippable block) and the site's own
// "qlik-dark" family.
const LIGHT_THEME_CSS = readFileSync(
  new URL("../../../../packages/tokens/src/themes/light.css", import.meta.url),
  "utf8",
);
const QLIK_DARK_THEME_CSS = readFileSync(
  new URL("../../../../themes/qlik/qlik-dark.css", import.meta.url),
  "utf8",
);

function block(name) {
  const start = COPY.indexOf(name);
  assert.notEqual(start, -1, `${name} not found in copy.ts`);
  const end = COPY.indexOf("\n} as const;", start);
  assert.notEqual(end, -1, `${name} block has no closing "} as const;"`);
  return COPY.slice(start, end);
}

// #588 — every `{ token: "--x", label: "…" }` entry in tokenBandCopy.tokens, in order.
function curatedTokens() {
  const tokenBand = block("export const tokenBandCopy");
  return [...tokenBand.matchAll(/token:\s*"--([a-z0-9-]+)"/g)].map((m) => m[1]);
}

// The `[data-theme="name"]` block body from a theme stylesheet.
function themeBlock(css, name) {
  const m = css.match(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.notEqual(m, null, `[data-theme="${name}"] block not found`);
  return m[1];
}

// A token's resolved value within a theme block, with single-level `var(--other)` alias
// resolution — the same shape as packages/tokens/src/themes-contrast.test.ts's tokenMap(),
// enough for every alias this test walks (`--surface-2: var(--surface)`, `--ring: var(--primary)`).
function resolvedValue(themeBody, token) {
  const m = themeBody.match(new RegExp(`--${token}:\\s*([^;]+);`));
  assert.notEqual(m, null, `--${token} is not declared in this theme block`);
  const raw = m[1].trim();
  const alias = raw.match(/^var\(--([a-z0-9-]+)\)$/);
  return alias ? resolvedValue(themeBody, alias[1]) : raw;
}

// #592 — the tokens-band heading must derive from the same generated count as the hero's trust
// strip (`counts.themeFamilies.value`), never a hand-typed number word like "Nine"/"Eight".
test("themeSwatchesCopy.heading takes the count as a parameter, not a literal", () => {
  const themeSwatches = block("export const themeSwatchesCopy");
  assert.match(themeSwatches, /heading:\s*\(n: number\) => `\$\{n\}[^`]*`/);
  for (const word of ["Nine", "Eight", "Seven", "Six", "Ten"]) {
    assert.doesNotMatch(
      themeSwatches,
      new RegExp(`heading:\\s*"${word}`),
      `heading is hard-coded to "${word}…" instead of deriving from a count`,
    );
  }
});

test("hero.tsx and theme-swatches.tsx read the same generated theme-family count", () => {
  assert.match(
    HERO_TSX,
    /counts\.themeFamilies\.value/,
    "hero.tsx must read counts.themeFamilies.value",
  );
  assert.match(
    THEME_SWATCHES_TSX,
    /themeSwatchesCopy\.heading\(counts\.themeFamilies\.value\)/,
    "theme-swatches.tsx must call themeSwatchesCopy.heading with the same counts.themeFamilies.value the hero uses",
  );
});

// #593 — four copy defects in the tokens band (themeSwatchesCopy) and the gates band
// (gatesBandCopy), all still live on the homepage / /agents route.
test("themeSwatchesCopy.createTheme.description carries no straight apostrophe", () => {
  const createTheme = block("export const themeSwatchesCopy").match(
    /createTheme:\s*\{[\s\S]*?\n {2}\},/,
  )[0];
  assert.doesNotMatch(createTheme, /'/, "createTheme block still has a straight apostrophe");
  assert.match(createTheme, /brand’s own material/, "expected the curly-apostrophe phrasing");
});

test("themeSwatchesCopy.createTheme.description names the real skill, not the maintainer-only shortcut", () => {
  const themeSwatches = block("export const themeSwatchesCopy");
  assert.match(
    themeSwatches,
    /brand-ui-create-theme skill/,
    "expected the real skill name brand-ui-create-theme",
  );
  assert.doesNotMatch(
    themeSwatches,
    /\bthe create-theme skill\b/,
    "still names the maintainer-only /create-theme shortcut as if it were the skill",
  );
});

test("gatesBandCopy footer is not redundant with the band's own inline gate list", () => {
  const gatesBand = block("export const gatesBandCopy");
  assert.doesNotMatch(
    gatesBand,
    /The full list lives in/,
    'footer still claims to be "the full list" although the band already renders every gate inline',
  );
});

// #588 — every curated chip must have a resolved value distinct from every other curated chip,
// in EVERY shipped theme: two tokens sharing a value are indistinguishable chips that outline the
// identical elements (locks the regression: `--primary`/`--chart-1`/`--ring` all aliased to the
// same value in light, `--background`/`--surface-2` did too).
test("tokenBandCopy.tokens never share a resolved value with each other, in either shipped theme", () => {
  const tokens = curatedTokens();
  assert.ok(tokens.length > 1, "expected more than one curated token to compare");
  for (const [themeName, css, selector] of [
    ["light", LIGHT_THEME_CSS, "light"],
    ["qlik-dark", QLIK_DARK_THEME_CSS, "qlik-dark"],
  ]) {
    const body = themeBlock(css, selector);
    const seen = new Map();
    for (const token of tokens) {
      const value = resolvedValue(body, token);
      const clash = seen.get(value);
      assert.equal(
        clash,
        undefined,
        `--${token} and --${clash} resolve to the same value in ${themeName} (${value})`,
      );
      seen.set(value, token);
    }
  }
});

// #588 — `--radius` shipped in this list despite being a length: a colour-paint probe can never
// match it, so it always marked 0 elements. Lock every curated token to an actual colour.
test("tokenBandCopy.tokens all resolve to a colour, in light — never a length or other non-colour", () => {
  const body = themeBlock(LIGHT_THEME_CSS, "light");
  for (const token of curatedTokens()) {
    const value = resolvedValue(body, token);
    assert.match(
      value,
      /^(oklch|oklab|lab|lch|rgb|rgba|hsl|hsla|color)\(/i,
      `--${token} resolves to "${value}", not a colour — it can never match TokenSpotlight's paint probe`,
    );
  }
});

// #588 — the intro used to promise "the ground behind it tints to match"; no section of `/` wires
// TokenSpotlight's onSpotlight to an AmbientField, so no curated chip ever produced that tint.
test("tokenBandCopy.intro does not promise a ground tint the page never wires up", () => {
  const tokenBand = block("export const tokenBandCopy");
  const intro = tokenBand.match(/intro:\s*"([^"]*)"/)[1];
  assert.doesNotMatch(
    intro,
    /tints?|ground behind it/i,
    "intro still promises a ground tint that TokenBand does not implement",
  );
});
