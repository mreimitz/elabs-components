#!/usr/bin/env node
/**
 * check-debrand.test.mjs — the self-test for `pnpm debrand:check`.
 *
 * A gate that can silently stop firing is worse than none
 * (@.claude/rules/quality-gates.md), and THIS gate's failure mode is quiet by
 * construction: a pattern that matches nothing exits 0 and reads as "clean".
 * So the fixtures below plant the real shapes the codemods missed — prose, a
 * snake_case identifier, camelCase — and assert each one FAILS.
 *
 * Usage: node --test scripts/check-debrand.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { findBrandHits, BRAND_RE } from "./check-debrand.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const scan = (files) => findBrandHits(files);

// ── The detector ─────────────────────────────────────────────────────────────

test("FLAGS: prose naming the upstream org", () => {
  const hits = scan([
    {
      file: "docs/guide.md",
      content: "Re-branding (e.g. the Qlik Green primary) is a token change.",
    },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 1);
});

test("FLAGS: every shape the case-sensitive codemods missed", () => {
  for (const content of [
    'name: "qlik_create_data_object",', // snake_case identifier
    " * Generalized from qlabs-workbench app-providers.", // a comment
    "Grounded in two shipping qLabs apps.", // camelCase
    "UNLICENSED — internal to Qlik CoE EMEA.", // the org slug, spaced
    "https://github.com/qlik-coe-emea/elabs-components/issues/368", // the slug, hyphenated
  ]) {
    const hits = scan([{ file: "packages/ui/src/a.tsx", content }]);
    assert.equal(hits.length, 1, `expected a hit for: ${content}`);
  }
});

test("FLAGS: a hit on any line, not only the first", () => {
  const hits = scan([{ file: "packages/ui/src/a.tsx", content: "ok\nok\n// Qlik Cloud\n" }]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3);
});

// ── No exemptions (an allowlist is a place a real hit could hide) ────────────

test("FLAGS: a hit in themes.css like anywhere else — no per-block carve-out", () => {
  const css = [
    ":root {",
    "  /* the Qlik Cloud faces */",
    "}",
    '[data-theme="dark"] {',
    "  /* Brand mark (Qlik logo). */",
    "}",
  ].join("\n");
  const hits = scan([{ file: "packages/tokens/src/themes.css", content: css }]);
  assert.equal(hits.length, 2);
  assert.deepEqual(
    hits.map((h) => h.line),
    [2, 5],
  );
});

test("PASSES: only this gate's own source and self-test", () => {
  for (const file of ["scripts/check-debrand.mjs", "scripts/check-debrand.test.mjs"]) {
    assert.deepEqual(scan([{ file, content: "// Qlik Cloud" }]), []);
  }
  // Anything else, including a sibling script, is scanned.
  assert.equal(scan([{ file: "scripts/check-other.mjs", content: "// Qlik" }]).length, 1);
});

// ── The noise floor (why this gate is trusted) ───────────────────────────────

test("QUIET: English words starting 'coe' are not the org slug", () => {
  // The arm is anchored as `coe[-_ ]emea`, so no allowlist is needed — and an
  // allowlist is a place a real hit could hide. Locks the narrow pattern in.
  const content = "coerce the value; these coexist; the coefficient is 0.5";
  assert.deepEqual(scan([{ file: "packages/ui/src/a.tsx", content }]), []);
  assert.equal(BRAND_RE.test("coefficient"), false);
});

test("QUIET: the repo's own scope is not a hit", () => {
  const content = 'import { Button } from "@elabs/components-ui"; // elabs-components';
  assert.deepEqual(scan([{ file: "packages/ui/src/a.tsx", content }]), []);
});

// ── The wiring (an unregistered gate never fires) ────────────────────────────

test("the pre-commit hook still runs the staged arm", () => {
  // This fork has no CI workflows, so the commit hook is the ONLY enforcement
  // point. A gate that is no longer invoked is indistinguishable from a passing
  // one — assert the wiring, not just the detector.
  const hook = readFileSync(join(REPO_ROOT, ".githooks", "pre-commit"), "utf8");
  assert.match(hook, /node scripts\/check-debrand\.mjs --staged/);
});

test("both scripts are wired in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["debrand:check"], "node scripts/check-debrand.mjs");
  assert.equal(pkg.scripts["debrand:check:test"], "node --test scripts/check-debrand.test.mjs");
});
