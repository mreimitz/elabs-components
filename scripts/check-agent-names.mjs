#!/usr/bin/env node
/**
 * check-agent-names.mjs — subagent name-hygiene gate (#152).
 *
 * Subagents ship as `.claude/agents/*.md` and are resolved by the harness's Task
 * tool via their `name:` frontmatter. If brand-ui is distributed as a plugin beside
 * another marketplace plugin that defines the same generic role name (e.g. a bare
 * `accessibility-reviewer`), collision resolution is undefined. This gate keeps the
 * agent namespace collision-free and plugin-scoped so the drift can't recur:
 *
 *   1. PLUGIN SCOPE — every agent `name:` must carry an allowed scope prefix
 *      (`brand-ui-` is the canonical plugin scope; `repo-architect-` is an allowed
 *      sub-scope for the architecture-audit cluster). A bare generic role name fails.
 *   2. NO COLLISION — no two agent files may declare the same `name:`.
 *   3. NAME ↔ FILENAME — the file basename must equal the `name:` (the repo
 *      convention; keeps agents discoverable by path).
 *
 * Run via `pnpm agents:check`; the self-test (`pnpm agents:check:test`) plants a bad
 * fixture in memory and asserts the gate fails, so the gate itself can't silently rot.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; locates `.claude/agents` relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");

// Allowed scope prefixes. `brand-ui-` is the plugin scope; `repo-architect-` is the
// architecture-review cluster's sub-scope. Add a prefix here only with intent.
export const ALLOWED_SCOPE_PREFIXES = ["brand-ui-", "repo-architect-"];

const WARN = process.argv.includes("--warn");

/** Extract the `name:` value from YAML frontmatter (first `---`…`---` block). */
function parseAgentName(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const nameLine = m[1].split(/\r?\n/).find((l) => /^name\s*:/.test(l));
  if (!nameLine) return null;
  return nameLine
    .replace(/^name\s*:/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/**
 * Run the checks over a list of `{ file, name }` agents and return findings.
 * Exported so the self-test can drive it with in-memory fixtures.
 */
export function checkAgents(agents) {
  const findings = [];
  const seen = new Map(); // name -> file

  for (const { file, name } of agents) {
    if (!name) {
      findings.push(`${file}: missing \`name:\` in frontmatter`);
      continue;
    }
    // 1. scope prefix
    if (!ALLOWED_SCOPE_PREFIXES.some((p) => name.startsWith(p))) {
      findings.push(
        `${file}: agent name "${name}" is not plugin-scoped — prefix it with ${ALLOWED_SCOPE_PREFIXES.map(
          (p) => `\`${p}\``,
        ).join(" or ")} (e.g. "brand-ui-${name}")`,
      );
    }
    // 2. collision
    if (seen.has(name)) {
      findings.push(
        `${file}: agent name "${name}" collides with ${seen.get(name)} — names must be unique`,
      );
    } else {
      seen.set(name, file);
    }
    // 3. name ↔ filename
    const base = basename(file).replace(/\.md$/, "");
    if (base !== name) {
      findings.push(
        `${file}: filename "${base}" does not match \`name:\` "${name}" (rename the file to ${name}.md)`,
      );
    }
  }
  return findings;
}

function loadAgents() {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const file = join(".claude", "agents", f);
      const text = readFileSync(join(AGENTS_DIR, f), "utf8");
      return { file, name: parseAgentName(text) };
    });
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const agents = loadAgents();
  const findings = checkAgents(agents);
  if (findings.length) {
    console.error(`✖ agent-name hygiene (${findings.length}):`);
    for (const f of findings) console.error("  - " + f);
    console.error(
      "\n  Fix: every `.claude/agents/*.md` must declare a plugin-scoped, unique `name:`\n" +
        "  matching its filename. Scope prefixes: " +
        ALLOWED_SCOPE_PREFIXES.join(", ") +
        ".",
    );
    if (!WARN) process.exit(1);
  } else {
    console.log(`✔ agent-names: ${agents.length} agents are plugin-scoped, unique, name↔filename.`);
  }
}
