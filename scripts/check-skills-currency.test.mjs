/**
 * check-skills-currency.test.mjs — locks the #29 playbook/skill/plugin prose
 * currency gate. Run in CI: `node --test scripts/check-skills-currency.test.mjs`
 * (`pnpm skills:currency:check:test`).
 *
 * All fixtures are INLINE `{ file, text }` records (hermetic — never real files),
 * mirroring check-agent-names.test.mjs. A gate that can silently stop firing is
 * worse than none (quality-gates.md, "Self-tested gates").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  checkCurrency,
  findPackageScopeViolations,
  currencyProseFiles,
  manifestFacts,
  CURRENT_SCOPE,
  INFRA_PACKAGE_SUFFIXES,
} from "./check-skills-currency.mjs";
import { findThemeCountViolations } from "./lib/theme-count-prose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);

const FACTS = { themeCount: 2, packageNames: new Set(["@elabs-ai/components-ui"]) };

// ── FLAG: the actual #29 defect shape ────────────────────────────────────────

test("FLAGS: a generated playbook template claiming 'all three themes' when only 2 ship", () => {
  const entries = [
    {
      file: "docs/playbooks/templates/dashboard.tsx",
      text: "/**\n * Verify across all three themes with globals=theme:<slug>.\n */\n",
    },
  ];
  const { themeViolations, scopeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 1);
  assert.match(themeViolations[0], /dashboard\.tsx:2/);
  assert.match(themeViolations[0], /three themes/);
  assert.equal(scopeViolations.length, 0);
});

test("FLAGS: the numeric form too ('3 themes')", () => {
  const entries = [{ file: "skills/brand-ui/SKILL.md", text: "Ships with 3 themes today." }];
  const { themeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 1);
});

// ── PASS: wording that cannot go stale, and an accurate count ───────────────

test("PASSES: 'every theme' never claims a count", () => {
  const entries = [
    {
      file: "docs/playbooks/templates/dashboard.tsx",
      text: "Verify across every theme with globals=theme:<slug>.",
    },
  ];
  const { themeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 0);
});

test("PASSES: a count that matches the manifest", () => {
  const entries = [{ file: "skills/brand-ui/SKILL.md", text: "Ships with both themes today." }];
  const { themeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 0);
});

// ── FLAG: package-name scope (the original #29 evidence's "old @brand/* scope") ──

test("FLAGS: a legacy scope on a components-* package", () => {
  const violations = findPackageScopeViolations(
    "Build UI with @brand/components-ui and @brand/components-data.",
    FACTS.packageNames,
  );
  assert.equal(violations.length, 2);
  assert.match(violations[0].reason, /not the current package scope/);
});

test("FLAGS: the current scope naming a package that does not exist", () => {
  const violations = findPackageScopeViolations(
    "See @elabs-ai/components-nonexistent for details.",
    FACTS.packageNames,
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /is not a real package/);
});

// ── PASS: current scope, real component package, and allowlisted infra pkgs ──

test("PASSES: the current scope naming a real manifest package", () => {
  const violations = findPackageScopeViolations(
    "Import from @elabs-ai/components-ui.",
    FACTS.packageNames,
  );
  assert.equal(violations.length, 0);
});

test("PASSES: an infra package not tracked by the component manifest (cli/docs/etc.)", () => {
  const violations = findPackageScopeViolations(
    "Backed by the @elabs-ai/components-cli CLI and the @elabs-ai/components-docs Storybook app.",
    FACTS.packageNames,
  );
  assert.equal(violations.length, 0);
});

test("PASSES: the wildcard mention @elabs-ai/components-* never matches a slug", () => {
  const violations = findPackageScopeViolations(
    "Build UI with @elabs-ai/components-* (ui, data, ai, flow).",
    FACTS.packageNames,
  );
  assert.equal(violations.length, 0);
});

// ── Sanity: constants and discovery haven't drifted ──────────────────────────

test("CURRENT_SCOPE is elabs-ai", () => {
  assert.equal(CURRENT_SCOPE, "elabs-ai");
});

test("INFRA_PACKAGE_SUFFIXES covers the shipped non-component packages", () => {
  for (const s of ["cli", "docs", "eslint-config", "typescript-config"]) {
    assert.ok(INFRA_PACKAGE_SUFFIXES.has(s), `missing "${s}"`);
  }
});

test("currencyProseFiles() finds real docs/playbooks + skills/*/SKILL.md + plugin manifests", () => {
  const files = currencyProseFiles(REPO_ROOT).map((f) => path.relative(REPO_ROOT, f));
  assert.ok(files.some((f) => f === path.join("docs", "playbooks", "templates", "index.json")));
  assert.ok(files.some((f) => f === path.join("skills", "brand-ui", "SKILL.md")));
  assert.ok(files.some((f) => f === path.join(".claude-plugin", "plugin.json")));
});

test("manifestFacts() reads a themeCount and a non-empty packageNames set from the real manifest", () => {
  const facts = manifestFacts(REPO_ROOT);
  assert.ok(facts, "brand-ui.manifest.json must exist (run `pnpm manifest`)");
  assert.ok(Number.isInteger(facts.themeCount) && facts.themeCount > 0);
  assert.ok(facts.packageNames.has("@elabs-ai/components-ui"));
});

test("the REAL repo currently passes skills:currency:check (CLI run)", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/check-skills-currency.mjs"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});

// ── the shared theme-count regex still fires (re-tested here so a change to the
//    shared lib that breaks THIS gate's use of it is caught locally too) ──────

test("findThemeCountViolations (shared lib) flags a stale word-form count", () => {
  const violations = findThemeCountViolations("Reads in all three themes.", 2);
  assert.equal(violations.length, 1);
});
