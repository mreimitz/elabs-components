#!/usr/bin/env node
/**
 * check-conflict-markers.mjs — no tracked file may contain a literal, unresolved
 * Git merge-conflict marker (#379 Part B).
 *
 * Incident: PR #375 merged commit `7ac0d12` ("chore: begin conflict resolution
 * with main") with `<<<<<<<`/`=======`/`>>>>>>>` markers committed verbatim into
 * six tracked files, including `brand-ui.manifest.json` (making it invalid JSON —
 * breaking the always-on `brand-ui` MCP server, which re-reads it per call) and
 * `scripts/check-app-spec.mjs` (a JS syntax error, so the gate that might have
 * caught it couldn't even load). `git commit` does not itself refuse conflict
 * markers — staging a conflicted path is exactly how a human signals "resolved" —
 * and nothing else in the enforcement chain checked. See issue #379.
 *
 * Every other repo-wide invariant here ships with teeth (`manifest:check`,
 * `format:check`, `dep-direction:check`, …); this is the one that was missing.
 *
 * Two shapes, matching the repo's "commit-time teeth + CI backstop" doctrine
 * (#239 precedent):
 *
 *   node scripts/check-conflict-markers.mjs             # CI / manual: every TRACKED file
 *   node scripts/check-conflict-markers.mjs --staged     # pre-commit hook: STAGED (index)
 *                                                         # content only — an untracked
 *                                                         # scratch file can't block a commit,
 *                                                         # and a working-tree edit made AFTER
 *                                                         # `git add` (not re-staged) is not
 *                                                         # what would actually land.
 *
 * Detection: a line matching exactly 7 repeats of `<`, `=`, or `>` at the start
 * of the line, followed by whitespace or end-of-line (so an 8-char run, or a
 * marker-shaped run embedded mid-line — a string literal, a Markdown table rule —
 * does not false-positive). `=======` alone is extremely common LEGITIMATE
 * content (a Markdown setext `Title\n=======` heading), so it counts only once a
 * `<<<<<<<` has already been seen earlier in the SAME file — `<<<<<<<` and
 * `>>>>>>>` are inherently rare enough at line-start that they need no such
 * gating.
 *
 * Binary tracked files (images, fonts, …) are skipped via a null-byte heuristic
 * on the first chunk of content — never decoded as text.
 *
 * The full-tree scan is ALSO the `conflict-markers` rule in `node scripts/check/run.mjs`;
 * this script stays for the `--staged` pre-commit hook.
 * Dependency-free; ESM; cwd-independent. CLI self-test:
 * `scripts/check-conflict-markers.test.mjs` (`pnpm check:test`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Detection lives in the check rule (one implementation); this script keeps the entry
// point the runner cannot serve: `--staged` (index content, pre-commit). The rule module
// is dependency-free, so this runs before `pnpm install`.
import { findConflictMarkers, looksBinary } from "./check/rules/conflict-markers.mjs";

export { findConflictMarkers, looksBinary };

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

// ───────────────────────────────── CLI ────────────────────────────────────────
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

/** Every tracked file, repo-relative POSIX paths. */
function trackedFiles(root) {
  return git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
}

/** Every staged (added/copied/modified/renamed) file, repo-relative POSIX paths. */
function stagedFiles(root) {
  try {
    return git(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** The exact STAGED (index, stage 0) content of a path — not the working tree. */
function readStagedContent(root, file) {
  return git(root, ["show", `:${file}`]);
}

function main(argv) {
  const rootIdx = argv.indexOf("--root");
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : REPO_ROOT;
  const staged = argv.includes("--staged");

  if (!existsSync(join(root, ".git")) && !existsSync(join(root, "..", ".git"))) {
    // Not fatal — just means git commands below will throw and we treat it as
    // "no files to scan" rather than crash a non-git tarball checkout.
  }

  const violations = []; // { file, line, text }

  if (staged) {
    for (const file of stagedFiles(root)) {
      let content;
      try {
        content = readStagedContent(root, file);
      } catch {
        continue; // e.g. a deleted path — nothing to scan
      }
      if (looksBinary(content)) continue;
      for (const hit of findConflictMarkers(content)) violations.push({ file, ...hit });
    }
  } else {
    for (const file of trackedFiles(root)) {
      const abs = join(root, file);
      if (!existsSync(abs)) continue; // staged-for-delete but still tracked in HEAD, etc.
      let text;
      try {
        text = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      if (looksBinary(text)) continue;
      for (const hit of findConflictMarkers(text)) violations.push({ file, ...hit });
    }
  }

  if (violations.length > 0) {
    console.error(`✖ conflict-markers gate FAILED (${violations.length} marker line(s)):`);
    for (const v of violations.slice(0, 50)) {
      console.error(`  ${v.file}:${v.line}: ${v.text}`);
    }
    if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
    console.error(
      "\nUnresolved Git conflict markers are committed in the file(s) above — this is exactly\n" +
        "the #375 incident (a partially-resolved merge landed on `main`). Resolve the conflict\n" +
        "for real (remove the `<<<<<<<`/`=======`/`>>>>>>>` lines and pick/merge the intended\n" +
        "content) before committing. See issue #379.",
    );
    return 1;
  }

  console.log(
    staged
      ? "✔ conflict-markers: no unresolved conflict markers in staged content."
      : "✔ conflict-markers: no unresolved conflict markers in any tracked file.",
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
