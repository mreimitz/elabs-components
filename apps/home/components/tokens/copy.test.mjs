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

function block(name) {
  const start = COPY.indexOf(name);
  assert.notEqual(start, -1, `${name} not found in copy.ts`);
  const end = COPY.indexOf("\n} as const;", start);
  assert.notEqual(end, -1, `${name} block has no closing "} as const;"`);
  return COPY.slice(start, end);
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
