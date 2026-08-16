/**
 * check-tokens-fresh.test.mjs — locks the WP-04 #61 DTCG freshness gate.
 * Run in CI: `node --test scripts/check-tokens-fresh.test.mjs`.
 *
 * Two properties:
 *   (a) DETERMINISM — the pure assembler is idempotent: assembling twice yields
 *       the same string, and re-assembling its own output is a no-op.
 *   (b) PLANTED DRIFT — changing a DTCG value flows into the assembled themes.css
 *       (only that token's value line changes), so a stale committed file (one
 *       that doesn't match the DTCG source) is detectable by the gate.
 *
 * The assembler transform is pure (string in → string out), so the fixtures are
 * INLINE strings + inline value maps — hermetic, never the real themes.css.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleThemesCss } from "../packages/tokens/scripts/build-themes-css.mjs";

/** Minimal four-block themes.css whose in-scope tokens we can rewrite by name. */
function fixtureCss(primary = "oklch(0.5 0.1 264)") {
  const body = (p) =>
    `  --background: oklch(1 0 0);\n  --foreground: oklch(0 0 0);\n  --primary: ${p};\n  --ring: var(--primary);`;
  return [
    `:root {\n${body(primary)}\n}`,
    `[data-theme="light"] {\n${body(primary)}\n}`,
    `[data-theme="dark"] {\n${body(primary)}\n}`,
    `[data-theme="blueprint"] {\n${body(primary)}\n}`,
  ].join("\n\n");
}

/**
 * The four blocks `fixtureCss` emits, in order. `root` is the `:root` base — NOT
 * a selectable theme, and deliberately not keyed `light`, which is a real shipped
 * theme slug (a colliding key silently collapses this list to three entries).
 * Canonical declaration: `ROOT_MODE` in
 * `packages/tokens/scripts/lib/themes-io.mjs`.
 */
const MODES = ["root", "light", "dark", "blueprint"];

/** Build a mode→(token→value) map from a flat per-mode value object. */
function maps(perMode) {
  const m = new Map();
  for (const mode of MODES) m.set(mode, new Map(Object.entries(perMode)));
  return m;
}

// ── (a) Determinism / idempotence ────────────────────────────────────────────

test("DETERMINISM: assembling twice is identical", () => {
  const css = fixtureCss();
  const valueMaps = maps({
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0 0 0)",
    "--primary": "oklch(0.5 0.1 264)",
    "--ring": "var(--primary)",
  });
  const once = assembleThemesCss(css, valueMaps);
  const twice = assembleThemesCss(css, valueMaps);
  assert.equal(once, twice, "assembler must be deterministic");
});

test("DETERMINISM: re-assembling the output is a no-op (seeded values round-trip)", () => {
  const css = fixtureCss();
  const valueMaps = maps({
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0 0 0)",
    "--primary": "oklch(0.5 0.1 264)",
    "--ring": "var(--primary)",
  });
  const out = assembleThemesCss(css, valueMaps);
  assert.equal(out, css, "values matching the source → byte-identical no-op");
  assert.equal(assembleThemesCss(out, valueMaps), out, "fixed point");
});

// ── (b) Planted drift ────────────────────────────────────────────────────────

test("PLANTED DRIFT: a changed DTCG value rewrites exactly that token's line", () => {
  const css = fixtureCss(); // committed file has --primary: oklch(0.5 0.1 264)
  // The DTCG source now says a DIFFERENT --primary for light only.
  const valueMaps = maps({
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0 0 0)",
    "--primary": "oklch(0.5 0.1 264)",
    "--ring": "var(--primary)",
  });
  valueMaps.get("light").set("--primary", "oklch(0.9 0.2 30)");

  const out = assembleThemesCss(css, valueMaps);

  // The committed css differs from the (DTCG-derived) assembled output → STALE.
  assert.notEqual(out, css, "a drifted DTCG value must make themes.css stale");

  // Exactly one line changed, and it's the light --primary.
  const before = css.split("\n");
  const after = out.split("\n");
  const changed = before.map((l, i) => (l !== after[i] ? i : -1)).filter((i) => i >= 0);
  assert.equal(changed.length, 1, "only one declaration should change");
  assert.match(after[changed[0]], /--primary: oklch\(0\.9 0\.2 30\);/);

  // And the value really did flow through (the new value is present, old gone in
  // that block) — i.e. the gate's expected≠current condition fires.
  assert.ok(out.includes("oklch(0.9 0.2 30)"), "new value present");
});

test("PLANTED DRIFT: rewrite stays inside the target block (no cross-block bleed)", () => {
  const css = fixtureCss();
  const valueMaps = maps({
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0 0 0)",
    "--primary": "oklch(0.5 0.1 264)",
    "--ring": "var(--primary)",
  });
  // Change --primary ONLY for dark; every other block keeps the seeded value.
  valueMaps.get("dark").set("--primary", "oklch(0.7 0.16 264)");

  const out = assembleThemesCss(css, valueMaps);
  // Count occurrences of the new value — must be exactly one (dark only).
  const hits = out.split("oklch(0.7 0.16 264)").length - 1;
  assert.equal(hits, 1, "only the dark block's --primary changes");
});
