/**
 * validate-registry.test.mjs — self-test for the registry `homepage` guard (#264).
 * Run in CI: `node --test scripts/validate-registry.test.mjs` (`pnpm registry:validate:test`).
 *
 * All fixtures are INLINE values (hermetic — never real files), mirroring
 * check-docs-accuracy.test.mjs / check-motion-tokens.test.mjs. A gate that can
 * silently stop firing is worse than none (quality-gates.md, "Self-tested gates").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findHomepageViolation } from "./validate-registry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── FLAGS: a placeholder homepage ───────────────────────────────────────────

test("FLAGS: the shipped example.internal placeholder", () => {
  const violation = findHomepageViolation("https://example.internal/brand-ui");
  assert.ok(violation, "expected a violation for the placeholder host");
  assert.match(violation, /placeholder/);
});

test("FLAGS: a <your-registry-host> style placeholder", () => {
  assert.ok(findHomepageViolation("https://<your-registry-host>/r/foo.json"));
});

test("FLAGS: localhost", () => {
  assert.ok(findHomepageViolation("http://localhost:6006/r"));
});

test("FLAGS: a non-https URL", () => {
  const violation = findHomepageViolation("http://example.com/brand-ui");
  assert.ok(violation);
});

test("PASSES: an omitted homepage (this repo has no canonical origin to name)", () => {
  assert.equal(findHomepageViolation(undefined), null);
  assert.equal(findHomepageViolation(null), null);
});

test("FLAGS: a present-but-empty homepage — omit the key instead", () => {
  const violation = findHomepageViolation("");
  assert.ok(violation);
  assert.match(violation, /empty/);
});

// ── PASSES: a real, resolvable URL ──────────────────────────────────────────

test("PASSES: a real https:// homepage", () => {
  assert.equal(findHomepageViolation("https://brand-ui.example-real-domain.io/registry"), null);
});

// ── CLI: the REAL repo currently passes the gate ────────────────────────────

test("the REAL repo currently passes registry:validate (CLI run)", () => {
  const out = execFileSync("node", [path.join(HERE, "validate-registry.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✓ Registry OK/);
});
