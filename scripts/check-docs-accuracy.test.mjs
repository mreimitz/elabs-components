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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  findVersionLiteralViolations,
  VERSION_LITERAL_EXEMPT,
  findCiContractViolations,
  findDualCanvasViolations,
  findReleaseCountViolations,
  findThemeCountViolations,
  isSkippedWalkDir,
  stripEmphasis,
  themeCountFromSource,
  THEME_COUNT_EXEMPT_PREFIXES,
  WALK_SKIP_DIRS,
  findCliPreconditionViolations,
  collectCliPreconditionFiles,
  scanCliPreconditions,
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
  const text = '"@elabs/components-ui": "file:vendor/brand-ui/brand-ui-9.9.9.tgz",';
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

test("FLAGS: @elabs/components-x@N.N.N package pin mismatching the current version", () => {
  const text =
    "cross-package peers (`@elabs/components-ui -> @elabs/components-tokens@9.9.9`, etc.)";
  const violations = findVersionLiteralViolations(text, CURRENT);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, "@elabs/components-tokens@9.9.9");
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
    '"@elabs/components-ui": "file:vendor/brand-ui/brand-ui-X.Y.Z.tgz",',
    "brand-ui-agent-kit-X.Y.Z.zip",
    "@elabs/components-tokens@X.Y.Z",
  ].join("\n");
  assert.deepEqual(findVersionLiteralViolations(text, CURRENT), []);
});

// ── PASSES: a literal equal to the current version ─────────────────────────────

test("PASSES: a literal EQUAL to the current version", () => {
  const text = [
    `gh release download v${CURRENT} -R mreimitz/elabs-components -D vendor/brand-ui`,
    `"@elabs/components-ui": "file:vendor/brand-ui/brand-ui-${CURRENT}.tgz",`,
    `brand-ui-agent-kit-${CURRENT}.zip`,
    `@elabs/components-tokens@${CURRENT}`,
  ].join("\n");
  assert.deepEqual(findVersionLiteralViolations(text, CURRENT), []);
});

// ── Exemption set ───────────────────────────────────────────────────────────────

test("VERSION_LITERAL_EXEMPT names docs/RELEASING.md (worked-example literals)", () => {
  assert.ok(VERSION_LITERAL_EXEMPT.has("docs/RELEASING.md"));
});

// ── DUAL-CANVAS DECISION (#183) — @elabs/components-ai vs @elabs/components-flow ────────

// The real row always includes `chat → @elabs/components-ai` — a naive "does the
// line contain -ai anywhere" check would always pass because of THAT clause, even
// with single-surface canvas routing. These fixtures include the chat clause so
// the test actually exercises that trap.
const GOOD_D3_LINE =
  "| **D3** | Which package | chat → `@elabs/components-ai` · " +
  "canvas → `@elabs/components-flow` (author-built diagrams) · " +
  "in-chat agent workspace graph → `@elabs/components-ai` (ADR 0018) | detail |";
const SINGLE_SURFACE_D3_LINE =
  "| **D3** | Which package | chat → `@elabs/components-ai` · " +
  "canvas → `@elabs/components-flow` | detail |";
const GOOD_ADR_TITLES = [
  "# ADR 0018 — Dual React Flow canvas surfaces (`@elabs/components-ai` and `@elabs/components-flow`)",
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
  const src = 'export const THEMES = ["light", "dark", "blueprint"] as const;';
  assert.equal(themeCountFromSource(src), 3);
  assert.equal(themeCountFromSource('export const THEMES = ["a", "b"] as const;'), 2);
  assert.equal(themeCountFromSource("no themes here"), null);
});

test("FLAGS: the word form ('all six themes') the PR template carried for months", () => {
  const text = "- [ ] Works in all six themes (light, dark, light, dark, blueprint, high-contrast)";
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

// ── 6. CONSUMING-PROJECT CLI PRECONDITION (#265) ────────────────────────────────

test("FLAGS: a bare npx @elabs/components-cli line with no precondition anywhere in the file", () => {
  const text = ["# Some skill", "", "Run `npx @elabs/components-cli info` first."].join("\n");
  const violations = findCliPreconditionViolations(text);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 3);
});

test("PASSES: the same bare line, plus a docs/CONSUMING.md precondition cue in the file", () => {
  const text = [
    "# Some skill",
    "",
    "Install the CLI first — see docs/CONSUMING.md §1 + §7a.",
    "",
    "Run `npx @elabs/components-cli info` first.",
  ].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("PASSES: the same bare line, plus a `.npmrc`/`read:packages`/`pnpm add -D` cue", () => {
  for (const cue of [
    "Add the scope mapping to your project's .npmrc.",
    "Use a classic PAT with the read:packages scope.",
    "This package is published to GitHub Packages.",
    "Run `pnpm add -D @elabs/components-cli` first.",
  ]) {
    const text = [cue, "", "npx @elabs/components-cli search <query>"].join("\n");
    assert.deepEqual(findCliPreconditionViolations(text), [], `cue: ${cue}`);
  }
});

test("PASSES: an `allowed-tools:` frontmatter line only — a permission, not an instruction", () => {
  const text = [
    "---",
    "name: some-skill",
    "allowed-tools:",
    "  - Bash(npx @elabs/components-cli *)",
    "  - Bash(pnpm brand-ui *)",
    "---",
    "",
    "# Some skill",
    "",
    "No bare CLI example here.",
  ].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("FLAGS: a bare npx line AFTER an allowed-tools frontmatter block with no other precondition", () => {
  const text = [
    "---",
    "name: some-skill",
    "allowed-tools:",
    "  - Bash(npx @elabs/components-cli *)",
    "---",
    "",
    "Run `npx @elabs/components-cli info` to get started.",
  ].join("\n");
  const violations = findCliPreconditionViolations(text);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 7);
});

test("PASSES: an mcp launch-wiring line (npx ... mcp) is not a usage example", () => {
  const text = ["printf '...' | npx @elabs/components-cli mcp"].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test('PASSES: the JSON .mcp.json wiring form (args array ending in "mcp")', () => {
  const text = [
    '"brand-ui": {',
    '  "type": "stdio",',
    '  "command": "npx",',
    '  "args": ["-y", "@elabs/components-cli", "mcp"]',
    "}",
  ].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("PASSES: a file with no CLI mention at all", () => {
  assert.deepEqual(findCliPreconditionViolations("# Just some prose.\n"), []);
});

// ── 6b. The `brand-ui` BIN-ALIAS form (#265 AC4 names it explicitly) ────────────
// `npx brand-ui <cmd>` 404s identically to the scoped name and is pre-authorized
// in several skills' `allowed-tools`, so the detector must match it too.

test("FLAGS: a bare `npx brand-ui info` alias line with no precondition anywhere in the file", () => {
  const text = ["# Some skill", "", "Run `npx brand-ui info` first."].join("\n");
  const violations = findCliPreconditionViolations(text);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 3);
});

test("FLAGS: `npx -y brand-ui audit <path>` (the -y alias form)", () => {
  assert.equal(findCliPreconditionViolations("npx -y brand-ui audit src/").length, 1);
});

test("PASSES: the alias line plus a precondition cue in the same file", () => {
  const text = [
    "The CLI is a private GitHub Packages dependency — install it first.",
    "",
    "Run `npx brand-ui info` first.",
  ].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("PASSES: an alias mcp launch-wiring line (`npx -y brand-ui mcp`)", () => {
  const text = "claude mcp add brand-ui --scope project -- npx -y brand-ui mcp";
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("PASSES: an `allowed-tools:` frontmatter line for the alias — a permission, not an instruction", () => {
  const text = [
    "---",
    "name: brand-ui-audit",
    "allowed-tools:",
    "  - Bash(npx @elabs/components-cli *)",
    "  - Bash(pnpm brand-ui *)",
    "  - Bash(npx brand-ui *)",
    "---",
    "",
    "# brand-ui-audit",
    "",
    "Run `brand-ui info` once (no bare npx here).",
  ].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

test("PASSES: the monorepo runner form (`pnpm brand-ui …` / `pnpm exec brand-ui …`) is never flagged", () => {
  const text = ["pnpm brand-ui info", "pnpm exec brand-ui docs Button"].join("\n");
  assert.deepEqual(findCliPreconditionViolations(text), []);
});

// ── 6c. SCOPE: rule 6 covers docs/ + agents/ too, not just skills/ + stories/ ────
// #265's Test-to-add requires "skills/**, apps/docs/stories/**, plus existing
// docs/**"; AC2 additionally names `*/agents/**`. Planted end-to-end on a temp
// root so the scope can't silently narrow again.

function plantTree() {
  const root = mkdtempSync(path.join(tmpdir(), "docs-accuracy-scope-"));
  const bare = "# Fixture\n\nRun `npx @elabs/components-cli info` first.\n";
  const bareAlias = "# Fixture\n\nRun `npx brand-ui info` first.\n";
  const write = (rel, body) => {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
  };
  write("docs/__probe_docs__.md", bare);
  write("agents/__probe_agents__.md", bare);
  write(".claude/agents/__probe_claude_agents__.md", bareAlias);
  write("skills/__probe_skill__/SKILL.md", bareAlias);
  write("apps/docs/stories/__probe_story__.mdx", bare);
  // OUT of scope: design notes may quote historical state (see the module header).
  write("research/__probe_research__.md", bare);
  return root;
}

test("FLAGS a bare CLI line planted under docs/, agents/, .claude/agents/, skills/ and stories/", () => {
  const root = plantTree();
  try {
    const found = scanCliPreconditions(root);
    for (const rel of [
      "docs/__probe_docs__.md",
      "agents/__probe_agents__.md",
      path.join(".claude", "agents", "__probe_claude_agents__.md"),
      path.join("skills", "__probe_skill__", "SKILL.md"),
      path.join("apps", "docs", "stories", "__probe_story__.mdx"),
    ]) {
      assert.ok(
        found.some((v) => v.startsWith(`${rel}:`)),
        `expected a violation for ${rel}, got: ${JSON.stringify(found)}`,
      );
    }
    assert.ok(
      !found.some((v) => v.startsWith("research/")),
      "research/ is intentionally out of scope",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the REAL repo's rule-6 scope includes docs/, agents/, .claude/agents/, skills/ and stories/", () => {
  const repoRoot = path.dirname(HERE);
  const rel = collectCliPreconditionFiles(repoRoot).map((f) => f.slice(repoRoot.length + 1));
  for (const prefix of [
    "docs/",
    "agents/",
    path.join(".claude", "agents") + path.sep,
    "skills/",
    path.join("apps", "docs", "stories") + path.sep,
  ]) {
    assert.ok(
      rel.some((f) => f.startsWith(prefix)),
      `rule-6 scope must include ${prefix} (got ${rel.length} files)`,
    );
  }
});

// ── CLI: the docs:check gate currently passes on the REAL tree ──────────────────

test("the REAL repo's docs/ + skills/ + agents/ + stories/ currently pass the CLI-precondition rule", () => {
  const out = execFileSync("node", [path.join(HERE, "check-docs-accuracy.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /consuming-project CLI preconditions/);
});
