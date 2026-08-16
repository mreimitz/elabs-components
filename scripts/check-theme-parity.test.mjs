/**
 * check-theme-parity.test.mjs — locks the #89 theme-token-parity gate.
 * Run in CI: `node --test scripts/check-theme-parity.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never the real themes.css).
 * Each fixture is a minimal themes.css: `:root` + one `[data-theme="…"]` block
 * per ACTIVE theme — derived from the same source the gate reads, so a paused
 * or added theme can never leave the fixtures behind.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findParityViolations } from "./check-theme-parity.mjs";
import { ACTIVE_THEMES } from "./lib/paused-surfaces.mjs";

const isClean = (css) => findParityViolations(css).length === 0;
const hasViolation = (css) => findParityViolations(css).length > 0;

/**
 * Build a themes.css with `:root` + one block per ACTIVE theme. `extra`
 * (default "") is appended to :root only, so we can plant a root-only token.
 * `commonExtra` is appended to EVERY block.
 */
function buildCss({ extra = "", commonExtra = "" } = {}) {
  const base = `--background: oklch(1 0 0);\n  --foreground: oklch(0 0 0);\n  --primary: oklch(0.5 0 0);`;
  const block = (sel) => `${sel} {\n  ${base}${commonExtra}\n}`;
  return [
    `:root {\n  ${base}${commonExtra}${extra}\n}`,
    ...ACTIVE_THEMES.map((name) => block(`[data-theme="${name}"]`)),
  ].join("\n\n");
}

// ── Fixture A: a non-allowlisted token in :root only → must FAIL ─────────────

test("FAILS: --foo declared only in :root (not allowlisted)", () => {
  const css = buildCss({ extra: "\n  --foo: oklch(0.5 0 0);" });
  assert.ok(hasViolation(css), "expected a parity violation for --foo");
  // It is missing from every non-root block.
  const v = findParityViolations(css);
  assert.equal(v.length, ACTIVE_THEMES.length);
  assert.ok(v.every((x) => x.token === "--foo"));
  for (const name of ACTIVE_THEMES) {
    assert.ok(v.some((x) => x.selector === `[data-theme="${name}"]`));
  }
});

// ── Fixture B: a token present in all four blocks → must PASS ─────────────────

test("PASSES: --foo declared in every theme block", () => {
  const css = buildCss({ commonExtra: "\n  --foo: oklch(0.5 0 0);" });
  assert.ok(isClean(css), "expected no violations when --foo is in every block");
});

// ── Fixture C: allowlist-pattern drift guard — root-only machinery → PASS ────

test("PASSES: --bp-new declared only in :root (allowlisted, blueprint family)", () => {
  const css = buildCss({ extra: "\n  --bp-new: oklch(0.5 0 0);" });
  assert.ok(isClean(css), "--bp-* is root-only machinery — must not be flagged");
});

test("PASSES: --t-new declared only in :root (allowlisted, motion timing)", () => {
  const css = buildCss({ extra: "\n  --t-new: 200ms;" });
  assert.ok(isClean(css), "--t-* is root-only machinery — must not be flagged");
});

test("PASSES: --radius / --decoration / --duration-fast / --font-foo are root-only", () => {
  for (const decl of [
    "--radius: 0.5rem;",
    "--radius-base: 0.5rem;",
    "--decoration: 0;",
    "--decoration-factor: 1;",
    "--duration-fast: 120ms;",
    "--motion-factor: 1;",
    "--font-sans: Inter;",
  ]) {
    const css = buildCss({ extra: `\n  ${decl}` });
    assert.ok(isClean(css), `${decl} should be allowlisted as root-only`);
  }
});

// ── Anchor guards: lookalikes that must NOT be treated as root-only ──────────

test("FAILS: --text-foo (lookalike of t-) is a real token, root-only → flagged", () => {
  // `--text-*` must NOT match the `t-` allowlist alternative.
  const css = buildCss({ extra: "\n  --text-muted: oklch(0.5 0 0);" });
  assert.ok(hasViolation(css), "--text-* must not be swallowed by the t- allowlist");
});

test("FAILS: a missing theme block is loud", () => {
  // Drop the LAST active theme's block entirely (an inspected theme is absent).
  const kept = ACTIVE_THEMES.slice(0, -1);
  const css = [
    `:root {\n  --background: oklch(1 0 0);\n}`,
    ...kept.map((name) => `[data-theme="${name}"] {\n  --background: oklch(1 0 0);\n}`),
  ].join("\n\n");
  const v = findParityViolations(css);
  assert.ok(v.some((x) => x.token === "<block>"));
});
