#!/usr/bin/env node
/**
 * gen-plugin-agents.mjs — keep `.claude-plugin/plugin.json`'s `agents` array in
 * lockstep with the `agents/` directory (mirrors `gen-templates`).
 *
 * The plugin ships consumer-clean reviewer agents from `agents/*.md`, declared in
 * plugin.json's `agents` array. That array was hand-listed, so a NEW agent dropped
 * into `agents/` would silently NOT ship (and a removed one would dangle). This
 * generator makes the array DERIVED, not hand-kept:
 *
 *   agents := the sorted list of `./agents/*.md`, one `./agents/<file>.md` entry each.
 *
 * It rewrites ONLY the `agents` value, preserving the rest of plugin.json and its
 * formatting (canonical 2-space JSON + trailing newline — the same shape Prettier
 * emits, so `format:check` stays green). It is idempotent.
 *
 *   pnpm plugin:agents          # rewrite plugin.json's agents array from agents/*.md
 *   pnpm plugin:agents:check    # diff-only; non-zero exit on drift (CI gate)
 *
 * The self-test (`pnpm plugin:agents:check:test`) plants an extra agents/*.md and
 * asserts `--check` fails, so the gate itself can't silently rot.
 *
 * Deterministic + dependency-free. Locates the repo root relative to this file, so
 * it is cwd-independent.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE); // scripts/ -> repo root (the plugin root: "./")

const PLUGIN_JSON_REL = ".claude-plugin/plugin.json";
const AGENTS_DIR_REL = "agents";

/**
 * The sorted list of `./agents/*.md` entries (the value the `agents` array must
 * hold). Sorted by filename for determinism. Returns [] if the dir is absent.
 */
export function discoverAgents(root = REPO_ROOT) {
  const dir = join(root, AGENTS_DIR_REL);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `./${AGENTS_DIR_REL}/${f}`);
}

/**
 * Compute the canonical plugin.json text with `agents` set to the discovered list.
 * Preserves every other field and its order; emits canonical 2-space JSON + a
 * trailing newline (Prettier-stable). Returns { text, agents, current }.
 */
export function computePluginJson(root = REPO_ROOT) {
  const abs = join(root, PLUGIN_JSON_REL);
  const current = readFileSync(abs, "utf8");
  const obj = JSON.parse(current);
  const agents = discoverAgents(root);
  obj.agents = agents;
  const text = JSON.stringify(obj, null, 2) + "\n";
  return { text, agents, current };
}

/** Write the regenerated plugin.json; returns true if it changed on disk. */
export function writePluginAgents(root = REPO_ROOT) {
  const { text, current } = computePluginJson(root);
  if (text === current) return false;
  writeFileSync(join(root, PLUGIN_JSON_REL), text);
  return true;
}

/**
 * Drift-check: true when the committed plugin.json's `agents` array does NOT match
 * the agents/ directory (i.e. regenerating would change the file).
 */
export function isPluginAgentsStale(root = REPO_ROOT) {
  const { text, current } = computePluginJson(root);
  return text !== current;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const check = process.argv.includes("--check");
  if (check) {
    if (isPluginAgentsStale()) {
      const { agents } = computePluginJson();
      console.error(
        "✖ plugin.json `agents` is STALE — it does not match agents/*.md:\n" +
          agents.map((a) => "  - " + a).join("\n") +
          "\n  Run `pnpm plugin:agents` and commit the result.\n" +
          "  (The agents array is generated from agents/*.md; never hand-edit it.)",
      );
      process.exit(1);
    }
    console.log("✔ plugin.json `agents` is fresh (matches agents/*.md).");
  } else {
    const changed = writePluginAgents();
    const { agents } = computePluginJson();
    console.log(
      (changed ? "Rewrote" : "No change to") +
        ` plugin.json \`agents\` (${agents.length} entr${agents.length === 1 ? "y" : "ies"}):`,
    );
    for (const a of agents) console.log(`  ${a}`);
  }
}
