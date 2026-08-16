#!/usr/bin/env node
/**
 * check-debrand.mjs — no tracked file may name the upstream organisation.
 *
 * This repo is a fork of an internal component library. The fork was debranded
 * in phases: the npm scope and repo token first (a one-shot codemod), then the
 * theme slugs, then the palette/fonts/logo, then ~140 leftover strings in
 * sample data, story copy, comments, doc prose and the changelog. That last
 * batch is precisely what the codemods MISSED — they were case-sensitive and
 * scope-anchored, so `Qlik Cloud`, `qLabs Workbench` and `qlik_export_chart`
 * all sailed through. A generated artifact, a dependency bump, or a doc written
 * from an old memory would put them straight back.
 *
 * So the convention ships with teeth (@.claude/rules/quality-gates.md): every
 * tracked, text file is scanned CASE-INSENSITIVELY for the organisation's
 * names, with no `@` scope required.
 *
 * NO ENGLISH-WORD ALLOWLIST IS NEEDED, deliberately. The org-slug arm is
 * anchored as `coe[-_ ]emea`, not a bare `coe`, so `coerce` / `coexist` /
 * `coefficient` cannot match. A bare-`coe` pattern would need an allowlist, and
 * an allowlist is a place for a real hit to hide — keep the pattern narrow
 * instead.
 *
 * THE ONLY EXEMPTIONS are paused surfaces (@.claude/rules/paused-surfaces.md),
 * which must not be edited even to make a gate pass, and they are DERIVED from
 * `scripts/lib/paused-surfaces.mjs` — never hard-coded here. Un-pausing stays a
 * one-line edit in `theme-types.ts`.
 *
 *   - Every file under a paused package's directory.
 *   - Inside `themes.css`, only the LINE RANGE of a paused theme's own block.
 *     The rest of that file is scanned normally — pausing a theme does not
 *     exempt the engine it lives in.
 *   - This gate's own source and its self-test, which must quote the names.
 *
 * Dependency-free; locates the workspace relative to this file (cwd-independent).
 *
 * Usage:
 *   node scripts/check-debrand.mjs            # every tracked text file
 *   node scripts/check-debrand.mjs --staged   # pre-commit hook: the INDEX only
 *
 * `--staged` reads stage-0 content (`git show :path`), not the working tree, so
 * it judges exactly what the commit would contain.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PAUSED_PACKAGE_DIRS, PAUSED_THEMES } from "./lib/paused-surfaces.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ → root

/**
 * The names. Case-insensitive, and NOT anchored to an `@scope` — the survivors
 * this gate was written for were prose (`Qlik Cloud`), identifiers
 * (`qlik_list_apps`) and camelCase (`qLabs`), none of which carry a scope.
 */
export const BRAND_RE = /qlik|qlabs|coe[-_ ]emea/gi;

/** This gate and its self-test have to quote the names to do their job. */
export const SELF_FILES = new Set(["scripts/check-debrand.mjs", "scripts/check-debrand.test.mjs"]);

/** The one file whose paused content is a BLOCK, not a whole directory. */
export const THEMES_CSS = "packages/tokens/src/themes.css";

/**
 * 1-based `[start, end]` line ranges of each paused theme's `[data-theme="…"]`
 * block. The block ends at the first closing brace in column 0 — the shape
 * `themes.css` is formatted in, and the same assumption its sibling gates make.
 */
export function pausedThemeRanges(content, pausedThemes = PAUSED_THEMES) {
  const lines = content.split("\n");
  const ranges = [];
  for (const theme of pausedThemes) {
    const open = `[data-theme="${theme}"] {`;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith(open)) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("}")) {
          end = j + 1;
          break;
        }
      }
      ranges.push([i + 1, end]);
    }
  }
  return ranges;
}

/**
 * The detector, exported so the self-test drives the same code CI does.
 * `files` is `[{ file, content }]` with repo-relative POSIX paths.
 */
export function findBrandHits(files, { pausedDirs = PAUSED_PACKAGE_DIRS } = {}) {
  const hits = [];
  for (const { file, content } of files) {
    if (SELF_FILES.has(file)) continue;
    if (pausedDirs.some((dir) => file === dir || file.startsWith(`${dir}/`))) continue;
    const exempt = file === THEMES_CSS ? pausedThemeRanges(content) : [];
    content.split("\n").forEach((line, i) => {
      const lineNo = i + 1;
      if (exempt.some(([from, to]) => lineNo >= from && lineNo <= to)) return;
      const matches = [...line.matchAll(BRAND_RE)];
      if (matches.length) {
        hits.push({ file, line: lineNo, match: matches[0][0], text: line.trim().slice(0, 120) });
      }
    });
  }
  return hits;
}

const git = (args) =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** Tracked, non-binary files with their WORKING-TREE contents. */
function trackedFiles() {
  const out = [];
  for (const file of git(["ls-files", "-z"]).split("\0").filter(Boolean)) {
    let content;
    try {
      content = readFileSync(join(REPO_ROOT, file), "utf8");
    } catch {
      continue; // deleted-but-staged, a submodule, or unreadable
    }
    if (content.includes("\0")) continue; // binary
    out.push({ file, content });
  }
  return out;
}

/** Added/copied/modified/renamed paths in the index, with their STAGED contents. */
function stagedFiles() {
  let listed;
  try {
    listed = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  } catch {
    return [];
  }
  const out = [];
  for (const file of listed.split("\0").filter(Boolean)) {
    let content;
    try {
      content = git(["show", `:${file}`]);
    } catch {
      continue; // e.g. a deleted path — nothing to scan
    }
    if (content.includes("\0")) continue; // binary
    out.push({ file, content });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const staged = process.argv.includes("--staged");
  const files = staged ? stagedFiles() : trackedFiles();
  const hits = findBrandHits(files);
  if (hits.length) {
    console.error(
      `✖ debrand: ${hits.length} ${staged ? "staged" : "tracked"} occurrence(s) of the upstream name:\n`,
    );
    for (const h of hits) console.error(`  ${h.file}:${h.line}: ${h.text}`);
    console.error(
      "\n  Rewrite the string so it says what is true of THIS repo. Do not add an" +
        "\n  exemption: the only sanctioned ones are paused surfaces, and those are" +
        "\n  derived from scripts/lib/paused-surfaces.mjs, not listed in this gate.",
    );
    process.exit(1);
  }
  console.log(
    staged
      ? `✔ debrand: no upstream name in ${files.length} staged text file(s)`
      : `✔ debrand: no upstream name in ${files.length} tracked text files`,
  );
}
