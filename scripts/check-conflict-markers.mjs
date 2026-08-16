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
 * Dependency-free; ESM; cwd-independent. Exports the pure scanner for the
 * self-test (`scripts/check-conflict-markers.test.mjs`, `pnpm conflict-markers:check:test`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/** Exactly 7 repeats of the marker char, at line start, then whitespace or EOL. */
export const MARKER_RE = /^(<{7}|={7}|>{7})(\s|$)/;

/**
 * Scan file content for unresolved conflict markers.
 * Returns `[{ line, text }]`, 1-based `line`, `text` the (truncated) line
 * content — sorted by line, ascending. Pure — exported for the self-test.
 */
export function findConflictMarkers(content) {
  const hits = [];
  let sawOpen = false;
  const lines = String(content).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(MARKER_RE);
    if (!m) continue;
    const ch = m[1][0];
    if (ch === "<") {
      sawOpen = true;
      hits.push({ line: i + 1, text: line.slice(0, 80) });
    } else if (ch === ">") {
      hits.push({ line: i + 1, text: line.slice(0, 80) });
    } else if (sawOpen) {
      // ch === "=" and a `<<<<<<<` has already appeared earlier in this file —
      // otherwise this is almost certainly a Markdown setext heading underline.
      hits.push({ line: i + 1, text: line.slice(0, 80) });
    }
  }
  return hits;
}

/** Heuristic: does this buffer look binary (a null byte in the first 8000 bytes)? */
export function looksBinary(buf) {
  const scan = buf.length > 8000 ? buf.subarray(0, 8000) : buf;
  return scan.includes(0);
}

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
      if (looksBinary(Buffer.from(content, "utf8"))) continue;
      for (const hit of findConflictMarkers(content)) violations.push({ file, ...hit });
    }
  } else {
    for (const file of trackedFiles(root)) {
      const abs = join(root, file);
      if (!existsSync(abs)) continue; // staged-for-delete but still tracked in HEAD, etc.
      let buf;
      try {
        buf = readFileSync(abs);
      } catch {
        continue;
      }
      if (looksBinary(buf)) continue;
      for (const hit of findConflictMarkers(buf.toString("utf8")))
        violations.push({ file, ...hit });
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
