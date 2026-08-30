#!/usr/bin/env node
/**
 * check-paused-surfaces-drift.test.mjs — the self-test for
 * `pnpm paused-surfaces-drift:check`.
 *
 * Issue #35: `.claude/rules/paused-surfaces.md` was cited by 11 lines across 7
 * files — two of them blocking gate scripts — describing a "paused theme/package"
 * mechanism. The rule, its gate and its backing lib were deleted together in
 * d5b0208 (2026-08-16) when the blueprint theme/package were fully removed, but
 * the citations were left behind. Ground truth for #35: there is NO live
 * mechanism today. This gate's failure mode is quiet by construction — a
 * phantom citation with nothing to check it against exits 0 and reads as clean
 * — so the fixtures below plant every shape of drift and assert each one FAILS.
 *
 * Usage: node --test scripts/check-paused-surfaces-drift.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  findCitations,
  findOrphanThemeBlocks,
  findOrphanThemeFiles,
  evaluate,
  main,
  RULE_FILE,
} from "./check-paused-surfaces-drift.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const CLEAN = {
  citations: [],
  pausedExportFound: false,
  orphanThemeBlocks: [],
  orphanThemeFiles: [],
  ruleExists: false,
};

// ── The detectors ────────────────────────────────────────────────────────────

test("findCitations: FLAGS a reference to the rule file", () => {
  const hits = findCitations([
    {
      file: "docs/ADR/0003-theming-model.md",
      content: "PAUSED — see @.claude/rules/paused-surfaces.md.",
    },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 1);
});

test("findCitations: FLAGS a reference to the deleted lib file too", () => {
  const hits = findCitations([
    { file: "scripts/check-docs-accuracy.mjs", content: "like scripts/lib/paused-surfaces.mjs" },
  ]);
  assert.equal(hits.length, 1);
});

test("findCitations: case-insensitive, any line", () => {
  const hits = findCitations([{ file: "a.md", content: "ok\nok\nsee Paused-Surfaces.MD\n" }]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3);
});

test("findCitations: QUIET on the gate's own name — not every mention of the substring is a citation", () => {
  // `paused-surfaces-drift:check` (this gate's own pnpm script name, wired in
  // package.json/gates.yml) contains the substring "paused-surfaces" but names
  // no file, so it must NOT be flagged as a citation of the deleted rule.
  const hits = findCitations([
    { file: "package.json", content: '"paused-surfaces-drift:check": "node scripts/x.mjs",' },
  ]);
  assert.deepEqual(hits, []);
});

test("findCitations: QUIET on this gate's own source and self-test", () => {
  for (const file of [
    "scripts/check-paused-surfaces-drift.mjs",
    "scripts/check-paused-surfaces-drift.test.mjs",
  ]) {
    assert.deepEqual(findCitations([{ file, content: "// paused-surfaces.md" }]), []);
  }
  // Anything else, including a sibling script, is scanned.
  assert.equal(
    findCitations([{ file: "scripts/check-other.mjs", content: "// paused-surfaces.md" }]).length,
    1,
  );
});

test("findOrphanThemeBlocks: FLAGS a theme block kept as source outside BUILT_IN_THEMES", () => {
  const css = '[data-theme="light"] { --a: 1; }\n[data-theme="blueprint"] { --a: 1; }\n';
  assert.deepEqual(findOrphanThemeBlocks(css, ["light", "dark"]), ["blueprint"]);
});

test("findOrphanThemeBlocks: QUIET when every block is active", () => {
  const css = '[data-theme="light"] { --a: 1; }\n[data-theme="dark"] { --a: 1; }\n';
  assert.deepEqual(findOrphanThemeBlocks(css, ["light", "dark"]), []);
});

test("findOrphanThemeBlocks: QUIET on an illustrative selector inside a doc comment", () => {
  // themes.css explains the mechanism with an EXAMPLE selector
  // (`` `[data-theme="acme"]` block ``) inside its own `/* … */` doc comment —
  // that is prose, not a real theme kept as source, and must not be flagged.
  const css = [
    "/**",
    ' * Each `[data-theme="..."]` block overrides tokens for that theme',
    ' * (e.g. a `[data-theme="acme"]` block).',
    " */",
    '[data-theme="light"] { --a: 1; }',
    '[data-theme="dark"] { --a: 1; }',
  ].join("\n");
  assert.deepEqual(findOrphanThemeBlocks(css, ["light", "dark"]), []);
});

test("findOrphanThemeFiles: FLAGS a stylesheet on disk that isn't an active theme's own file", () => {
  assert.deepEqual(
    findOrphanThemeFiles(["light.css", "dark.css", "blueprint.css"], ["light", "dark"]),
    ["blueprint.css"],
  );
});

test("findOrphanThemeFiles: QUIET when the directory matches BUILT_IN_THEMES exactly", () => {
  assert.deepEqual(findOrphanThemeFiles(["light.css", "dark.css"], ["light", "dark"]), []);
});

// ── The verdict ──────────────────────────────────────────────────────────────

test("evaluate: FAILS on a phantom citation (the #35 bug) — no rule file backs it", () => {
  const { ok, violations } = evaluate({
    ...CLEAN,
    citations: [{ file: "docs/TOKEN_GUIDELINES.md", line: 16, text: "see paused-surfaces.md" }],
  });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /citation/i);
});

test("evaluate: FAILS on a live PAUSED_THEMES-shaped export with no rule file", () => {
  const { ok, violations } = evaluate({ ...CLEAN, pausedExportFound: true });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /PAUSED_THEMES/);
});

test("evaluate: FAILS on a theme block kept as source with no rule file (case 3 from #35)", () => {
  const { ok, violations } = evaluate({ ...CLEAN, orphanThemeBlocks: ["blueprint"] });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /blueprint/);
});

test("evaluate: FAILS on an orphan theme stylesheet with no rule file", () => {
  const { ok, violations } = evaluate({ ...CLEAN, orphanThemeFiles: ["blueprint.css"] });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /blueprint\.css/);
});

test("evaluate: FAILS on a rule file that documents nothing real (the rejected 'write the rule first' shape)", () => {
  const { ok, violations } = evaluate({ ...CLEAN, ruleExists: true });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /orphaned rule/i);
});

// PR #58 finding "Reject every partial paused-surface state": the original
// three branches only fired when the rule was ABSENT, or when the rule was
// present with NEITHER other leg — so a rule present with exactly ONE of
// (citation, mechanism) silently passed as `ok`. These two cases lock that.

test("evaluate: FAILS when the rule is cited but no live mechanism backs it (prose with no code)", () => {
  const { ok, violations } = evaluate({
    ...CLEAN,
    ruleExists: true,
    citations: [
      { file: "docs/ADR/9999-x.md", line: 1, text: "see .claude/rules/paused-surfaces.md" },
    ],
  });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /no live paused-surface mechanism was found/i);
});

test("evaluate: FAILS when a live mechanism and the rule both exist but nothing cites the rule (undiscoverable)", () => {
  const { ok, violations } = evaluate({
    ...CLEAN,
    ruleExists: true,
    pausedExportFound: true,
  });
  assert.equal(ok, false);
  assert.match(violations.join("\n"), /nothing cites the rule/i);
});

test("evaluate: PASSES when the concept is fully absent — today's real state", () => {
  const { ok, violations } = evaluate({ ...CLEAN });
  assert.equal(ok, true);
  assert.deepEqual(violations, []);
});

test("evaluate: PASSES when a live mechanism is fully documented and cited", () => {
  const { ok } = evaluate({
    citations: [
      { file: "docs/ADR/9999-x.md", line: 1, text: "see .claude/rules/paused-surfaces.md" },
    ],
    pausedExportFound: true,
    orphanThemeBlocks: ["blueprint"],
    orphanThemeFiles: ["blueprint.css"],
    ruleExists: true,
  });
  assert.equal(ok, true);
});

// ── The wiring (an unregistered gate never fires) ───────────────────────────

test("the gate is wired in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["paused-surfaces-drift:check"],
    "node scripts/check-paused-surfaces-drift.mjs",
  );
  assert.equal(
    pkg.scripts["paused-surfaces-drift:check:test"],
    "node --test scripts/check-paused-surfaces-drift.test.mjs",
  );
});

test("the gate and its self-test are reachable from gates.yml", () => {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
  assert.match(workflow, /^\s*pnpm paused-surfaces-drift:check\s*$/m);
  assert.match(workflow, /^\s*pnpm paused-surfaces-drift:check:test\s*$/m);
});

test("RULE_FILE points at the doc this gate is about", () => {
  assert.equal(RULE_FILE, ".claude/rules/paused-surfaces.md");
});

test("this gate itself passes cleanly against the real repo (dogfood)", () => {
  // A light re-derivation of two of the four signals main() checks, so this
  // assertion doesn't depend on main()'s own git/fs plumbing.
  const themeTypesPath = join(REPO_ROOT, "packages", "tokens", "src", "theme-types.ts");
  const themeTypesText = readFileSync(themeTypesPath, "utf8");
  assert.equal(/\bPAUSED_THEMES\b|\bisPausedThemeName\b/.test(themeTypesText), false);
  assert.equal(
    existsSync(join(REPO_ROOT, RULE_FILE)),
    false,
    `${RULE_FILE} should not exist — the concept is fully deleted per #35`,
  );
});

test("main() end-to-end returns 0 against the real repo (real dogfood, real git scan)", () => {
  // Unlike the re-derivation above, this runs the FULL CLI logic — including
  // the `git ls-files` scan over every tracked file — which is exactly what
  // caught this gate's own two false-positive bugs during development: its
  // pnpm script name self-matching (fixed by SELF_FILES + the `.md`/`.mjs`
  // suffix requirement in CITATION_RE) and its own wiring line in AGENTS.md's
  // command contract quoting the dead rule path as an example (fixed by
  // rewording the contract entry, not by exempting AGENTS.md — a real citation
  // there should still fail). A silent console.log/error from main() is
  // expected and not asserted on.
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  let exitCode;
  try {
    exitCode = main();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(exitCode, 0);
});
