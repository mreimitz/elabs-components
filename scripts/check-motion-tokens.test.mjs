/**
 * check-motion-tokens.test.mjs — self-test for the raw motion utility gate (#178).
 * Run in CI: `node --test scripts/check-motion-tokens.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never real files).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findMotionViolations, stripComments } from "./check-motion-tokens.mjs";

const isClean = (src) => findMotionViolations(src).length === 0;
const hasViolation = (src, kind) => {
  const vs = findMotionViolations(src);
  return kind ? vs.some((v) => v.kind === kind) : vs.length > 0;
};

// ── FORBIDDEN — must FLAG ─────────────────────────────────────────────────────

test("FLAGS: transition-all in className string", () => {
  assert.ok(hasViolation(`className="rounded transition-all hover:bg-accent"`, "transition-all"));
});

test("FLAGS: transition-all in cn() array", () => {
  assert.ok(hasViolation(`cn("transition-all", "rounded")`, "transition-all"));
});

test("FLAGS: duration-150 (raw numeric duration)", () => {
  assert.ok(hasViolation(`className="transition-colors duration-150"`, "raw-duration"));
});

test("FLAGS: duration-200 (raw numeric duration)", () => {
  assert.ok(hasViolation(`"flex duration-200 ease-standard"`, "raw-duration"));
});

test("FLAGS: duration-500 (raw numeric duration)", () => {
  assert.ok(hasViolation(`className="duration-500"`, "raw-duration"));
});

test("FLAGS: ease-out (raw ease utility)", () => {
  assert.ok(hasViolation(`className="transition-colors ease-out"`, "raw-ease-out"));
});

test("FLAGS: ease-in standalone (raw ease utility)", () => {
  assert.ok(hasViolation(`className="transition-opacity ease-in"`, "raw-ease-in"));
});

test("FLAGS: ease-in-out (raw ease utility)", () => {
  assert.ok(hasViolation(`className="transition-transform ease-in-out"`, "raw-ease-in-out"));
});

test("FLAGS: multiple violations in one string", () => {
  const src = `className="transition-all duration-200 ease-out"`;
  const vs = findMotionViolations(src);
  assert.ok(vs.length >= 3, `expected ≥3 violations, got ${vs.length}`);
});

// ── ALLOWED — must NOT FLAG ───────────────────────────────────────────────────

test("DOES NOT FLAG: duration-fast (token)", () => {
  assert.ok(isClean(`className="transition-colors duration-fast ease-standard"`));
});

test("DOES NOT FLAG: duration-base (token)", () => {
  assert.ok(isClean(`className="transition-colors duration-base"`));
});

test("DOES NOT FLAG: duration-slow (token)", () => {
  assert.ok(isClean(`className="transition-opacity duration-slow ease-entrance"`));
});

test("DOES NOT FLAG: duration-slower (token)", () => {
  assert.ok(isClean(`className="duration-slower"`));
});

test("DOES NOT FLAG: ease-entrance (token)", () => {
  assert.ok(isClean(`className="transition-transform ease-entrance"`));
});

test("DOES NOT FLAG: ease-exit (token)", () => {
  assert.ok(isClean(`className="transition-colors ease-exit"`));
});

test("DOES NOT FLAG: ease-standard (token)", () => {
  assert.ok(isClean(`className="transition-colors duration-base ease-standard"`));
});

test("DOES NOT FLAG: ease-linear (built-in, allowed for loops)", () => {
  assert.ok(isClean(`className="animate-spin ease-linear"`));
});

test("DOES NOT FLAG: transition-colors with motion-reduce", () => {
  assert.ok(
    isClean(
      `className="transition-colors duration-fast ease-standard motion-reduce:transition-none"`,
    ),
  );
});

test("DOES NOT FLAG: transition-transform with tokens", () => {
  assert.ok(
    isClean(
      `className="transition-transform duration-fast ease-standard motion-reduce:transition-none"`,
    ),
  );
});

test("DOES NOT FLAG: framer-motion JS ease: easeOut (camelCase, not Tailwind)", () => {
  assert.ok(isClean(`transition={{ duration: 0.3, ease: "easeOut" }}`));
});

test("DOES NOT FLAG: framer-motion ease: easeInOut (camelCase)", () => {
  assert.ok(isClean(`ease: "easeInOut"`));
});

test("DOES NOT FLAG: CSS var reference var(--ease-standard)", () => {
  assert.ok(isClean(`style={{ transition: "opacity var(--t-base) var(--ease-standard)" }}`));
});

test("DOES NOT FLAG: cubic-bezier() in style prop", () => {
  assert.ok(isClean(`style={{ transition: "transform 260ms cubic-bezier(.2,0,0,1)" }}`));
});

test("DOES NOT FLAG: ease-in as part of a longer token (ease-in-out is matched by its own rule, not ease-in)", () => {
  // ease-in-out should match raw-ease-in-out, but ease-in\b must NOT match ease-in-out
  // because ease-in followed by '-' is not a word boundary.
  const vs = findMotionViolations(`className="ease-in-out"`);
  const kinds = vs.map((v) => v.kind);
  // Should flag ease-in-out (raw-ease-in-out) but NOT raw-ease-in separately
  assert.ok(!kinds.includes("raw-ease-in"), "ease-in\b must not match inside ease-in-out");
  assert.ok(kinds.includes("raw-ease-in-out"), "ease-in-out must still be flagged");
});

test("DOES NOT FLAG: framer-motion transition object keys (JS property 'transition:')", () => {
  // 'transition: {' is a JS object key, not a Tailwind utility
  assert.ok(isClean(`transition: {\n  duration: 0.4,\n  ease: "easeInOut"\n}`));
});

// ── Comment stripping ─────────────────────────────────────────────────────────

test("DOES NOT FLAG: transition-all inside a block comment", () => {
  assert.ok(isClean(`/* className="transition-all duration-200 ease-out" */`));
});

test("DOES NOT FLAG: transition-all inside a line comment", () => {
  assert.ok(isClean(`// className="transition-all duration-200"`));
});

test("stripComments removes block comments", () => {
  const stripped = stripComments(`/* transition-all */ foo`);
  assert.ok(!stripped.includes("transition-all"));
});

test("stripComments removes line comments", () => {
  const stripped = stripComments(`// transition-all\nfoo`);
  assert.ok(!stripped.includes("transition-all"));
});

// ── Realistic snippet: fully tokenized (should be clean) ─────────────────────

test("DOES NOT FLAG: fully-tokenized motion classes", () => {
  const src = `
    className={cn(
      "relative z-10 rounded-full transition-colors duration-slow ease-standard motion-reduce:transition-none",
      isListening ? "bg-destructive text-white" : "bg-primary text-primary-foreground",
    )}
  `;
  assert.ok(isClean(src));
});

// ── Realistic snippet: bad fixture (should flag) ──────────────────────────────

test("FLAGS: realistic bad fixture with transition-all and duration-200", () => {
  const src = `
    className={cn(
      "relative rounded transition-all duration-200 ease-out hover:bg-accent",
    )}
  `;
  const vs = findMotionViolations(src);
  assert.ok(vs.length >= 3, `expected ≥3 violations, got ${vs.length}`);
});
