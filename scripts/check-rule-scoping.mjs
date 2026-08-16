#!/usr/bin/env node
/**
 * check-rule-scoping.mjs — rule-context-budget gate.
 *
 * `.claude/rules/*.md` are AUTO-DISCOVERED by Claude Code and loaded into the session
 * context. Loading ALL of them every session is a ~22 KB-token-per-turn tax, most of it
 * package-specific detail an agent only needs when it touches that package. Claude Code's
 * `paths:` frontmatter scopes a rule so it loads ONLY when a matching file is read/edited
 * (lazy). This gate keeps the always-on / path-scoped split from drifting back:
 *
 *   (a) Every rule designated PACKAGE-SCOPED must HAVE `paths:` frontmatter AND must NOT
 *       be `@`-imported by CLAUDE.md (an `@`-import force-loads it on every session,
 *       defeating the scoping).
 *   (b) Every CROSS-CUTTING rule must have NO `paths:` frontmatter (it must stay always-on
 *       — auto-discovery loads it; lazy-loading a cross-cutting rule would mean it's
 *       absent while the agent reasons before touching any file).
 *   (c) `architecture-review.md` must NOT be always-on (it is path-scoped — the repo
 *       intends it on-demand: "NOT a CLAUDE.md always-import — it must not tax every
 *       session"; the repo-architect-* agents Read it explicitly).
 *   (d) Every `.claude/rules/*.md` on disk is classified by exactly one list (no orphan
 *       rule escapes the budget), and no list names a rule that doesn't exist.
 *
 * The cross-cutting vs scoped lists are ENCODED here, so adding/renaming/moving a rule
 * without updating the classification fails CI.
 *
 * Run via `pnpm rules:scoping:check`; the self-test (`pnpm rules:scoping:check:test`)
 * plants bad fixtures and asserts the gate fails, so the gate itself can't silently rot.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; locates `.claude/rules` + CLAUDE.md relative to this file
 * (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root
const RULES_DIR = join(REPO_ROOT, ".claude", "rules");
const CLAUDE_MD = join(REPO_ROOT, "CLAUDE.md");

const WARN = process.argv.includes("--warn");

// ── The classification (the single source of truth for the split) ───────────
// Cross-cutting rules: load on EVERY session (no `paths:` frontmatter). These are
// the rules an agent needs BEFORE it touches any package file (philosophy, the
// component API contract, tokens/theming, a11y, the D1–D6 decision routing, the
// scope boundary, quality gates, the issue workflow, icons, Storybook MCP).
export const CROSS_CUTTING = [
  "design-system",
  "design-first",
  "component-api",
  "styling-and-tokens",
  "theming",
  "accessibility",
  "interaction-guidelines",
  "conceptual-framing",
  "quality-gates",
  "issue-workflow",
  "icons",
  "storybook-mcp",
  "decision-routing",
  "scope-and-non-goals",
  "loading-states",
  // What is on hold and must not be enumerated, tested, released or updated.
  // Always-on by necessity: an agent has to know a surface is paused BEFORE it
  // opens a file inside it or adds it to a sweep.
  "paused-surfaces",
];

// Package/area-scoped rules: MUST carry `paths:` frontmatter (lazy-loaded only when a
// matching file is touched) and MUST NOT be `@`-imported by CLAUDE.md.
export const PATH_SCOPED = [
  "chart-components",
  "editor-components",
  "react-flow-components",
  "map-components",
  "data-components",
  "ai-chat-components",
  "ai-sdk-vs-a2ui",
  "blueprint-decoration",
  "viewer-components",
  "registry",
  "architecture-review",
];

/** True if the rule text begins with YAML frontmatter that declares a non-empty `paths:` key. */
export function hasPathsFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  const body = m[1];
  // `paths:` as a YAML block (followed by `- ...` list items) or an inline array.
  const idx = body.search(/^paths\s*:/m);
  if (idx === -1) return false;
  const after = body
    .slice(idx)
    .replace(/^paths\s*:/m, "")
    .trimStart();
  if (after.startsWith("[")) {
    // inline array: paths: ["a/**", "b/**"]
    return /\[[^\]]*\S[^\]]*\]/.test(after.split(/\r?\n/)[0]);
  }
  // block list: the next non-blank, non-comment line is a `- ` item.
  for (const line of after.split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    return /^\s*-\s+\S/.test(line);
  }
  return false;
}

/** The set of rule basenames `@`-imported by CLAUDE.md (`@.claude/rules/<name>.md`). */
export function claudeMdImports(claudeText) {
  const names = new Set();
  for (const m of claudeText.matchAll(/^@\.claude\/rules\/([A-Za-z0-9_-]+)\.md\s*$/gm)) {
    names.add(m[1]);
  }
  return names;
}

/**
 * The rule basenames CLAUDE.md's prose NAMES as cross-cutting — the
 * "**Cross-cutting rules load on EVERY session**" bullet.
 *
 * This list is what a human (or an agent) reads to know what every session pays
 * for, and it drifted: the repo-cleanup audit (2026-08-02) found the prose naming
 * 13 of the 15 always-loaded rules, silently omitting `design-first` (2,674 B) and
 * `loading-states` (10,707 B) — 13,381 undocumented always-loaded bytes. The
 * CROSS_CUTTING list above was correct the whole time, so only the prose was wrong,
 * which is exactly the decay `.claude/rules/quality-gates.md` ("Enforcement over
 * reminders") says to gate rather than to remember.
 *
 * @param {string} claudeText
 * @returns {Set<string> | null} names, or null when the bullet is absent entirely
 */
export function crossCuttingProseNames(claudeText) {
  const start = claudeText.indexOf("**Cross-cutting rules load on EVERY session**");
  if (start === -1) return null;
  // The bullet runs until the next top-level list item or a blank-line + non-indented line.
  const rest = claudeText.slice(start);
  const end = rest.search(/\n- \*\*/);
  const span = end === -1 ? rest.split("\n\n")[0] : rest.slice(0, end);
  const names = new Set();
  for (const m of span.matchAll(/`([A-Za-z0-9_-]+)`/g)) names.add(m[1]);
  // `paths:` appears in the parenthetical ("no `paths:` frontmatter") — not a rule.
  names.delete("paths:");
  names.delete("paths");
  return names;
}

/**
 * Run the checks. Driven with in-memory fixtures by the self-test.
 *
 * @param {{ rules: { name: string, text: string }[], claudeImports: Set<string>,
 *           crossCutting?: string[], pathScoped?: string[],
 *           proseCrossCutting?: Set<string> | null }} input
 * @returns {string[]} findings (empty = pass)
 */
export function checkRuleScoping({
  rules,
  claudeImports,
  crossCutting = CROSS_CUTTING,
  pathScoped = PATH_SCOPED,
  proseCrossCutting = undefined,
}) {
  const findings = [];
  const cross = new Set(crossCutting);
  const scoped = new Set(pathScoped);
  const onDisk = new Set(rules.map((r) => r.name));
  const byName = new Map(rules.map((r) => [r.name, r.text]));

  // (d.1) lists may not overlap.
  for (const n of cross) {
    if (scoped.has(n))
      findings.push(`"${n}" is in BOTH the cross-cutting and path-scoped lists — pick one`);
  }
  // (d.2) every classified rule must exist on disk.
  for (const n of [...cross, ...scoped]) {
    if (!onDisk.has(n))
      findings.push(`"${n}" is classified but no .claude/rules/${n}.md exists on disk`);
  }
  // (d.3) every rule on disk must be classified (no orphan escapes the budget).
  for (const n of onDisk) {
    if (!cross.has(n) && !scoped.has(n))
      findings.push(
        `.claude/rules/${n}.md is not classified — add it to CROSS_CUTTING (always-on) ` +
          `or PATH_SCOPED (add \`paths:\` frontmatter) in scripts/check-rule-scoping.mjs`,
      );
  }

  // (a) path-scoped: HAS paths frontmatter + NOT @-imported.
  for (const n of scoped) {
    const text = byName.get(n);
    if (text == null) continue; // already reported as missing on disk
    if (!hasPathsFrontmatter(text))
      findings.push(
        `.claude/rules/${n}.md is path-scoped but has no \`paths:\` frontmatter — ` +
          `prepend a \`paths:\` block so Claude Code lazy-loads it`,
      );
    if (claudeImports.has(n))
      findings.push(
        `.claude/rules/${n}.md is path-scoped but is \`@\`-imported by CLAUDE.md ` +
          `(@.claude/rules/${n}.md) — an @-import force-loads it every session and defeats ` +
          `the scoping; remove the import`,
      );
  }

  // (b) cross-cutting: NO paths frontmatter.
  for (const n of cross) {
    const text = byName.get(n);
    if (text == null) continue;
    if (hasPathsFrontmatter(text))
      findings.push(
        `.claude/rules/${n}.md is cross-cutting (always-on) but has \`paths:\` frontmatter — ` +
          `lazy-loading a cross-cutting rule means it's absent while the agent reasons; ` +
          `remove the frontmatter`,
      );
  }

  // (c) architecture-review must not be always-on.
  if (cross.has("architecture-review"))
    findings.push(
      `architecture-review is in the CROSS_CUTTING list — it must be path-scoped ` +
        `(the repo intends it on-demand, not a per-session tax)`,
    );

  // (e) CLAUDE.md's prose must name exactly the cross-cutting set. `undefined`
  // means the caller did not supply the prose (a fixture-only run); `null` means
  // the bullet is missing from a CLAUDE.md that does exist, which IS a finding.
  if (proseCrossCutting !== undefined) {
    if (proseCrossCutting === null) {
      findings.push(
        `CLAUDE.md no longer contains the "**Cross-cutting rules load on EVERY session**" ` +
          `bullet — that list is how a reader learns what every session pays for; restore it`,
      );
    } else {
      for (const n of cross) {
        if (!proseCrossCutting.has(n))
          findings.push(
            `.claude/rules/${n}.md loads on EVERY session but CLAUDE.md's cross-cutting ` +
              `list does not name it — add \`${n}\` to that bullet (undocumented always-on cost)`,
          );
      }
      for (const n of proseCrossCutting) {
        if (!cross.has(n))
          findings.push(
            `CLAUDE.md's cross-cutting list names \`${n}\`, which is not in CROSS_CUTTING — ` +
              `the prose promises an always-on rule the split does not deliver`,
          );
      }
    }
  }

  return findings;
}

function loadRules() {
  if (!existsSync(RULES_DIR)) return [];
  return readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: basename(f, ".md"), text: readFileSync(join(RULES_DIR, f), "utf8") }));
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const rules = loadRules();
  const claudeText = existsSync(CLAUDE_MD) ? readFileSync(CLAUDE_MD, "utf8") : null;
  const claudeImports = claudeText ? claudeMdImports(claudeText) : new Set();
  const findings = checkRuleScoping({
    rules,
    claudeImports,
    // Only assert the prose when CLAUDE.md exists; a missing file is a different problem.
    proseCrossCutting: claudeText ? crossCuttingProseNames(claudeText) : undefined,
  });
  if (findings.length) {
    console.error(`✖ rule-scoping (${findings.length}):`);
    for (const f of findings) console.error("  - " + f);
    console.error(
      "\n  Fix: cross-cutting rules load on every session (no `paths:`); package/area rules\n" +
        "  are `paths:`-scoped and NOT @-imported by CLAUDE.md. Edit the CROSS_CUTTING /\n" +
        "  PATH_SCOPED lists in scripts/check-rule-scoping.mjs when the rule set changes.",
    );
    if (!WARN) process.exit(1);
  } else {
    console.log(
      `✔ rule-scoping: ${CROSS_CUTTING.length} cross-cutting (always-on) + ` +
        `${PATH_SCOPED.length} path-scoped rules; architecture-review off the always-on budget.`,
    );
  }
}
