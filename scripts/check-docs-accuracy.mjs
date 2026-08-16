#!/usr/bin/env node
/**
 * check-docs-accuracy.mjs — WP-01 #74 docs-truth guard.
 *
 * For an agent-first library, "read the docs, they're ground truth" is the value
 * proposition — a confident-but-wrong doc is worse than a missing one. This guard
 * fails CI (and runs locally via `pnpm docs:check`) when authoritative docs drift:
 *
 *   1. THEME COUNT — no prose may say "four/five/six themes" (all stale counts); the
 *      system ships (BUILT_IN_THEMES in theme-types.ts — paused themes excluded).
 *      Also: the PR template must enumerate all three themes, not a stale subset (#158).
 *   2. WORKFLOW REFS — every `.github/workflows/<x>.yml` a doc references must exist,
 *      so docs can't claim a CI that isn't there (the original C1/C5 gap).
 *   3. PACKAGE-DESCRIPTION COMPONENT NAMES (#154) — every component named in a
 *      `@elabs-ai/components-*` package-description line in CLAUDE.md / AGENTS.md must actually be
 *      exported (verified against `brand-ui.manifest.json`), so the always-on context
 *      layer can't mis-instruct an agent about a package's API (the MessageBubble/
 *      ToolCallCard/AgentStep drift). Known framework/proper nouns are ignored.
 *   4. CI GATE CONTRACT (#158) — every blocking `pnpm <gate>` step in
 *      `.github/workflows/ci.yml` must appear in AGENTS.md's "Validate before you
 *      finish" command contract, so the documented gate set can't lag the real one.
 *   5. VERSION LITERALS (#266) — a copy-paste install/release literal (`vN.N.N`,
 *      `-N.N.N.tgz`/`.zip`) in an authoritative doc must equal the CURRENT package
 *      version, or use the `vX.Y.Z` / `-X.Y.Z.tgz` placeholder convention
 *      (`apps/docs/stories/GettingStarted.mdx`) — never a stale pinned version that
 *      silently drifts at the next release. `docs/RELEASING.md` is exempt (its
 *      literals are a worked example of the release procedure itself, not a
 *      copy-paste install target).
 *   6. DUAL-CANVAS DECISION (#183) — prose must not send an in-chat agent
 *      workspace graph to the flow package (ADR 0018).
 *   7. RELEASE-SET COUNTS (#295) — docs/RELEASING.md's "all N lockstep sites" /
 *      "the N component packages" prose is compared against the DERIVED sets
 *      (`versionSites()` / `distributablePackages()`), so the runbook's counts
 *      cannot drift from the packages that actually ship. The pack loop stopped
 *      being a hand-kept literal in #295; these counts were the last one left.
 *
 * RETIRED — rule 8, CONSUMING-PROJECT CLI PRECONDITION (#265). It required every
 * consuming-project `npx @elabs-ai/components-cli <cmd>` / `npx brand-ui <cmd>`
 * example to be paired with an install precondition, because the CLI was a
 * PRIVATE GitHub Packages dependency that 404s without a scope mapping and a
 * `read:packages` token. Since ADR 0030 the packages are PUBLIC on npmjs.org, so
 * a bare `npx` is turnkey and the precondition it demanded no longer exists —
 * keeping the rule would have forced docs to state a falsehood to stay green.
 * Restore it (git history) if the packages ever go private again.
 *
 * Scope: the authoritative human/agent docs — NOT research/ (design notes may quote
 * historical state), and NOT the git-ignored generated per-harness skill mirrors.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { findRepoRoot } from "../packages/cli/lib/core.mjs";
import { collectGates } from "./lib/workflow-gates.mjs";
import { distributablePackages } from "./lib/distributables.mjs";
import { versionSites } from "./set-version.mjs";

const root = findRepoRoot(process.cwd()) ?? process.cwd();

// ---------------------------------------------------------------------------
// 5. VERSION LITERALS (#266)
// ---------------------------------------------------------------------------
// A concrete `vN.N.N` / `-N.N.N.tgz` / `-N.N.N.zip` / `@elabs-ai/components-x@N.N.N` literal in
// a copy-paste doc must match the CURRENT release, or use the `X.Y.Z` placeholder
// form. The package-pin form is scoped to `@elabs-ai/components-*` specifically (not every
// `pkg@N.N.N` in the doc) so a third-party dependency's pinned version can't be
// mistaken for a brand-ui release drift. Pure, exported for the self-test
// (mirrors check-motion-tokens.mjs / check-raw-palette.mjs).
const VERSION_TAG_RE = /\bv(\d+\.\d+\.\d+)\b/g;
const VERSION_ARCHIVE_RE = /-(\d+\.\d+\.\d+)\.(?:tgz|zip)\b/g;
const VERSION_PKG_PIN_RE = /@elabs-ai\/components-[a-z0-9-]+@(\d+\.\d+\.\d+)\b/g;

// Docs whose version literals are a worked EXAMPLE of the release procedure
// itself (not a copy-paste install target) — exempt, mirroring PROSE_IGNORE/
// CONTRACT_EXEMPT above. Matched by path suffix, repo-root relative.
export const VERSION_LITERAL_EXEMPT = new Set(["docs/RELEASING.md", "CHANGELOG.md"]);

/**
 * Find version-literal lines in `text` that disagree with `currentVersion`.
 * Returns `{ line, match }[]` (1-based line numbers). A literal equal to
 * `currentVersion` is fine; the `vX.Y.Z` / `-X.Y.Z.tgz` placeholder never
 * matches the numeric regexes, so it always passes.
 */
export function findVersionLiteralViolations(text, currentVersion) {
  const violations = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(VERSION_TAG_RE)) {
      if (m[1] !== currentVersion) violations.push({ line: i + 1, match: m[0] });
    }
    for (const m of line.matchAll(VERSION_ARCHIVE_RE)) {
      if (m[1] !== currentVersion) violations.push({ line: i + 1, match: m[0] });
    }
    for (const m of line.matchAll(VERSION_PKG_PIN_RE)) {
      if (m[1] !== currentVersion) violations.push({ line: i + 1, match: m[0] });
    }
  });
  return violations;
}

/**
 * Directories the doc walk must NOT descend into, repo-root-relative with `/`
 * separators. These are the four GENERATED per-harness skill mirrors written by
 * `pnpm skills:build` and git-ignored (.gitignore lines 51-54) — the repo neither
 * tracks nor owns their content, and the canonical `skills/**` source they are
 * built from is scanned directly (rule 8), so scanning the mirror held generated
 * output to a stricter standard than its source. Exported for the self-test.
 */
export const WALK_SKIP_DIRS = new Set([
  ".cursor/skills",
  ".gemini/skills",
  ".agents/skills",
  ".github/skills",
]);

/** True when `dir` is one of the generated harness mirrors above. */
export function isSkippedWalkDir(root, dir) {
  return WALK_SKIP_DIRS.has(relative(root, dir).split(sep).join("/"));
}

function walk(dir, acc, exts = [".md"]) {
  let ents = [];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (isSkippedWalkDir(root, p)) continue;
      walk(p, acc, exts);
    } else if (exts.some((ext) => e.name.endsWith(ext))) acc.push(p);
  }
  return acc;
}

const existingFiles = (paths) => paths.filter((f) => existsSync(f) && statSync(f).isFile());

/** The authoritative human/agent docs — the scope of rules 1–5. */
function docFiles(rootDir) {
  return existingFiles([
    ...["README.md", "AGENTS.md", "CONTRIBUTING.md", "PROJECT.md"].map((f) => join(rootDir, f)),
    ...walk(join(rootDir, "docs"), []),
    ...walk(join(rootDir, ".claude", "rules"), []),
    // #64 — the PR template and the issue templates are authoritative docs too; the
    // PR checklist sat on "all six themes (…, light, dark, high-contrast)" long after
    // those themes were deleted. `research/` stays out (design notes quote history).
    ...walk(join(rootDir, ".github"), []),
  ]);
}

const files = docFiles(root);

const themeViolations = [];
const workflowViolations = [];
const versionViolations = [];
const workflowRe = /\.github\/workflows\/([A-Za-z0-9_-]+\.ya?ml)/g;

/**
 * The WORKFLOW REFS + CI-GATE-CONTRACT rules read `.github/workflows/`. They are
 * live again as of ADR 0030 (the fork has a remote, `ci.yml` and `gates.yml` are
 * back) — this guard is what kept them honest while the directory was absent
 * (ADR 0028): with no workflow layer there is nothing for a doc to be stale
 * against, and the rules would only have reported the same accurate-for-upstream
 * references. Every other arm is CI-independent and stays live either way.
 *
 * Deleting `.github/workflows/` disarms these two automatically — no flag to
 * remember, and no false red.
 */
const workflowsPresent = existsSync(join(root, ".github", "workflows"));

// The count is DERIVED from packages/tokens/src/theme-types.ts, not hard-coded, so
// adding or removing a theme changes what the docs are allowed to claim (#64).
const themeTypesPath = join(root, "packages", "tokens", "src", "theme-types.ts");
export function themeNamesFromSource(text) {
  const m = text.match(/export const BUILT_IN_THEMES\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const names = [...m[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((x) => x[1] ?? x[2]);
  return names.length ? names : null;
}

export function themeCountFromSource(text) {
  return themeNamesFromSource(text)?.length ?? null;
}
// The NAMES are derived too, not hard-coded: a theme that is paused
// (@.claude/rules/paused-surfaces.md) leaves BUILT_IN_THEMES, and the docs must stop
// naming it in the same move — otherwise this gate would demand the docs
// enumerate a theme nothing tests any more.
const THEME_NAMES = existsSync(themeTypesPath)
  ? themeNamesFromSource(readFileSync(themeTypesPath, "utf8"))
  : null;
const THEME_COUNT = THEME_NAMES?.length ?? null;
const THEME_LIST = (THEME_NAMES ?? []).join(", ");

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/**
 * Lines claiming a theme COUNT that disagrees with `themeCount`. Handles both the
 * word form ("all six themes") and the numeric form ("6 themes"). Pure — exported
 * for the self-test.
 */
export function findThemeCountViolations(text, themeCount) {
  if (!themeCount) return [];
  const re = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")}|\\d+)\\s+themes\\b`, "gi");
  const out = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      const token = m[1].toLowerCase();
      const claimed = NUMBER_WORDS[token] ?? Number(token);
      if (Number.isFinite(claimed) && claimed !== themeCount) {
        out.push({ line: i + 1, match: m[0], claimed });
      }
    }
  });
  return out;
}

/**
 * ADRs are DATED decision records: an ADR that measured "4 of 6 themes" in 2026-06
 * is accurate about that date and must not be rewritten to match today's palette.
 * Same rationale as excluding `research/`. Everything else must state the count
 * that ships now.
 */
export const THEME_COUNT_EXEMPT_PREFIXES = ["docs/ADR/"];

const pkgJsonPath = join(root, "package.json");
const currentVersion = existsSync(pkgJsonPath)
  ? JSON.parse(readFileSync(pkgJsonPath, "utf8")).version
  : null;

for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = f.slice(root.length + 1);
  if (!THEME_COUNT_EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) {
    for (const v of findThemeCountViolations(text, THEME_COUNT)) {
      themeViolations.push(`${rel}:${v.line}: claims "${v.match}"`);
    }
  }
  if (workflowsPresent) {
    for (const m of text.matchAll(workflowRe)) {
      const wf = join(root, ".github", "workflows", m[1]);
      if (!existsSync(wf))
        workflowViolations.push(
          `${rel}: references .github/workflows/${m[1]} which does not exist`,
        );
    }
  }
  if (currentVersion && !VERSION_LITERAL_EXEMPT.has(rel)) {
    for (const v of findVersionLiteralViolations(text, currentVersion)) {
      versionViolations.push(
        `${rel}:${v.line}: "${v.match}" (current release is ${currentVersion})`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. PACKAGE-DESCRIPTION COMPONENT NAMES (#154)
// ---------------------------------------------------------------------------
// Every PascalCase identifier presented as a component in a `@elabs-ai/components-*`
// package-description line (CLAUDE.md / AGENTS.md) must exist as an export in the
// manifest. We check against the UNION of all package exports (a name moved
// between packages is still real), and ignore a curated set of framework /
// proper-noun / generic-English tokens that legitimately appear in these lines.
const phantomViolations = [];

// Known non-component tokens that appear in package-description prose. A capitalized
// word here is NOT treated as a component. Keep this list tight — when the gate
// flags a legitimate non-component noun, add it here (not to the docs).
const PROSE_IGNORE = new Set([
  // Frameworks / libraries / tools
  "TanStack",
  "React",
  "Flow",
  "MapLibre",
  "GeoJSON",
  "Monaco",
  "Lucide",
  "Vite",
  "Storybook",
  "Playwright",
  "ESLint",
  "Radix",
  "Tailwind",
  "Shiki",
  "Streamdown",
  "Milkdown",
  // File-parser libraries and format names named in @elabs-ai/components-viewer
  // prose (ADR 0024) — none of these are components.
  "SheetJS",
  "DOMPurify",
  "PDF",
  "DOCX",
  "XLSX",
  "PPTX",
  "CSV",
  "JSON",
  "MIME",
  // Proper nouns / acronyms / file-format words
  "VS",
  "Code", // "VS Code" — not the CodeBlock/CodeEditor components (those resolve anyway)
  "CSS",
  "KPI",
  "UI",
  "Brand",
  "Chat",
  // Protocol / spec names that appear in the generated decision summary (D2), not components.
  "A2UI",
  "UIMessage", // the AI SDK message-model TYPE (D2), not a brand-ui component
  "ToolUIPart", // the AI SDK tool-part TYPE, not a brand-ui component
  // Generic capitalized English that opens a clause
  "Foundation",
  "Generic",
  "Landing",
  "Semantic",
  "Decorative",
  "Placement",
  "Shared",
  "Token",
  "Area", // chart-axis prose — Area/Bar/Line/Pie/Scatter resolve as components anyway
]);

function manifestExportNames() {
  const mPath = join(root, "brand-ui.manifest.json");
  if (!existsSync(mPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(mPath, "utf8"));
  } catch {
    return null;
  }
  const names = new Set();
  for (const pkg of Object.values(manifest.packages ?? {})) {
    for (const group of ["components", "hooks", "types"]) {
      for (const e of pkg[group] ?? []) if (e?.name) names.add(e.name);
    }
    for (const n of pkg.otherExports ?? []) names.add(n);
  }
  return names;
}

const exportNames = manifestExportNames();
// A line is a package-description line iff it names a `@elabs-ai/components-<pkg>` package AND is
// a list item or table row (the package list in CLAUDE.md / AGENTS.md) — not an
// arbitrary prose mention elsewhere in the file.
const pkgLineRe = /`@elabs-ai\/components-[a-z]+`/;
// Candidate component token: PascalCase (≥2 segments OR a known component shape).
const compTokenRe = /\b([A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+)\b/g;

if (exportNames) {
  for (const fname of ["CLAUDE.md", "AGENTS.md"]) {
    const f = join(root, fname);
    if (!existsSync(f)) continue;
    const text = readFileSync(f, "utf8");
    text.split("\n").forEach((line, i) => {
      if (!pkgLineRe.test(line)) return;
      // Strip code spans (`...`), markdown links, and parenthetical file refs so we
      // don't read identifiers out of `@elabs-ai/components-*`, `lucide-react`, paths, etc.
      const prose = line
        .replace(/`[^`]*`/g, " ")
        .replace(/\([^)]*\.[a-z]+[^)]*\)/g, " ") // (foo.md) style refs
        .replace(/https?:\/\/\S+/g, " ");
      for (const m of prose.matchAll(compTokenRe)) {
        const name = m[1];
        if (PROSE_IGNORE.has(name)) continue;
        if (!exportNames.has(name)) {
          phantomViolations.push(
            `${fname}:${i + 1}: "${name}" is named as a component but is not exported (not in brand-ui.manifest.json)`,
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 4. PR TEMPLATE THEME ENUMERATION (#158)
// ---------------------------------------------------------------------------
// The PR checklist asserts theme coverage; it must enumerate every ACTIVE
// shipped theme (BUILT_IN_THEMES in theme-types.ts), not a stale subset (#158).
const prTemplateViolations = [];
const prTemplate = join(root, ".github", "PULL_REQUEST_TEMPLATE.md");
if (existsSync(prTemplate)) {
  const text = readFileSync(prTemplate, "utf8");
  const themeNames = THEME_NAMES ?? [];
  text.split("\n").forEach((line, i) => {
    // Only inspect a line that is clearly a theme-coverage assertion.
    if (/works in .*theme/i.test(line)) {
      const missing = themeNames.filter((t) => !line.toLowerCase().includes(t));
      if (missing.length) {
        prTemplateViolations.push(
          `.github/PULL_REQUEST_TEMPLATE.md:${i + 1}: theme-coverage line omits ${missing.join(", ")} (must name every active theme: ${THEME_LIST})`,
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 5. CI GATE CONTRACT — AGENTS.md ↔ ci.yml (#158)
// ---------------------------------------------------------------------------
// Every blocking `pnpm <gate>` step in ci.yml must be documented in AGENTS.md's
// "Validate before you finish" command contract, so an agent following the contract
// runs the same gates CI does.
//
// The gate list now lives in the reusable `.github/workflows/gates.yml` that both
// ci.yml and release.yml call (#103), so this resolves through the `workflow_call`
// rather than reading ci.yml's steps directly — otherwise the contract check would
// pass VACUOUSLY (a gates job with a single `uses:` line runs no `pnpm` steps at
// all). Non-blocking jobs (`continue-on-error: true`) are excluded by collectGates.
// Gates that are intentionally NOT part of the per-change agent contract:
// self-tests of a gate, and non-gate housekeeping steps.
export const CONTRACT_EXEMPT = new Set([
  "install",
  "ai:types-only:test", // self-test of ai:types-only
  "charts:reuse:check:test", // self-test of charts:reuse:check
  "charts:test-double:check:test", // self-test of charts:test-double:check
  "agents:check:test", // self-test of agents:check
  "rules:scoping:check:test", // self-test of rules:scoping:check
  "gen:check:test", // self-test of gen:check
  "dispatch:check:test", // self-test of the post-edit hook-dispatch routing (no runtime gate)
  "docs:check:test", // self-test of docs:check (#266)
  "format:check:test", // self-test of format:check (#239)
  "release-gates:check:test", // self-test of release-gates:check (#103)
  "release:snapshot:test", // self-test of the derived release snapshot (#105/#295)
  "release-report:test", // self-test of the stored validation report (#103/#71)
  "release:smoke:test", // self-test of the post-release fresh-install smoke (#106/#71)
  "changelog:check:test", // self-test of changelog:check — the gate itself is
  // release-path-only (a feature branch correctly has no `## v<next>` heading)
  // Building the Storybook static site is a step OF the interaction-test job, not
  // a per-change agent gate — the contract already carries root `pnpm build` and
  // `pnpm --filter …-docs test-storybook` (the check that job actually enforces).
  "--filter @elabs-ai/components-docs build",
]);

/** Escape a gate identity for a literal regex match, with flexible whitespace. */
function gateToRegex(gate) {
  const escaped = gate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`pnpm\\s+${escaped}(?![A-Za-z0-9:_-])`);
}

/**
 * The AGENTS.md ↔ ci.yml gate contract. Pure — exported so the self-test can
 * plant the two failure shapes this rung exists for: a gate missing from the
 * contract, and a ZERO-gate resolution (a renamed/unreadable reusable workflow),
 * which would otherwise green-light everything by checking nothing.
 *
 * `readWorkflow(relPath)` resolves a local reusable workflow's text, or null.
 */
export function findCiContractViolations({ ciText, agentsText, readWorkflow = () => null }) {
  const violations = [];
  const ciGates = new Set();
  for (const gate of collectGates(ciText, { readWorkflow })) {
    if (CONTRACT_EXEMPT.has(gate)) continue;
    ciGates.add(gate);
  }
  if (ciGates.size === 0) {
    violations.push(
      ".github/workflows/ci.yml: resolved ZERO blocking gates — the CI-gate contract " +
        "would pass vacuously. Check that the gates job still runs `pnpm <gate>` steps " +
        "(directly, or via a reusable workflow this script can read).",
    );
    return violations;
  }
  for (const gate of ciGates) {
    // The contract names the gate if AGENTS.md contains `pnpm <gate>` (the contract
    // lists them as `pnpm <gate>` in the fenced command block).
    if (!gateToRegex(gate).test(agentsText)) {
      violations.push(
        `AGENTS.md: blocking CI gate \`pnpm ${gate}\` (in ci.yml) is missing from the "Validate before you finish" contract`,
      );
    }
  }
  return violations;
}

let ciContractViolations = [];
const ciYml = join(root, ".github", "workflows", "ci.yml");
const agentsMd = join(root, "AGENTS.md");
if (existsSync(ciYml) && existsSync(agentsMd)) {
  ciContractViolations = findCiContractViolations({
    ciText: readFileSync(ciYml, "utf8"),
    agentsText: readFileSync(agentsMd, "utf8"),
    readWorkflow: (rel) =>
      existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null,
  });
}

// ---------------------------------------------------------------------------
// 6. DUAL-CANVAS DECISION (#183) — @elabs-ai/components-ai vs @elabs-ai/components-flow
// ---------------------------------------------------------------------------
// Both `@elabs-ai/components-ai` and `@elabs-ai/components-flow` wrap `@xyflow/react`
// as two intentionally distinct canvas surfaces (ADR 0018). Guard that the decision
// stays recorded: (a) an ADR whose title names the dual-canvas decision exists, and
// (b) the docs/DECISIONS.md D3 routing row names BOTH `-flow` and `-ai` for canvas —
// so the record can't silently regress to a single-surface description while the
// second package still ships. Pure, exported for the self-test.
export function findDualCanvasViolations({ adrTitles, decisionsMdText }) {
  const violations = [];
  const hasDualCanvasAdr = adrTitles.some((t) => /dual|two/i.test(t) && /canvas/i.test(t));
  if (!hasDualCanvasAdr) {
    violations.push(
      "docs/ADR/: no ADR title matches /dual|two/i AND /canvas/i (the @elabs-ai/components-ai vs " +
        "@elabs-ai/components-flow dual-canvas decision must be recorded — see issue #183)",
    );
  }
  const d3Line = decisionsMdText.split("\n").find((l) => /^\|\s*\*\*D3\*\*/.test(l));
  if (!d3Line) {
    violations.push("docs/DECISIONS.md: could not find the D3 row to check canvas routing");
  } else {
    // The D3 cell is a `·`-joined list of "topic → package" clauses, and one of
    // them is always `chat → `@elabs-ai/components-ai`` — so naively checking the whole
    // line for `-ai` is always true regardless of canvas routing. Drop the chat
    // clause before checking, so the remaining text must independently name both
    // `-flow` (canvas) and `-ai` (the in-chat agent workspace graph, ADR 0018).
    //
    // Match the PACKAGE suffix (`components-ai`), never the bare `-ai`: the npm
    // scope is `@elabs-ai`, so a bare `/-ai\b/` is satisfied by *any* package
    // name and the rule would pass vacuously — it did, the moment the scope was
    // renamed from `@elabs` (the self-test caught it).
    const rest = d3Line
      .split("·")
      .filter((clause) => !/\bchat\s*→/i.test(clause))
      .join(" · ");
    if (!/components-flow\b/.test(rest) || !/components-ai\b/.test(rest)) {
      violations.push(
        `docs/DECISIONS.md: D3 row's canvas routing must name BOTH \`-flow\` and \`-ai\` (found: ${d3Line.trim()})`,
      );
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// 7. RELEASE-SET COUNTS — docs/RELEASING.md ↔ the derived sets (#295)
// ---------------------------------------------------------------------------
// #295 killed the hand-kept pack loop, but the runbook's PROSE counts stayed
// hand-kept: "all 16 lockstep sites", "the 11 component packages". Those are the
// same convention-without-teeth, one abstraction up — they drift the day a
// package is added, and a reader trusts them. Both are now derived and gated.
//
// The counts come from the same modules the release machinery uses:
//   lockstep sites    → versionSites()          (set-version.mjs — the only writer)
//   component pkgs    → distributablePackages() minus the CLI
//   published pkgs    → distributablePackages() (the component packages + the CLI)
// Markdown emphasis is stripped BEFORE matching. The runbook writes its most
// load-bearing counts in bold — "all **16** lockstep sites" — and `\d+\s+lockstep`
// cannot match across the `**`, so the two literals #295 singles out were the only
// ones the rung could not see. Mutating them to `**17**` / `**all 99**` left
// `pnpm docs:check` GREEN. Normalising the line (and keeping its ORIGINAL number,
// which is all the report cites) closes it for every rung at once.
// Pure — exported for the self-test.

/** A doc line with markdown emphasis/code markers removed. Pure. */
export function stripEmphasis(line) {
  return String(line).replace(/[*_`]/g, "");
}

export function findReleaseCountViolations(
  text,
  { lockstepSites, componentPackages, publishedPackages },
) {
  const rungs = [
    [/\b(\d+)\s+lockstep sites?\b/g, lockstepSites],
    [/\b(\d+)\s+component packages?\b/g, componentPackages],
    // Bare "N packages" — digits directly before the noun, so "11 component
    // packages" / "11 publishable packages" are matched by their own rung, not
    // twice. Anything with a qualifier in between is deliberately not claimed.
    [/\b(\d+)\s+packages?\b/g, publishedPackages],
  ];
  const out = [];
  text.split("\n").forEach((rawLine, i) => {
    const line = stripEmphasis(rawLine);
    for (const [re, expected] of rungs) {
      if (!Number.isFinite(expected)) continue;
      for (const m of line.matchAll(re)) {
        if (Number(m[1]) !== expected) {
          out.push({ line: i + 1, match: m[0], claimed: Number(m[1]), expected });
        }
      }
    }
  });
  return out;
}

const releaseCountViolations = [];
const releasingMd = join(root, "docs", "RELEASING.md");
if (existsSync(releasingMd)) {
  // The CLI is distributable but is not a "component package" — the runbook's
  // phrasing is "the N component packages, the CLI, …".
  const distributables = distributablePackages(root);
  const expected = {
    lockstepSites: versionSites(root).length,
    componentPackages: distributables.filter((p) => !/-cli$/.test(p.name)).length,
    publishedPackages: distributables.length,
  };
  for (const v of findReleaseCountViolations(readFileSync(releasingMd, "utf8"), expected)) {
    releaseCountViolations.push(
      `docs/RELEASING.md:${v.line}: claims "${v.match}" — the derived set has ${v.expected}`,
    );
  }
}

const adrDirPath = join(root, "docs", "ADR");
const adrTitles = existsSync(adrDirPath)
  ? readdirSync(adrDirPath)
      .filter((f) => f.endsWith(".md"))
      .map((f) => readFileSync(join(adrDirPath, f), "utf8").split("\n")[0] ?? "")
  : [];
const decisionsMdPath = join(root, "docs", "DECISIONS.md");
const decisionsMdText = existsSync(decisionsMdPath) ? readFileSync(decisionsMdPath, "utf8") : "";
const dualCanvasViolations = findDualCanvasViolations({ adrTitles, decisionsMdText });

let failed = false;
if (themeViolations.length) {
  failed = true;
  console.error(
    `✖ stale theme count — packages/tokens/src/theme-types.ts ships ${THEME_COUNT} theme(s) ` +
      `(${themeViolations.length} violation(s)):`,
  );
  for (const v of themeViolations) console.error("  - " + v);
  console.error(
    `  Fix: state ${THEME_COUNT} themes and list ${THEME_LIST}. The count is\n` +
      "  derived from BUILT_IN_THEMES in theme-types.ts — if a theme was genuinely added/removed, that is\n" +
      "  where it changes first.",
  );
}
if (workflowViolations.length) {
  failed = true;
  console.error(`\n✖ doc references a non-existent workflow (${workflowViolations.length}):`);
  for (const v of workflowViolations) console.error("  - " + v);
  console.error("  Fix: create the workflow or correct the reference.");
}
if (phantomViolations.length) {
  failed = true;
  console.error(
    `\n✖ phantom component in a @elabs-ai/components-* package description (${phantomViolations.length}):`,
  );
  for (const v of phantomViolations) console.error("  - " + v);
  console.error(
    "  Fix: name a REAL export (see `pnpm manifest` / brand-ui.manifest.json), or — if it IS a\n" +
      "  framework/proper noun, not a component — add it to PROSE_IGNORE in this script.",
  );
}
if (prTemplateViolations.length) {
  failed = true;
  console.error(
    `\n✖ PR template theme-coverage line is incomplete (${prTemplateViolations.length}):`,
  );
  for (const v of prTemplateViolations) console.error("  - " + v);
  console.error(`  Fix: enumerate every active theme (${THEME_LIST}).`);
}
if (ciContractViolations.length) {
  failed = true;
  console.error(
    `\n✖ AGENTS.md command contract omits a blocking CI gate (${ciContractViolations.length}):`,
  );
  for (const v of ciContractViolations) console.error("  - " + v);
  console.error(
    '  Fix: add the missing `pnpm <gate>` to AGENTS.md\'s "Validate before you finish" contract,\n' +
      "  or — if a ci.yml step is genuinely not part of the per-change contract — add it to\n" +
      "  CONTRACT_EXEMPT in this script.",
  );
}
if (versionViolations.length) {
  failed = true;
  console.error(
    `\n✖ stale version literal — current release is ${currentVersion} (${versionViolations.length}):`,
  );
  for (const v of versionViolations) console.error("  - " + v);
  console.error(
    `  Fix: use the current version (${currentVersion}) or the \`vX.Y.Z\`/\`-X.Y.Z.tgz\` placeholder,\n` +
      "  or — if this literal is a worked EXAMPLE of the release procedure, not a copy-paste\n" +
      "  install target — add the doc's repo-relative path to VERSION_LITERAL_EXEMPT in this script.",
  );
}
if (releaseCountViolations.length) {
  failed = true;
  console.error(
    `\n✖ docs/RELEASING.md states a release-set count that is not the derived one (${releaseCountViolations.length}):`,
  );
  for (const v of releaseCountViolations) console.error("  - " + v);
  console.error(
    "  Fix: state the derived number. The sets come from scripts/set-version.mjs\n" +
      "  (versionSites) and scripts/lib/distributables.mjs (distributablePackages) —\n" +
      "  if a package was genuinely added, that is where the count changes first.",
  );
}
if (dualCanvasViolations.length) {
  failed = true;
  console.error(
    `\n✖ dual-canvas decision (#183) is not recorded (${dualCanvasViolations.length}):`,
  );
  for (const v of dualCanvasViolations) console.error("  - " + v);
  console.error(
    "  Fix: keep docs/ADR/0018-dual-react-flow-canvas-surfaces.md (or an equivalent ADR whose\n" +
      "  title matches /dual|two/i AND /canvas/i), and keep docs/DECISIONS.md's D3 row naming\n" +
      "  BOTH `-flow` and `-ai` for canvas routing.",
  );
}
if (failed) process.exit(1);
console.log(
  `✔ docs-accuracy: theme count + ${workflowsPresent ? "workflow refs + " : ""}@elabs-ai/components-* component names + PR-template themes + ` +
    "CI-gate contract + version literals + release-set counts + dual-canvas decision consistent " +
    `(${files.length} docs scanned)` +
    `${workflowsPresent ? "" : ". NOTE: workflow-ref + CI-gate-contract rules SKIPPED — no .github/workflows"}.`,
);
