#!/usr/bin/env node
/**
 * check-plugin-consumer-clean.mjs — the brand-ui plugin's consumer surface must
 * carry NO repo-maintenance plumbing (VP-01 curation).
 *
 * The plugin (`.claude-plugin/plugin.json`) ships skills + agents to END USERS who
 * install it in THEIR project. Those users have none of this monorepo: no
 * `/file-issue`, no `.claude/rules`, no `brand-ui-root-cause-analyst`, no
 * `packages/…`/`apps/…` tree, no sibling repo agents. So any prose in a SHIPPED
 * skill/agent that references those internals installs broken — it tells the user's
 * agent to read files that don't exist and run commands they don't have. This gate
 * keeps the consumer surface clean so the plugin can't silently start shipping
 * repo-coupled prose again (modeled on `build-agent-kit.mjs`'s `DANGLING` self-check):
 *
 *   - AGENTS — every `.md` in the plugin's declared `agents` MUST contain none of
 *     the banned repo-internal tokens. ENFORCED (fails CI).
 *   - SKILLS — every `.md` under the plugin's declared `skills` (SKILL.md +
 *     reference/*.md) MUST also contain none of the banned tokens. ENFORCED (fails
 *     CI). The shipped skill SOURCES were de-coupled in place so the same prose is
 *     correct for both this repo's sessions and a consumer's install; the
 *     `build-agent-kit.mjs` sanitizer rewrites are now no-ops on a clean source.
 *
 * Run via `pnpm plugin:consumer-clean:check`; the self-test
 * (`pnpm plugin:consumer-clean:check:test`) plants a coupled fixture and asserts the
 * gate fails, so the gate itself can't rot.
 *
 * Flags: --warn  never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; locates the plugin relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root (the plugin root: source "./")

/**
 * Tokens that prove a doc is coupled to THIS monorepo and would be dead/broken in a
 * consumer's project. Keep in lockstep with the curation decision. Each entry is a
 * plain substring (case-sensitive) — these strings never legitimately appear in
 * consumer-facing prose.
 */
export const BANNED_TOKENS = [
  "/file-issue",
  ".claude/",
  "issue-workflow",
  "packages/",
  "apps/",
  "brand-ui-root-cause",
  "brand-ui-session-reviewer",
  "repo-architect",
];

/** Normalize a `string | string[]` plugin field to an array of path strings. */
function toPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

/**
 * The pure checker. Driven by already-loaded data so the self-test is hermetic.
 *
 * @param {object} input
 * @param {{path:string, text:string, enforced:boolean}[]} input.docs  every shipped
 *   `.md` with its text and whether a hit is enforced (the default for shipped
 *   skills + agents) or warn-only (the `enforced:false` escape hatch, exercised by
 *   the self-test).
 * @returns {{errors:string[], warnings:string[]}}
 */
export function checkConsumerClean({ docs }) {
  const errors = [];
  const warnings = [];
  for (const { path, text, enforced } of docs) {
    const lines = text.split(/\r?\n/);
    for (const bad of BANNED_TOKENS) {
      lines.forEach((line, i) => {
        if (line.includes(bad)) {
          const hit = `${path}:${i + 1} → "${bad}"`;
          (enforced ? errors : warnings).push(hit);
        }
      });
    }
  }
  return { errors, warnings };
}

// ---- disk loader (the real-FS half; the self-test bypasses this) -----------

function readJson(abs) {
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

/** Text-file extensions a shipped skill/agent could leak repo-internals through.
 *  Binaries (.png/.svg) can't carry a banned token, so they're skipped. The
 *  earlier `.md`-only scan missed a `docs/playbooks` path in an `app-spec.schema.json`. */
const SHIPPED_TEXT_EXT = /\.(md|json|tsx?|mjs|cjs|js|csv|txt|ya?ml)$/i;

/** Recursively collect every shippable TEXT file under `abs` (a dir) or the file itself. */
function collectMd(abs) {
  if (!existsSync(abs)) return [];
  if (statSync(abs).isDirectory()) {
    const out = [];
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      out.push(...collectMd(join(abs, e.name)));
    }
    return out;
  }
  return SHIPPED_TEXT_EXT.test(abs) ? [abs] : [];
}

/** Build the checker input from the plugin's declared consumer surface. */
export function loadConsumerDocs(root = REPO_ROOT) {
  const pluginJson = readJson(join(root, ".claude-plugin", "plugin.json"));
  const docs = [];
  if (!pluginJson) return { docs, pluginMissing: true };

  // AGENTS are enforced — they are purpose-built consumer-clean (the new agents/ dir).
  for (const p of toPaths(pluginJson.agents)) {
    for (const abs of collectMd(join(root, p.replace(/^\.\//, "")))) {
      docs.push({ path: relative(root, abs), text: readFileSync(abs, "utf8"), enforced: true });
    }
  }

  // SKILLS are enforced too — every shipped skill `.md` (SKILL.md + reference/*.md)
  // was de-coupled in place, so the consumer surface must stay clean.
  for (const p of toPaths(pluginJson.skills)) {
    for (const abs of collectMd(join(root, p.replace(/^\.\//, "")))) {
      docs.push({ path: relative(root, abs), text: readFileSync(abs, "utf8"), enforced: true });
    }
  }

  return { docs, pluginMissing: false };
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const WARN = process.argv.includes("--warn");
  const { docs, pluginMissing } = loadConsumerDocs();
  if (pluginMissing) {
    console.error("✖ plugin-consumer-clean: .claude-plugin/plugin.json missing or not valid JSON");
    if (!WARN) process.exit(1);
  } else {
    const { errors, warnings } = checkConsumerClean({ docs });
    if (warnings.length) {
      console.warn(`⚠ plugin-consumer-clean: ${warnings.length} warn-only coupling hit(s):`);
      for (const w of warnings) console.warn("  - " + w);
    }
    if (errors.length) {
      console.error(
        `✖ plugin-consumer-clean: ${errors.length} repo-coupling hit(s) in SHIPPED SKILLS/AGENTS:`,
      );
      for (const e of errors) console.error("  - " + e);
      console.error(
        "\n  The plugin ships these to end users who have none of this monorepo. A shipped\n" +
          "  skill or agent must reference no repo internals (" +
          BANNED_TOKENS.join(", ") +
          ").\n  Fix the consumer-facing copy in the shipped skill source / ./agents/, not the\n" +
          "  repo-internal rules or agents.",
      );
      if (!WARN) process.exit(1);
    } else {
      console.log(
        `✔ plugin-consumer-clean: ${docs.filter((d) => d.enforced).length} shipped skill + agent ` +
          "doc(s) carry no repo-internal references.",
      );
    }
  }
}
