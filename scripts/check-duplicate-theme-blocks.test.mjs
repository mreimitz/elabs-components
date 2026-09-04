/**
 * check-duplicate-theme-blocks.test.mjs — locks the #196 single-color-block gate.
 * Run in CI: `node --test scripts/check-duplicate-theme-blocks.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never the real themes.css).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateThemeBlocks } from "./check-duplicate-theme-blocks.mjs";

const color = (sel) =>
  `${sel} {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.2 0 0);\n}`;

/** A minimal, valid one-color-block-per-selector themes.css. */
function cleanCss() {
  return [
    color(":root"),
    color('[data-theme="light"]'),
    color('[data-theme="dark"]'),
    color('[data-theme="drafting"]'),
  ].join("\n\n");
}

const violations = (css) => findDuplicateThemeBlocks(css);

// ── A: a planted second light COLOR block → must FAIL, naming both lines ─

test("FAILS: a second light color block (the #196 bug)", () => {
  const css =
    cleanCss() +
    "\n\n" +
    `[data-theme="light"] {\n  --background: oklch(1 0 0);\n  --accent: oklch(0.95 0.03 150);\n}`;
  const v = violations(css);
  assert.equal(v.length, 1, "expected exactly one duplicated selector");
  assert.equal(v[0].selector, '[data-theme="light"]');
  assert.equal(v[0].colorBlockLines.length, 2, "should report both color-block line numbers");
  // Both line numbers must be real (1-based) and distinct.
  assert.ok(v[0].colorBlockLines.every((n) => Number.isInteger(n) && n > 0));
  assert.notEqual(v[0].colorBlockLines[0], v[0].colorBlockLines[1]);
});

// ── B: one block per selector → must PASS ────────────────────────────────────

test("PASSES: exactly one color block per selector", () => {
  assert.equal(violations(cleanCss()).length, 0);
});

// ── C: the grouped color-scheme selector is NOT a duplicate rule block ────────

test("PASSES: grouped color-scheme selector (comma/`*`) is not counted", () => {
  const grouped =
    `[data-theme="dark"], [data-theme="dark"] *,\n` +
    `[data-theme="drafting"], [data-theme="drafting"] * {\n  color-scheme: dark;\n}`;
  const css = grouped + "\n\n" + cleanCss();
  assert.equal(violations(css).length, 0, "the grouped selector must not count as a second block");
});

// ── D: machinery-only secondary blocks are allowed (drafting font / easing) ──

test("PASSES: drafting's font-mechanism block (no color token) is allowed", () => {
  const css =
    cleanCss() +
    "\n\n" +
    `[data-theme="drafting"] {\n  --font-sans: "IBM Plex Mono", monospace;\n  --font-mono: "IBM Plex Mono", monospace;\n  font-family: var(--font-mono);\n}`;
  assert.equal(
    violations(css).length,
    0,
    "a machinery-only 2nd drafting block declares no color token",
  );
});

test("PASSES: a second :root with only an easing ramp (no color token) is allowed", () => {
  const css = cleanCss() + "\n\n" + `:root {\n  --expo-out: linear(0 0%, 0.5 50%, 1 100%);\n}`;
  assert.equal(violations(css).length, 0, "the easing :root declares no color token");
});

// ── E: a duplicate that aliases via var(--…) is still caught ──────────────────

test("FAILS: a second color block that aliases tokens via var(--…)", () => {
  const css = cleanCss() + "\n\n" + `[data-theme="dark"] {\n  --background: var(--surface);\n}`;
  const v = violations(css);
  assert.equal(v.length, 1);
  assert.equal(v[0].selector, '[data-theme="dark"]');
});

// ── F: an alias to a NON-color token is machinery, not a color block ──────────
// The RM-019 regression: the type-scale base `:root` aliases the meta rung
// (`--type-size-chart-value: var(--type-size-meta)`), which is a `rem`, not a
// color. Under the old shape-only predicate this read as a second color block
// and failed a blocking gate for a file that declares no color at all.

test("PASSES: a second :root aliasing only NON-color tokens (the type-scale base)", () => {
  const css =
    cleanCss() +
    "\n\n" +
    `:root {\n` +
    `  --type-size-meta: 0.75rem;\n` +
    `  --type-leading-meta: 1rem;\n` +
    `  --type-size-chart-value: var(--type-size-meta);\n` +
    `  --type-leading-chart-value: var(--type-leading-meta);\n` +
    `  --type-weight-chart-value: 800;\n` +
    `}`;
  assert.equal(
    violations(css).length,
    0,
    "an alias whose target is a rem is not a color declaration",
  );
});

// ── G: the #196 shape still fails THROUGH an alias chain ─────────────────────
// Narrowing the predicate must not weaken it: the regression that produced this
// gate was a stale block full of color aliases, and one hop of indirection must
// not launder it.

test("FAILS: a second color block aliasing a color through a chain", () => {
  const css =
    cleanCss() +
    "\n\n" +
    `[data-theme="light"] {\n` +
    `  --brand-base: oklch(0.7 0.2 150);\n` +
    `  --brand: var(--brand-base);\n` +
    `  --sidebar-primary: var(--brand);\n` +
    `}`;
  const v = violations(css);
  assert.equal(v.length, 1, "a two-hop alias to an oklch() literal is still a color block");
  assert.equal(v[0].selector, '[data-theme="light"]');
});

// ── H: resolution is FAIL-CLOSED on a cycle ──────────────────────────────────
// An unresolvable alias must never be waved through as machinery.

test("FAILS: an alias cycle counts as color (fail-closed)", () => {
  const css = cleanCss() + "\n\n" + `[data-theme="dark"] {\n  --a: var(--b);\n  --b: var(--a);\n}`;
  assert.equal(violations(css).length, 1, "a cycle cannot prove the token is machinery");
});
