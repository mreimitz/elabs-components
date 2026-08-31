/**
 * check-skills-currency.test.mjs — locks the #29/#34 playbook/skill/plugin
 * prose currency gate (theme count + package-name scope + private-registry
 * claims, and their coverage of every skill's reference subtree). Run in CI:
 * `node --test scripts/check-skills-currency.test.mjs`
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
  findPrivateRegistryClaims,
  currencyProseFiles,
  manifestFacts,
  deriveCurrentScope,
  INFRA_PACKAGE_SUFFIXES,
} from "./check-skills-currency.mjs";
import { findThemeCountViolations } from "./lib/theme-count-prose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);

const FACTS = {
  themeCount: 2,
  packageNames: new Set(["@elabs-ai/components-ui"]),
  currentScope: "elabs-ai",
};

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

// ── FLAG: the #29 hardening — an adjective between the number and "themes",
//    and a markdown line-wrap splitting the two ─────────────────────────────

test("FLAGS: an adjective between the number and 'themes' ('three shipped themes')", () => {
  const entries = [
    {
      file: "skills/brand-ui-new-app/SKILL.md",
      text: "render the scaffold in all three shipped themes — `light`, `dark`.",
    },
  ];
  const { themeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 1);
  assert.match(themeViolations[0], /three shipped themes/);
});

test("FLAGS: a markdown line-wrap splitting the number from 'themes' ('all three\\nthemes')", () => {
  const entries = [
    {
      file: "skills/brand-ui/reference/rules.md",
      text: "components rely on semantic tokens so all three\nthemes (light default, dark) benefit.",
    },
  ];
  const { themeViolations } = checkCurrency(entries, FACTS);
  assert.equal(themeViolations.length, 1);
  // the violation must report the line the match STARTS on (line 1 here — "all
  // three"), not an off-by-one from the line the regex's internal \n-join hides.
  assert.match(themeViolations[0], /rules\.md:1:/);
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
    FACTS.currentScope,
  );
  assert.equal(violations.length, 2);
  assert.match(violations[0].reason, /not the current package scope/);
});

test("FLAGS: the current scope naming a package that does not exist", () => {
  const violations = findPackageScopeViolations(
    "See @elabs-ai/components-nonexistent for details.",
    FACTS.packageNames,
    FACTS.currentScope,
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /is not a real package/);
});

// ── PASS: current scope, real component package, and allowlisted infra pkgs ──

test("PASSES: the current scope naming a real manifest package", () => {
  const violations = findPackageScopeViolations(
    "Import from @elabs-ai/components-ui.",
    FACTS.packageNames,
    FACTS.currentScope,
  );
  assert.equal(violations.length, 0);
});

test("PASSES: an infra package not tracked by the component manifest (cli/docs/etc.)", () => {
  const violations = findPackageScopeViolations(
    "Backed by the @elabs-ai/components-cli CLI and the @elabs-ai/components-docs Storybook app.",
    FACTS.packageNames,
    FACTS.currentScope,
  );
  assert.equal(violations.length, 0);
});

test("PASSES: the wildcard mention @elabs-ai/components-* never matches a slug", () => {
  const violations = findPackageScopeViolations(
    "Build UI with @elabs-ai/components-* (ui, data, ai, flow).",
    FACTS.packageNames,
    FACTS.currentScope,
  );
  assert.equal(violations.length, 0);
});

// ── FLAG/PASS: private-registry claims (#34) — the packages are public npm ───

test("FLAGS: a skill reference file claiming the packages are private on GitHub Packages", () => {
  const entries = [
    {
      file: "skills/brand-ui-new-app/reference/starter-claude-md.md",
      text: "The packages are private on GitHub Packages, so a standalone app cannot install\nwithout this.",
    },
  ];
  const { privateRegistryViolations } = checkCurrency(entries, FACTS);
  assert.ok(privateRegistryViolations.length >= 1);
  assert.match(privateRegistryViolations[0], /starter-claude-md\.md:1/);
});

test("FLAGS: '... a private GitHub Packages dependency ...'", () => {
  const violations = findPrivateRegistryClaims(
    "install `@elabs-ai/components-cli` — a private GitHub Packages dependency, see docs.",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0].match, /private GitHub Packages/i);
});

test("PASSES: legitimate public-npm install prose", () => {
  const violations = findPrivateRegistryClaims(
    "`@elabs-ai/components-cli` — a public npm package, see `docs/CONSUMING.md` §1.",
  );
  assert.equal(violations.length, 0);
});

test("PASSES: an unrelated, still-TRUE 'private' claim near the word 'registry'", () => {
  // The shared eslint-config really IS private/unpublished — this must not be
  // confused with the packages' (public) registry model.
  const violations = findPrivateRegistryClaims(
    "The shared config is a private, unpublished package. It is not on the registry\nunder any version, so a project outside the monorepo cannot install it.",
  );
  assert.equal(violations.length, 0);
});

test("PASSES: generic consumer-facing 'private registry' advice with no self-reference (#81 review)", () => {
  // Legitimate guidance for a CONSUMER's own private-registry setup, naming
  // none of our packages — must not be confused with a claim that
  // @elabs-ai/components-* itself is private.
  const violations = findPrivateRegistryClaims(
    "If your company uses a private npm registry, configure authentication here.",
  );
  assert.equal(violations.length, 0);
});

test("PASSES: 'private GitHub Packages registry' advice with no self-reference (#81 review)", () => {
  // "GitHub Packages" is the hosting service's own proper noun — it must not
  // be mistaken for a self-reference just because it contains "Packages".
  const violations = findPrivateRegistryClaims(
    "For enterprise users behind a private GitHub Packages registry, set NODE_AUTH_TOKEN.",
  );
  assert.equal(violations.length, 0);
});

test("PASSES: private-registry check does not run outside skills/** (docs/ historical narrative is exempt)", () => {
  const entries = [
    {
      file: "docs/playbooks/templates/dashboard.tsx",
      text: "The packages used to be private on GitHub Packages before the public-npm move.",
    },
  ];
  const { privateRegistryViolations } = checkCurrency(entries, FACTS);
  assert.equal(privateRegistryViolations.length, 0);
});

test("currencyProseFiles() includes a skills/*/reference/*.md file (#29/#34 — the top-level-only gap)", () => {
  const files = currencyProseFiles(REPO_ROOT).map((f) => path.relative(REPO_ROOT, f));
  assert.ok(
    files.some(
      (f) => f === path.join("skills", "brand-ui-new-app", "reference", "starter-claude-md.md"),
    ),
    "expected skills/brand-ui-new-app/reference/starter-claude-md.md in currencyProseFiles()'s output",
  );
});

// ── Sanity: constants and discovery haven't drifted ──────────────────────────

test("deriveCurrentScope: a single shared @<scope>/components-* prefix resolves to that scope", () => {
  const names = new Set([
    "@elabs-ai/components-ui",
    "@elabs-ai/components-data",
    "@elabs-ai/components-ai",
  ]);
  assert.equal(deriveCurrentScope(names), "elabs-ai");
});

test("deriveCurrentScope: throws when the manifest carries two different scopes", () => {
  const names = new Set(["@elabs-ai/components-ui", "@brand/components-data"]);
  assert.throws(() => deriveCurrentScope(names), /expected exactly one/);
});

test("deriveCurrentScope: throws when nothing matches the @<scope>/components-* shape", () => {
  const names = new Set(["@elabs-ai/cli", "@elabs-ai/docs"]);
  assert.throws(() => deriveCurrentScope(names), /expected exactly one/);
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
