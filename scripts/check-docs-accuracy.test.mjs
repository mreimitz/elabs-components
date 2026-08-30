/**
 * check-docs-accuracy.test.mjs — self-test for the docs-truth guard's version-literal
 * rung (#266). Run in CI: `node --test scripts/check-docs-accuracy.test.mjs`
 * (`pnpm docs:check:test`).
 *
 * All fixtures are INLINE strings (hermetic — never real files), mirroring
 * check-motion-tokens.test.mjs / check-raw-palette.test.mjs. A gate that can
 * silently stop firing is worse than none (quality-gates.md, "Self-tested gates").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  findVersionLiteralViolations,
  VERSION_LITERAL_EXEMPT,
  findCiContractViolations,
  findDualCanvasViolations,
  findReleaseCountViolations,
  findThemeCountViolations,
  findScriptPathViolations,
  SCRIPT_PATH_REMOVED_EXEMPT,
  isSkippedWalkDir,
  stripEmphasis,
  themeCountFromSource,
  THEME_COUNT_EXEMPT_PREFIXES,
  WALK_SKIP_DIRS,
} from "./check-docs-accuracy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);
const CURRENT = "1.7.0";

// ── FLAGS: a stale literal that disagrees with the current version ────────────

test("FLAGS: gh release download vN.N.N mismatching the current version", () => {
  const text = "gh release download v9.9.9 -R mreimitz/elabs-components -D vendor/brand-ui";
  const violations = findVersionLiteralViolations(text, CURRENT);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
  assert.equal(violations[0].match, "v9.9.9");
});

test("FLAGS: -N.N.N.tgz tarball filename mismatching the current version", () => {
  const text = '"@elabs-ai/components-ui": "file:vendor/brand-ui/brand-ui-9.9.9.tgz",';
  const violations = findVersionLiteralViolations(text, CURRENT);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, "-9.9.9.tgz");
});

test("FLAGS: -N.N.N.zip agent-kit filename mismatching the current version", () => {
  const text = "unzip brand-ui-agent-kit-9.9.9.zip";
  const violations = findVersionLiteralViolations(text, CURRENT);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, "-9.9.9.zip");
});

test("FLAGS: @elabs-ai/components-x@N.N.N package pin mismatching the current version", () => {
  const text =
    "cross-package peers (`@elabs-ai/components-ui -> @elabs-ai/components-tokens@9.9.9`, etc.)";
  const violations = findVersionLiteralViolations(text, CURRENT);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, "@elabs-ai/components-tokens@9.9.9");
});

test("multiple violations on one line are all reported", () => {
  const text = "gh release download v9.9.9 then unzip brand-ui-agent-kit-9.9.9.zip";
  assert.equal(findVersionLiteralViolations(text, CURRENT).length, 2);
});

// ── PASSES: the vX.Y.Z / -X.Y.Z.tgz placeholder never matches ─────────────────

test("PASSES: the vX.Y.Z placeholder", () => {
  const text = "gh release download vX.Y.Z -R mreimitz/elabs-components -D vendor/brand-ui";
  assert.deepEqual(findVersionLiteralViolations(text, CURRENT), []);
});

test("PASSES: the -X.Y.Z.tgz / -X.Y.Z.zip placeholder", () => {
  const text = [
    '"@elabs-ai/components-ui": "file:vendor/brand-ui/brand-ui-X.Y.Z.tgz",',
    "brand-ui-agent-kit-X.Y.Z.zip",
    "@elabs-ai/components-tokens@X.Y.Z",
  ].join("\n");
  assert.deepEqual(findVersionLiteralViolations(text, CURRENT), []);
});

// ── PASSES: a literal equal to the current version ─────────────────────────────

test("PASSES: a literal EQUAL to the current version", () => {
  const text = [
    `gh release download v${CURRENT} -R mreimitz/elabs-components -D vendor/brand-ui`,
    `"@elabs-ai/components-ui": "file:vendor/brand-ui/brand-ui-${CURRENT}.tgz",`,
    `brand-ui-agent-kit-${CURRENT}.zip`,
    `@elabs-ai/components-tokens@${CURRENT}`,
  ].join("\n");
  assert.deepEqual(findVersionLiteralViolations(text, CURRENT), []);
});

// ── Exemption set ───────────────────────────────────────────────────────────────

test("VERSION_LITERAL_EXEMPT names docs/RELEASING.md (worked-example literals)", () => {
  assert.ok(VERSION_LITERAL_EXEMPT.has("docs/RELEASING.md"));
});

// ── DUAL-CANVAS DECISION (#183) — @elabs-ai/components-ai vs @elabs-ai/components-flow ────────

// The real row always includes `chat → @elabs-ai/components-ai` — a naive "does the
// line contain -ai anywhere" check would always pass because of THAT clause, even
// with single-surface canvas routing. These fixtures include the chat clause so
// the test actually exercises that trap.
const GOOD_D3_LINE =
  "| **D3** | Which package | chat → `@elabs-ai/components-ai` · " +
  "canvas → `@elabs-ai/components-flow` (author-built diagrams) · " +
  "in-chat agent workspace graph → `@elabs-ai/components-ai` (ADR 0018) | detail |";
const SINGLE_SURFACE_D3_LINE =
  "| **D3** | Which package | chat → `@elabs-ai/components-ai` · " +
  "canvas → `@elabs-ai/components-flow` | detail |";
const GOOD_ADR_TITLES = [
  "# ADR 0018 — Dual React Flow canvas surfaces (`@elabs-ai/components-ai` and `@elabs-ai/components-flow`)",
];

test("PASSES: a dual-canvas ADR title + a D3 row naming both -flow and -ai", () => {
  const violations = findDualCanvasViolations({
    adrTitles: GOOD_ADR_TITLES,
    decisionsMdText: GOOD_D3_LINE,
  });
  assert.deepEqual(violations, []);
});

test("FLAGS: D3 row reverted to single-surface canvas routing (chat still names -ai, canvas doesn't)", () => {
  const violations = findDualCanvasViolations({
    adrTitles: GOOD_ADR_TITLES,
    decisionsMdText: SINGLE_SURFACE_D3_LINE,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /D3 row's canvas routing must name BOTH/);
});

test("FLAGS: no ADR title matches the dual-canvas pattern", () => {
  const violations = findDualCanvasViolations({
    adrTitles: ["# ADR 0001 — Architecture", "# ADR 0017 — Microcopy adoption and key namespacing"],
    decisionsMdText: GOOD_D3_LINE,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /no ADR title matches/);
});

test("FLAGS: both the ADR and the D3 row are missing/reverted at once", () => {
  const violations = findDualCanvasViolations({
    adrTitles: ["# ADR 0001 — Architecture"],
    decisionsMdText: SINGLE_SURFACE_D3_LINE,
  });
  assert.equal(violations.length, 2);
});

test("PASSES: an ADR title matching /two.*canvas/i (not just 'dual')", () => {
  const violations = findDualCanvasViolations({
    adrTitles: ["# ADR 0018 — The two React Flow canvas surfaces"],
    decisionsMdText: GOOD_D3_LINE,
  });
  assert.deepEqual(violations, []);
});

// ── THEME COUNT (#64) — derived from THEMES, word AND numeric forms ────────────

test("the count is DERIVED from packages/tokens/src/theme-types.ts", () => {
  const src = 'export const BUILT_IN_THEMES = ["light", "dark", "drafting"] as const;';
  assert.equal(themeCountFromSource(src), 3);
  assert.equal(themeCountFromSource('export const BUILT_IN_THEMES = ["a", "b"] as const;'), 2);
  assert.equal(themeCountFromSource("no themes here"), null);
});

test("FLAGS: the word form ('all six themes') the PR template carried for months", () => {
  const text = "- [ ] Works in all six themes (light, dark, light, dark, high-contrast)";
  const v = findThemeCountViolations(text, 3);
  assert.equal(v.length, 1);
  assert.equal(v[0].claimed, 6);
  assert.equal(v[0].line, 1);
});

test("FLAGS: the NUMERIC form ('6 themes') the word-only regex used to miss", () => {
  const v = findThemeCountViolations("theme-safety in all\n6 themes.", 3);
  assert.equal(v.length, 1);
  assert.equal(v[0].claimed, 6);
  assert.equal(v[0].line, 2);
});

test("FLAGS: an UNDER-count too (a theme was added and the docs lagged)", () => {
  assert.equal(findThemeCountViolations("verified in both two themes", 3).length, 1);
});

test("PASSES: the current count, in either form", () => {
  assert.deepEqual(findThemeCountViolations("all three themes (light, …)", 3), []);
  assert.deepEqual(findThemeCountViolations("3 themes ship today", 3), []);
});

test("PASSES: prose that never states a count", () => {
  assert.deepEqual(findThemeCountViolations("themes are data-theme blocks", 3), []);
});

test("a missing THEMES export disables the rung rather than flagging everything", () => {
  assert.deepEqual(findThemeCountViolations("all six themes", null), []);
});

test("ADRs are exempt — they are dated records of what shipped then", () => {
  assert.ok(THEME_COUNT_EXEMPT_PREFIXES.includes("docs/ADR/"));
});

// ── GENERATED HARNESS MIRRORS are out of scope ────────────────────────────────
// `pnpm skills:build` writes .cursor/.gemini/.agents/.github `skills/` mirrors.
// They are git-ignored (.gitignore:51-54) — the repo neither tracks nor owns
// their content, and the canonical `skills/**` source is not scanned either — so
// scanning the mirror held generated output to a stricter standard than its source
// and made `pnpm docs:check` red on a clean tree the moment skills:build had run.

test("the four generated skill mirrors are excluded from the doc walk", () => {
  for (const d of [".cursor/skills", ".gemini/skills", ".agents/skills", ".github/skills"]) {
    assert.ok(WALK_SKIP_DIRS.has(d), `${d} must be skipped`);
    assert.ok(isSkippedWalkDir("/repo", path.join("/repo", ...d.split("/"))));
  }
  assert.ok(
    !isSkippedWalkDir("/repo", "/repo/.github/ISSUE_TEMPLATE"),
    ".github itself is scanned",
  );
  assert.ok(!isSkippedWalkDir("/repo", "/repo/docs"));
});

test("a stale claim planted in the generated .github/skills mirror does NOT fail docs:check", () => {
  const probe = path.join(REPO_ROOT, ".github", "skills", "docs-check-probe");
  try {
    mkdirSync(probe, { recursive: true });
    // Two violations the gate would fire on in a real doc: a stale theme count
    // and a version literal that disagrees with the current release.
    writeFileSync(
      path.join(probe, "SKILL.md"),
      "# probe\n\nWorks in all six themes. `gh release download v9.9.9`\n",
    );
    const out = execFileSync("node", [path.join(HERE, "check-docs-accuracy.mjs")], {
      encoding: "utf8",
    });
    assert.match(out, /✔ docs-accuracy/);
  } finally {
    rmSync(path.join(REPO_ROOT, ".github", "skills"), { recursive: true, force: true });
  }
});

// ── CI GATE CONTRACT (#158) — including the vacuous-resolution guard ──────────

const CONTRACT_GATES_YML = [
  "on:",
  "  workflow_call:",
  "jobs:",
  "  gates:",
  "    steps:",
  "      - run: pnpm install --frozen-lockfile",
  "      - run: pnpm typecheck",
  "      - run: pnpm docs:check",
].join("\n");

const CONTRACT_CI_YML = [
  "on:",
  "  pull_request:",
  "jobs:",
  "  gates:",
  "    uses: ./.github/workflows/gates.yml",
].join("\n");

const readContractGates = (rel) =>
  rel === ".github/workflows/gates.yml" ? CONTRACT_GATES_YML : null;

test("PASSES: every blocking gate is named in the AGENTS.md contract", () => {
  const violations = findCiContractViolations({
    ciText: CONTRACT_CI_YML,
    agentsText: "```bash\npnpm typecheck\npnpm docs:check\n```",
    readWorkflow: readContractGates,
  });
  assert.deepEqual(violations, []);
});

test("FLAGS: a blocking gate missing from the AGENTS.md contract", () => {
  const violations = findCiContractViolations({
    ciText: CONTRACT_CI_YML,
    agentsText: "```bash\npnpm typecheck\n```",
    readWorkflow: readContractGates,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /pnpm docs:check.*missing from/);
});

test("FLAGS the VACUOUS case: the reusable workflow no longer resolves", () => {
  // The whole gate list lives behind one `uses:` line. If that stops resolving,
  // the contract check has nothing to compare and would green-light everything.
  const violations = findCiContractViolations({
    ciText: CONTRACT_CI_YML,
    agentsText: "```bash\npnpm typecheck\npnpm docs:check\n```",
    readWorkflow: () => null,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /resolved ZERO blocking gates/);
});

test("a workspace-scoped gate step is matched against the contract as written", () => {
  const ci =
    CONTRACT_CI_YML +
    "\n  stories:\n    steps:\n      - run: pnpm --filter @x/docs test-storybook\n";
  assert.deepEqual(
    findCiContractViolations({
      ciText: ci,
      agentsText: "pnpm typecheck\npnpm docs:check\npnpm --filter @x/docs test-storybook",
      readWorkflow: readContractGates,
    }),
    [],
  );
  const missing = findCiContractViolations({
    ciText: ci,
    agentsText: "pnpm typecheck\npnpm docs:check",
    readWorkflow: readContractGates,
  });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /--filter @x\/docs test-storybook/);
});

// ── RELEASE-SET COUNTS (#295) — RELEASING.md ↔ the derived sets ───────────────

const COUNTS = { lockstepSites: 16, componentPackages: 11, publishedPackages: 12 };

test("PASSES: the runbook's counts equal the derived ones", () => {
  const text = [
    "One command writes all **16** lockstep sites: the 11 component packages,",
    "the CLI, the root, both `.claude-plugin` manifests.",
    "published v2.0.0 (12 packages + the agent-kit and plugin zips)",
  ].join("\n");
  assert.deepEqual(findReleaseCountViolations(text, COUNTS), []);
});

// The bold form is the one the runbook actually uses for its most load-bearing
// counts, and it was the one the rung could not see: `\d+\s+lockstep sites`
// cannot match across the `**`. Mutating docs/RELEASING.md:49 to `**17**` and
// :227 to `**all 99**` both left `pnpm docs:check` GREEN. Asserting the BOLD
// WRONG form is FLAGGED is what stops that hole reopening — a fixture that only
// asserts the bold RIGHT form passes for the wrong reason.

test("FLAGS: a wrong count written in BOLD — `all **99** lockstep sites`", () => {
  const v = findReleaseCountViolations("restored **all 99** lockstep sites", COUNTS);
  assert.equal(v.length, 1, "markdown emphasis must not hide a stale count");
  assert.equal(v[0].claimed, 99);
  assert.equal(v[0].expected, 16);
});

test("FLAGS: emphasis wrapped around the DIGITS only — `all **17** lockstep sites`", () => {
  const v = findReleaseCountViolations("One command writes all **17** lockstep sites:", COUNTS);
  assert.equal(v.length, 1);
  assert.equal(v[0].claimed, 17);
});

test("FLAGS: the bold form for the other two rungs as well", () => {
  assert.equal(findReleaseCountViolations("the **10** component packages", COUNTS).length, 1);
  assert.equal(findReleaseCountViolations("published (**11** packages)", COUNTS).length, 1);
});

test("stripEmphasis normalises the markers the counts hide behind", () => {
  assert.equal(stripEmphasis("all **16** lockstep sites"), "all 16 lockstep sites");
  assert.equal(stripEmphasis("the _11_ `component` packages"), "the 11 component packages");
});

test("FLAGS: a lockstep-site count left behind when a package was added", () => {
  const v = findReleaseCountViolations("writes all 15 lockstep sites", COUNTS);
  assert.equal(v.length, 1);
  assert.equal(v[0].claimed, 15);
  assert.equal(v[0].expected, 16);
});

test("FLAGS: the '11 component packages' literal after a 12th package lands", () => {
  const v = findReleaseCountViolations("the 10 component packages, the CLI", COUNTS);
  assert.equal(v.length, 1);
  assert.equal(v[0].expected, 11);
});

test("FLAGS: a bare 'N packages' claim that disagrees with the published set", () => {
  const v = findReleaseCountViolations("published v1.7.0 (11 packages + the zips)", COUNTS);
  assert.equal(v.length, 1);
  assert.equal(v[0].expected, 12);
});

test("'N component packages' is claimed by ONE rung, not two", () => {
  // The bare-`packages` rung must not also fire on "11 component packages"
  // (11 !== publishedPackages) — that would make the correct text unwritable.
  assert.deepEqual(findReleaseCountViolations("the 11 component packages", COUNTS), []);
});

// ── SCRIPT PATHS: refs to non-existent scripts must be caught ──────────────────

test("FLAGS: a reference to a non-existent script path", () => {
  const files = [
    {
      file: ".claude/rules/quality-gates.md",
      content: "Exemptions are derived from `scripts/lib/does-not-exist.mjs`",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /scripts\/lib\/does-not-exist\.mjs which does not exist/);
});

test("PASSES: a reference to an existing script path", () => {
  const files = [
    {
      file: ".claude/rules/quality-gates.md",
      content: "The check is in `scripts/check-docs-accuracy.mjs` here.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 0);
});

test("FLAGS: multiple violations in the same file", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "`scripts/lib/does-not-exist.mjs` and `scripts/fake/path.mjs`",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 2);
});

test("PASSES: a reference to a removed script that is exempted", () => {
  const files = [
    {
      file: "docs/ADR/0016-example.md",
      content: "The one-shot `scripts/rename-scope.mjs` (since removed) was used.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 0, "Exempted removed scripts must not flag");
});

// ── SCRIPT PATHS: nested/prefixed paths (round-2 fix for #32) ──────────────────
//
// A prior version of this matcher had a negative lookbehind that excluded any
// `scripts/` occurrence preceded by another path segment, so it could never
// see a NESTED path at all — correct or not. That let a doubled-prefix
// regression (`packages/tokens/packages/tokens/scripts/...`) ship green. These
// cases lock the fix: a nested path is now actually validated, in both
// directions (fabricated → fails, correct → passes), not just assumed clean.

test("FLAGS: a fabricated BARE broken path (scripts/does-not-exist.mjs)", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "See `scripts/does-not-exist.mjs` for details.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /scripts\/does-not-exist\.mjs which does not exist/);
});

test("FLAGS: a fabricated NESTED broken path (packages/tokens/scripts/does-not-exist.mjs) — the case the old matcher missed", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "See `packages/tokens/scripts/does-not-exist.mjs` for details.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /packages\/tokens\/scripts\/does-not-exist\.mjs which does not exist/,
  );
});

test("FLAGS: a doubled-prefix nested path (the exact #32 round-1 regression shape)", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "`packages/tokens/packages/tokens/scripts/gen-theme-token-names.mjs` derives it.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /packages\/tokens\/packages\/tokens\/scripts\/gen-theme-token-names\.mjs which does not exist/,
  );
});

test("PASSES: a correct NESTED path (packages/tokens/scripts/gen-theme-token-names.mjs)", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "`packages/tokens/scripts/gen-theme-token-names.mjs` derives it from the theme.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 0);
});

test("PASSES: a correct dotdir-prefixed path (.claude/scripts/arch-evidence-pack.mjs)", () => {
  const files = [
    {
      file: "docs/example.md",
      content: "The evidence pack is built by `.claude/scripts/arch-evidence-pack.mjs`.",
    },
  ];
  const violations = findScriptPathViolations(files);
  assert.equal(violations.length, 0);
});

// ── CLI: the REAL repo currently passes the gate ────────────────────────────────

test("the REAL repo currently passes docs:check (CLI run)", () => {
  const out = execFileSync("node", [path.join(HERE, "check-docs-accuracy.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ docs-accuracy/);
  assert.match(out, /version literals/);
  assert.match(out, /release-set counts/);
  assert.match(out, /dual-canvas decision consistent/);
});
