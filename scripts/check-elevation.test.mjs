#!/usr/bin/env node
/**
 * Self-test for check-elevation.mjs (pnpm elevation:check:test).
 *
 * A gate that can silently stop firing is worse than none, so each rule is
 * exercised against a planted BAD fixture (must be found) and the real repo
 * source (must be clean). Two of the fixtures below are the exact false-negative
 * shapes that bit during authoring: CSS comments that quote the very patterns
 * the gate greps for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  SIZES,
  HAIRLINE_LAYER,
  blankComments,
  declarations,
  checkRamp,
  checkShadowlessDial,
  classStringDoubleEdge,
  checkSource,
  checkSourceDetailed,
  stripComments,
} from "./check-elevation.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const TOKENS_SRC = join(REPO_ROOT, "packages", "tokens", "src");
const THEMES = readFileSync(join(TOKENS_SRC, "themes.css"), "utf8");
const DECORATION = readFileSync(join(TOKENS_SRC, "decoration.css"), "utf8");

/** A minimal, VALID ramp — the fixtures below each break exactly one thing. */
function goodRamp() {
  let css = "@theme {\n";
  for (let n = 1; n <= 7; n++) {
    css += `  --elevation-ink-${n}: color-mix(in srgb, var(--shadow-color) calc(${n}% * var(--shadow-strength)), transparent);\n`;
  }
  for (const size of SIZES) {
    css += `  --shadow-${size}: 0 1px 2px 0 var(--elevation-ink-2);\n`;
    css += `  --shadow-ring-${size}: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};\n`;
  }
  css += `  --shadow-hairline: ${HAIRLINE_LAYER};\n}\n`;
  return css;
}

// ───────────────────────────── the real repo is clean ─────────────────────────
test("the shipped themes.css ramp passes", () => {
  assert.deepEqual(checkRamp(THEMES), []);
});

test("the shipped decoration.css shadowless dial passes", () => {
  assert.deepEqual(checkShadowlessDial(DECORATION), []);
});

test("the fixture ramp is itself clean (so failures below are the planted fault)", () => {
  assert.deepEqual(checkRamp(goodRamp()), []);
});

// ───────────────────────────── ramp integrity ─────────────────────────────────
test("a ring rung that drifts from its plain rung is caught", () => {
  const bad = goodRamp().replace(
    `--shadow-ring-md: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`,
    `--shadow-ring-md: 0 4px 9px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`,
  );
  const findings = checkRamp(bad);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /--shadow-ring-md must be --shadow-md plus the hairline/);
});

test("a ring rung that loses its hairline is caught", () => {
  const bad = goodRamp().replace(
    `--shadow-ring-lg: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`,
    "--shadow-ring-lg: 0 1px 2px 0 var(--elevation-ink-2);",
  );
  const findings = checkRamp(bad);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /--shadow-ring-lg must be --shadow-lg plus the hairline/);
});

test("a literal color smuggled into a rung is caught", () => {
  const bad = goodRamp().replace(
    "--shadow-lg: 0 1px 2px 0 var(--elevation-ink-2);",
    "--shadow-lg: 0 1px 2px 0 rgba(0, 0, 0, 0.1);",
  );
  assert.ok(checkRamp(bad).some((f) => /--shadow-lg carries a literal color/.test(f)));
});

test("an ink rung that stops reading the strength dial is caught", () => {
  const bad = goodRamp().replace(
    "--elevation-ink-3: color-mix(in srgb, var(--shadow-color) calc(3% * var(--shadow-strength)), transparent);",
    "--elevation-ink-3: oklch(0 0 0 / 0.03);",
  );
  assert.ok(checkRamp(bad).some((f) => /--elevation-ink-3 must mix/.test(f)));
});

test("a missing rung is caught", () => {
  const bad = goodRamp().replace(/ {2}--shadow-2xl:[^\n]*\n/, "");
  assert.ok(checkRamp(bad).some((f) => /missing --shadow-2xl/.test(f)));
});

// ───────────────────────────── the shadowless dial ────────────────────────────
const DIAL = `:is([data-decoration="8"], [data-decoration="9"], [data-decoration="10"])[data-decoration] {
  --shadow-strength: 0;
  --shadow-ring-color: var(--rule);
}
@layer base {
  body { color: red; }
}
`;

test("the dial fixture is clean", () => {
  assert.deepEqual(checkShadowlessDial(DIAL), []);
});

test("moving the dial into a layer is caught", () => {
  const bad = `@layer base {\n${DIAL}\n}`;
  assert.ok(checkShadowlessDial(bad).some((f) => /inside an @layer/.test(f)));
});

test("dropping the doubled [data-decoration] specificity lift is caught", () => {
  const bad = DIAL.replace(")[data-decoration] {", ") {");
  assert.ok(checkShadowlessDial(bad).some((f) => /doubled `\[data-decoration\]`/.test(f)));
});

test("deleting the dial entirely is caught", () => {
  assert.ok(
    checkShadowlessDial("@layer base { body { color: red; } }").some((f) =>
      /no `--shadow-strength: 0` rule/.test(f),
    ),
  );
});

// ── the false negatives that bit during authoring: comments quoting the pattern ──
test("a comment mentioning @layer does not fake a layer span around the dial", () => {
  const bad = `/* Do not move this into @layer base — it would lose the cascade. */\n${DIAL}`;
  assert.deepEqual(checkShadowlessDial(bad), []);
});

test("a comment containing `--name: value;` does not swallow the next declaration", () => {
  const css = `@theme {\n  /* retint with [--shadow-ring-color:var(--x)] — see the rule. */\n  --shadow-hairline: ${HAIRLINE_LAYER};\n}`;
  assert.equal(declarations(css).get("--shadow-hairline"), HAIRLINE_LAYER);
});

test("blankComments preserves offsets and line count", () => {
  const css = "a{}/* xx\nyy */b{}";
  const blanked = blankComments(css);
  assert.equal(blanked.length, css.length);
  assert.equal(blanked.split("\n").length, css.split("\n").length);
  assert.ok(!blanked.includes("xx"));
});

// ───────────────────────────── component discipline ───────────────────────────
test("border + a floating rung in one class string is the double edge", () => {
  assert.equal(classStringDoubleEdge("rounded-md border bg-popover shadow-md"), true);
  assert.equal(classStringDoubleEdge("rounded-md border-border bg-popover shadow-lg"), true);
  assert.equal(classStringDoubleEdge("rounded-md ring-1 shadow-xl"), true);
});

test("resting rungs, form-field borders and hover lifts are NOT the double edge", () => {
  // sm/xs is a resting surface — Card, Artifact, the composer well.
  assert.equal(classStringDoubleEdge("rounded-lg border bg-card shadow-sm"), false);
  // a form field keeps its own hairline token by design (ADR 0010 amendment).
  assert.equal(
    classStringDoubleEdge("rounded-md border border-input bg-background shadow-sm"),
    false,
  );
  // a bordered card lifting on hover keeps its edge.
  assert.equal(classStringDoubleEdge("rounded-lg border bg-card hover:shadow-md"), false);
  // the ring rungs are the fix, not the fault.
  assert.equal(classStringDoubleEdge("rounded-md bg-popover shadow-ring-md"), false);
});

test("raw box-shadow and arbitrary shadow utilities are caught", () => {
  assert.ok(checkSource('const s = { boxShadow: "0 4px 8px #000" };', "f.tsx").length);
  assert.ok(checkSource("a { box-shadow: 0 1px 2px red; }", "f.tsx").length);
  assert.ok(checkSource('cn("shadow-[0_0_0_1px_var(--x)]")', "f.tsx").length);
  assert.ok(checkSource('cn("hover:shadow-[0_0_0_1px_var(--x)]")', "f.tsx").length);
});

test("prose about the anti-pattern is not a finding, and the fix is not either", () => {
  assert.deepEqual(checkSource("// never hand-roll boxShadow: use a rung\n", "f.tsx"), []);
  assert.deepEqual(
    checkSource(
      '/* not shadow-[0_0_0_1px_…] */\ncn("shadow-hairline [--shadow-ring-color:var(--sidebar-border)]")',
      "f.tsx",
    ),
    [],
  );
  // transition-[…,box-shadow] names the property, it does not declare one.
  assert.deepEqual(checkSource('cn("transition-[color,box-shadow] shadow-sm")', "f.tsx"), []);
});

test("stripComments leaves URLs alone", () => {
  assert.match(stripComments('const u = "https://example.com";'), /https:\/\/example\.com/);
});

// ───────────────────────────── the escape hatch ───────────────────────────────
test("elevation-check-ignore with a reason suppresses, and is counted", () => {
  const src =
    "{/* elevation-check-ignore -- this IS the anti-pattern; the story shows it. */}\n" +
    '<div className="rounded-lg border border-border bg-card shadow-md" />';
  const r = checkSourceDetailed(src, "demo.stories.tsx");
  assert.deepEqual(r.findings, []);
  assert.equal(r.ignored, 1);
});

test("elevation-check-ignore WITHOUT a reason does not suppress", () => {
  const src =
    "{/* elevation-check-ignore */}\n" +
    '<div className="rounded-lg border border-border bg-card shadow-md" />';
  assert.equal(checkSourceDetailed(src, "demo.stories.tsx").findings.length, 1);
});

test("an ignore two lines up does not reach the finding", () => {
  const src =
    "{/* elevation-check-ignore -- reason */}\n" +
    "<Spacer />\n" +
    '<div className="rounded-lg border border-border bg-card shadow-md" />';
  assert.equal(checkSourceDetailed(src, "demo.stories.tsx").findings.length, 1);
});
