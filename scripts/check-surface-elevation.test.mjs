/**
 * check-surface-elevation.test.mjs — locks the chrome-vs-canvas elevation gate.
 * Run in CI: `node --test scripts/check-surface-elevation.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never the real themes.css).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findElevationViolations } from "./check-surface-elevation.mjs";

const isClean = (css) => findElevationViolations(css).length === 0;
const violations = (css) => findElevationViolations(css);

/** A one-theme themes.css with explicit sidebar/background/card lightness. */
function theme(sel, { sidebar, background, card }) {
  const body = [
    `  --background: oklch(${background} 0 0);`,
    `  --sidebar: oklch(${sidebar} 0 0);`,
    card != null ? `  --card: oklch(${card} 0 0);` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `${sel} {\n${body}\n}`;
}

// ── FAIL: nav == content (the flat-shell regression) ─────────────────────────
test("FAILS: --sidebar equal to --background (flat)", () => {
  const css = theme(`[data-theme="flat"]`, { sidebar: 0.985, background: 0.985, card: 1 });
  const v = violations(css);
  assert.ok(v.length > 0, "equal chrome/canvas must fail");
  assert.equal(v[0].rule, "chrome-below-canvas");
});

// ── FAIL: chrome brighter than canvas (wrong direction) ──────────────────────
test("FAILS: --sidebar brighter than --background", () => {
  const css = theme(`[data-theme="inverted"]`, { sidebar: 0.99, background: 0.97, card: 1 });
  assert.ok(violations(css).length > 0, "chrome above canvas must fail");
});

// ── FAIL: step present but below the perceptible threshold ────────────────────
test("FAILS: chrome→canvas step smaller than the minimum", () => {
  const css = theme(`[data-theme="tooclose"]`, { sidebar: 0.978, background: 0.984, card: 1 }); // Δ0.006
  assert.ok(violations(css).length > 0, "Δ0.006 is below the 0.02 minimum");
});

// ── FAIL: raised card sits below the canvas ──────────────────────────────────
test("FAILS: --card darker than --background", () => {
  const css = theme(`[data-theme="sunkcard"]`, { sidebar: 0.95, background: 0.985, card: 0.97 });
  assert.ok(
    violations(css).some((x) => x.rule === "raised-not-below-canvas"),
    "card below canvas must fail",
  );
});

// ── PASS: a healthy light stack (chrome < canvas < card) ─────────────────────
test("PASSES: chrome recessed below canvas, card raised (light)", () => {
  const css = theme(`[data-theme="qlik-bright"]`, { sidebar: 0.96, background: 0.985, card: 1 });
  assert.ok(isClean(css), "Δ0.025 with raised card must pass");
});

// ── PASS: a healthy dark stack (canvas still lighter than chrome) ─────────────
test("PASSES: dark theme — canvas lighter than chrome", () => {
  const css = theme(`[data-theme="qlik-dark"]`, { sidebar: 0.17, background: 0.2, card: 0.24 });
  assert.ok(isClean(css), "dark Δ0.03 must pass (canvas still more elevated than chrome)");
});

// ── Skips non-color blocks (no --sidebar/--background) ───────────────────────
test("PASSES: a block without sidebar/background is skipped, not crashed", () => {
  const css = `[data-theme="blueprint"] {\n  --decoration: 10;\n  --bp-hatch: red;\n}`;
  assert.ok(isClean(css), "non-color block must be skipped");
});

// ── The real shipped themes.css must pass (integration smoke) ─────────────────
test("PASSES: the committed themes.css satisfies the elevation invariant", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, "..", "packages", "tokens", "src", "themes.css"), "utf8");
  assert.ok(isClean(css), `shipped themes.css must pass: ${JSON.stringify(violations(css))}`);
});
