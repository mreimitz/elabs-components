/**
 * check-app-spec.test.mjs — locks the VP-02 #122 app-spec contract gate.
 * Run in CI: `node --test scripts/check-app-spec.test.mjs`.
 *
 * Drives the pure validator/extractor with inline fixtures, AND asserts the
 * SHIPPED example fixture validates against the SHIPPED schema (so the documented
 * contract + example can't drift apart).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  validate,
  validateSpec,
  extractSpec,
  loadSchema,
  SCHEMA_PATH,
  EXAMPLE_PATH,
} from "./check-app-spec.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = loadSchema(REPO_ROOT);

const VALID = {
  archetype: "dashboard",
  theme: "qlik-dark",
  title: "Sales Pulse",
  surfaces: [{ id: "overview", navLabel: "Overview", archetype: "dashboard" }],
  entities: [{ name: "Deal", fields: [{ name: "value", type: "number" }] }],
};

// ── the shipped artifacts agree ──────────────────────────────────────────────

test("the shipped example fixture validates against the shipped schema", () => {
  const md = readFileSync(join(REPO_ROOT, EXAMPLE_PATH), "utf8");
  const { data, error } = extractSpec(md);
  assert.equal(error, undefined, "example has a parseable ```json block");
  assert.deepEqual(validateSpec(data, schema), [], "example matches the schema");
});

test("the schema declares the right required fields + archetype enum", () => {
  assert.deepEqual(schema.required, ["archetype", "theme", "title"]);
  assert.deepEqual(schema.properties.archetype.enum, [
    "dashboard",
    "data-app",
    "ai-assistant",
    "flow-workspace",
    "settings",
    "marketing",
  ]);
});

// ── PASS ─────────────────────────────────────────────────────────────────────

test("PASSES: a minimal valid spec (just the required fields)", () => {
  assert.deepEqual(
    validateSpec({ archetype: "settings", theme: "qlik-dark", title: "X" }, schema),
    [],
  );
});

test("PASSES: the full valid spec", () => {
  assert.deepEqual(validateSpec(VALID, schema), []);
});

// ── FLAG: required fields ────────────────────────────────────────────────────

test("FLAGS: missing required field (title)", () => {
  const errs = validateSpec({ archetype: "dashboard", theme: "qlik-dark" }, schema);
  assert.ok(errs.some((e) => /missing required "title"/.test(e)));
});

// ── FLAG: enums ──────────────────────────────────────────────────────────────

test("FLAGS: unknown archetype", () => {
  const errs = validateSpec({ ...VALID, archetype: "kanban" }, schema);
  assert.ok(errs.some((e) => /archetype.*not in/.test(e)));
});

test("FLAGS: unknown theme slug (display name, not slug)", () => {
  const errs = validateSpec({ ...VALID, theme: "Qlik Dark" }, schema);
  assert.ok(errs.some((e) => /theme.*not in/.test(e)));
});

test("FLAGS: bad entity field type", () => {
  const bad = { ...VALID, entities: [{ name: "Deal", fields: [{ name: "x", type: "currency" }] }] };
  const errs = validateSpec(bad, schema);
  assert.ok(errs.some((e) => /fields\[0\]\.type.*not in/.test(e)));
});

test("FLAGS: surface missing navLabel", () => {
  const bad = { ...VALID, surfaces: [{ id: "x" }] };
  const errs = validateSpec(bad, schema);
  assert.ok(errs.some((e) => /surfaces\[0\].*missing required "navLabel"/.test(e)));
});

test("FLAGS: wrong type (entities as object, not array)", () => {
  const errs = validateSpec({ ...VALID, entities: {} }, schema);
  assert.ok(errs.some((e) => /entities: expected array/.test(e)));
});

// ── extractSpec ──────────────────────────────────────────────────────────────

test("extractSpec: returns an error when no ```json block exists", () => {
  const { error } = extractSpec("# spec\n\nno code block here\n");
  assert.match(error, /no fenced/);
});

test("extractSpec: returns an error on malformed JSON", () => {
  const { error } = extractSpec("```json\n{ not: valid }\n```");
  assert.match(error, /invalid JSON/);
});

// ── validator unit (minItems) ────────────────────────────────────────────────

test("FLAGS: an entity with zero fields (minItems)", () => {
  const errs = validate([], { type: "array", minItems: 1 }, "x");
  assert.ok(errs.some((e) => /fewer than minItems/.test(e)));
});

// ── validator unit (integer + minimum/maximum — the `taste` block, #109) ─────

test("integer accepts a whole number and rejects a fractional one", () => {
  const schema = { type: "integer" };
  assert.deepEqual(validate(4, schema, "x"), []);
  assert.ok(validate(4.5, schema, "x").some((e) => /expected integer/.test(e)));
  assert.ok(validate("4", schema, "x").some((e) => /expected integer/.test(e)));
});

test("FLAGS: an expressiveness outside the 0–10 dial (minimum/maximum)", () => {
  const schema = { type: "integer", minimum: 0, maximum: 10 };
  assert.deepEqual(validate(0, schema, "x"), []);
  assert.deepEqual(validate(10, schema, "x"), []);
  assert.ok(validate(-1, schema, "x").some((e) => /below minimum/.test(e)));
  assert.ok(validate(11, schema, "x").some((e) => /above maximum/.test(e)));
});

// ── the a11y teeth: a scaffold may never DEFAULT motion to "full" (#108 AC3) ─
// `[data-motion-pref="full"]` is the one state that keeps --motion-factor at 1
// under an OS `prefers-reduced-motion: reduce` AND escapes the third-party
// animation cap (packages/tokens/src/themes.css). That is informed consent a
// PERSON gives for themselves — never an app default a scaffold imposes on every
// visitor. The contract enforces it instead of a paragraph asking nicely.

test("PASSES: the two motion values a scaffold may default to", () => {
  for (const motion of ["system", "reduced"]) {
    assert.deepEqual(validateSpec({ ...VALID, taste: { motion } }, schema), [], motion);
  }
});

test('FLAGS: a spec that defaults motion to "full" (suppresses OS reduce-motion)', () => {
  const errs = validateSpec({ ...VALID, taste: { motion: "full" } }, schema);
  assert.ok(
    errs.some((e) => /taste\.motion: "full" not in \[system, reduced\]/.test(e)),
    `expected the motion enum to reject "full", got ${JSON.stringify(errs)}`,
  );
});

test('the schema itself excludes "full" from taste.motion (and says why)', () => {
  assert.deepEqual(schema.properties.taste.properties.motion.enum, ["system", "reduced"]);
  assert.match(schema.properties.taste.properties.motion.description, /informed-consent override/i);
});

// ── sanity ───────────────────────────────────────────────────────────────────

test("schema + example paths are the shipped reference files", () => {
  assert.match(SCHEMA_PATH, /skills\/brand-ui-new-app\/reference\/app-spec\.schema\.json$/);
  assert.match(EXAMPLE_PATH, /skills\/brand-ui-new-app\/reference\/app-spec\.example\.md$/);
});
