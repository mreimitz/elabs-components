#!/usr/bin/env node
/**
 * build-skills — mirror the canonical `skills/` tree into per-harness directories
 * for teams that prefer committed copies (Cursor, Codex, Gemini, Copilot).
 *
 * The source of truth is always `skills/`. Claude Code reads it via the
 * `.claude-plugin/` manifest, and `npx skills add <repo>` reads it directly — so
 * running this is OPTIONAL. Use it only if you want per-harness folders in-repo.
 *
 *   node scripts/build-skills.mjs            # write all harness copies
 *   node scripts/build-skills.mjs --clean    # remove generated harness copies
 *
 * The mirrors are generated, untracked scratch (#294) — `targets` below is the
 * single source of truth for BOTH the copy destinations and the `.gitignore`
 * rules that keep them out of `git status`/`git add -A`. A normal (non-`--clean`)
 * run self-heals `.gitignore` if a rule ever goes missing; see
 * `ensureGitignoreEntries` and its lock, `build-skills.test.mjs`.
 */
import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "skills");

// harness dir → where it expects skills. Scoped to the `skills/` SUBPATH (not the
// harness dir itself) so tracked siblings survive — `.github/workflows/ci.yml`,
// `.github/ISSUE_TEMPLATE/*`, etc. must NOT be swept into the ignore rule.
export const targets = {
  ".cursor/skills": "Cursor (enable Agent Skills in settings)",
  ".gemini/skills": "Gemini CLI (enable Skills)",
  ".agents/skills": "Codex CLI / OpenAI agents",
  ".github/skills": "GitHub Copilot",
};

export const GITIGNORE_HEADER =
  "# Generated per-harness skill mirrors (scripts/build-skills.mjs; canonical source is skills/)";

/** The exact `.gitignore` lines this generator requires — one per harness mirror dir. */
export function ignoreLines() {
  return Object.keys(targets).map((rel) => `${rel}/`);
}

/**
 * Idempotently ensure every generated mirror dir is ignored. Rewrites just the
 * generator's own header block, in canonical order, so re-running twice is a
 * byte-identical no-op — it never touches any other line in the file. Returns the
 * lines that were newly added (empty array when nothing changed).
 */
export function ensureGitignoreEntries(gitignorePath) {
  const want = ignoreLines();
  const original = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const lines = original === "" ? [] : original.split("\n");
  // A file ending in "\n" splits to a trailing "" — drop it, we re-add the final
  // newline unconditionally below instead of tracking it through every branch.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const headerIdx = lines.findIndex((line) => line.trim() === GITIGNORE_HEADER);
  let missing;
  let nextLines;

  if (headerIdx === -1) {
    const already = new Set(lines.map((line) => line.trim()));
    missing = want.filter((line) => !already.has(line));
    if (missing.length === 0) return [];
    nextLines = [...lines, ...(lines.length > 0 ? [""] : []), GITIGNORE_HEADER, ...want];
  } else {
    let blockEnd = headerIdx + 1;
    while (blockEnd < lines.length && want.includes(lines[blockEnd].trim())) blockEnd++;
    const existing = lines.slice(headerIdx + 1, blockEnd).map((line) => line.trim());
    missing = want.filter((line) => !existing.includes(line));
    if (missing.length === 0) return [];
    nextLines = [...lines.slice(0, headerIdx + 1), ...want, ...lines.slice(blockEnd)];
  }

  writeFileSync(gitignorePath, nextLines.join("\n") + "\n");
  return missing;
}

function main(argv) {
  const clean = argv.includes("--clean");

  for (const [rel, label] of Object.entries(targets)) {
    const dest = join(root, rel);
    if (clean) {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      console.log(`removed ${rel}`);
      continue;
    }
    try {
      mkdirSync(dirname(dest), { recursive: true });
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
      console.log(`wrote ${rel}  (${label})`);
    } catch (err) {
      console.warn(`skipped ${rel} — ${err.code || err.message}`);
    }
  }

  if (!clean) {
    const added = ensureGitignoreEntries(join(root, ".gitignore"));
    if (added.length > 0) {
      console.log(
        `\n.gitignore: added ${added.length} missing entr${added.length === 1 ? "y" : "ies"}:`,
      );
      for (const line of added) console.log(`  ${line}`);
    }
  }

  console.log(
    clean
      ? "\nCleaned per-harness skill copies."
      : "\nClaude Code uses .claude-plugin/ directly — no copy needed there.",
  );
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
