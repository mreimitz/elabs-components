/**
 * check-decoration-css.test.mjs — locks the decoration-overlay CSS gate (#29, #257).
 * Run in CI: `node --test scripts/check-decoration-css.test.mjs`.
 *
 * Fixtures are INLINE strings (hermetic) apart from the final integration smoke,
 * which asserts the SHIPPED decoration.css/themes.css still satisfy the contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DECORATION_CSS,
  THEMES_CSS,
  findFadeViolations,
  findUngatedFixedAttachment,
  hasRelativeColorFallback,
  stripComments,
} from "./check-decoration-css.mjs";

const GATED = `@layer base {
  @media (hover: hover) and (pointer: fine) {
    body { background-attachment: fixed; }
  }
}`;

// ── 1. touch gating (#29 item 3) ─────────────────────────────────────────────
test("FAILS: background-attachment: fixed outside a pointer media query", () => {
  const css = `@layer base { body { background-image: var(--bp-grid); background-attachment: fixed; } }`;
  const v = findUngatedFixedAttachment(css);
  assert.equal(v.length, 1, "an unconditional fixed attachment must fail");
});

test("FAILS: gated only by (hover: hover), without (pointer: fine)", () => {
  const css = `@media (hover: hover) { body { background-attachment: fixed; } }`;
  assert.equal(findUngatedFixedAttachment(css).length, 1);
});

test("PASSES: fixed attachment inside @media (hover: hover) and (pointer: fine)", () => {
  assert.equal(findUngatedFixedAttachment(GATED).length, 0);
});

test("PASSES: a COMMENT mentioning the declaration is not the declaration", () => {
  const css = `/* do not re-add background-attachment: fixed here */\n${GATED}`;
  assert.equal(findUngatedFixedAttachment(css).length, 0);
});

test("stripComments preserves line numbers", () => {
  const css = "a{}\n/* one\n   two */\nb{}";
  assert.equal(stripComments(css).split("\n").length, css.split("\n").length);
});

test("reports the real 1-based line number", () => {
  const css = `a {}\n\nbody { background-attachment: fixed; }`;
  assert.equal(findUngatedFixedAttachment(css)[0].line, 3);
});

// ── 2. the ground fade paints a layer, never the host (#257) ──────────────────
const THEMES_FIXTURE = `:root {
  --bp-fade-top: linear-gradient(to bottom, transparent 0%, black 45%);
  --bp-fade: var(--bp-fade-top);
}`;

const FADE_OK = `@layer base {
  :is([data-theme="blueprint"], [data-decoration])
    :is(.bg-background, .bg-card):not(
      [role="dialog"],
      [data-decoration-fade],
      [data-decoration-fade] *
    ) {
    background-image: var(--bp-grid);
  }
  [data-decoration-fade] { position: relative; isolation: isolate; }
  [data-decoration-fade]::before {
    content: "";
    pointer-events: none;
    background-image: var(--bp-grid);
    mask-image: var(--bp-fade);
  }
}`;

test("PASSES: the canonical fade shape", () => {
  assert.deepEqual(findFadeViolations(FADE_OK, THEMES_FIXTURE), []);
});

test("FAILS: mask-image on the HOST (would mask its children)", () => {
  const css = FADE_OK.replace(
    `[data-decoration-fade] { position: relative; isolation: isolate; }`,
    `[data-decoration-fade] { mask-image: var(--bp-fade); }`,
  );
  assert.ok(
    findFadeViolations(css, THEMES_FIXTURE).some((v) => v.rule === "mask-on-host"),
    "masking the host must fail",
  );
});

test("FAILS: the ::before layer swallows pointer events", () => {
  const css = FADE_OK.replace("pointer-events: none;", "");
  assert.ok(findFadeViolations(css, THEMES_FIXTURE).some((v) => v.rule === "layer-not-inert"));
});

test("FAILS: the plain-grid rule does not exclude faded hosts (double grid)", () => {
  const css = FADE_OK.replace(`      [data-decoration-fade],\n`, "");
  assert.ok(findFadeViolations(css, THEMES_FIXTURE).some((v) => v.rule === "double-grid"));
});

test("FAILS: the plain-grid rule does not exclude DESCENDANTS of a faded region", () => {
  // A nested .bg-card would otherwise punch a crisp, full-strength rectangle
  // into the field the fade just faded out.
  const css = FADE_OK.replace(`,\n      [data-decoration-fade] *`, "");
  assert.ok(findFadeViolations(css, THEMES_FIXTURE).some((v) => v.rule === "double-grid"));
});

test("a prettier line-wrap inside :not() still counts as excluded", () => {
  // The descendant argument is normalised, so `[x]\n  *` matches `[x] *`.
  const css = FADE_OK.replace(`[data-decoration-fade] *`, `[data-decoration-fade]\n      *`);
  assert.deepEqual(findFadeViolations(css, THEMES_FIXTURE), []);
});

test("FAILS: a --bp-fade-* variant the CSS consumes is undeclared", () => {
  const css = FADE_OK.replace("var(--bp-fade)", "var(--bp-fade-nowhere)");
  assert.ok(findFadeViolations(css, THEMES_FIXTURE).some((v) => v.rule === "undefined-fade-var"));
});

test("PASSES: a stylesheet without the fade hook is unconstrained", () => {
  assert.deepEqual(findFadeViolations(GATED, THEMES_FIXTURE), []);
});

// ── 3. below-floor fallback for relative color syntax (#29 item 2) ────────────
test("FAILS: oklch(from …) inks with no @supports fallback", () => {
  const css = `:root { --bp-grid-ink: oklch(from var(--foreground) l c h / 0.1); }`;
  assert.equal(hasRelativeColorFallback(css), false);
});

test("PASSES: the @supports not (color: oklch(from …)) fallback is present", () => {
  const css = `:root { --bp-grid-ink: oklch(from var(--foreground) l c h / 0.1); }
@supports not (color: oklch(from red l c h)) { :root { --bp-grid-ink: transparent; } }`;
  assert.equal(hasRelativeColorFallback(css), true);
});

test("PASSES: a stylesheet with no relative color syntax needs no fallback", () => {
  assert.equal(hasRelativeColorFallback(`:root { --x: oklch(0.5 0 0); }`), true);
});

// ── 4. integration smoke — the shipped CSS satisfies the contract ─────────────
test("PASSES: the committed decoration.css + themes.css satisfy the contract", () => {
  const decoration = readFileSync(DECORATION_CSS, "utf8");
  const themes = readFileSync(THEMES_CSS, "utf8");
  assert.deepEqual(findUngatedFixedAttachment(decoration), []);
  assert.deepEqual(findFadeViolations(decoration, themes), []);
  assert.equal(hasRelativeColorFallback(themes), true);
});
