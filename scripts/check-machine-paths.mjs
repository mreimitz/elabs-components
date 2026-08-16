#!/usr/bin/env node
/**
 * check-machine-paths.mjs — no committed machine-specific absolute paths (#203).
 *
 * Asserts that no git-TRACKED text file contains a machine-specific absolute
 * home path (`/Users/<name>/…` macOS, `/home/<name>/…` Linux). Such paths are a
 * standing repo safety rule ("Never commit … machine-specific absolute paths",
 * CLAUDE.md) because they break for every other machine and leak local layout.
 * The rule had no teeth — scratch capture scripts under `apps/e2e/reports/`
 * shipped hard-coded `/Users/<name>/…` playwright imports and output dirs and sat
 * on main until #203. Per the "enforcement over reminders" rule, the convention
 * now ships with its gate.
 *
 * Scope: every git-tracked file (`git ls-files`), binary files skipped via a
 * NUL-byte sniff. Untracked/ignored files are fine — the rule is about what is
 * COMMITTED. Generated/vendored dirs aren't tracked, so no exclusion list is
 * needed; if one ever is, add it to IGNORE below with a comment.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; resolves the repo root relative to this file
 * (cwd-independent). Exports the pure scanner for the self-test.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/** Tracked paths that may legitimately contain a home-path STRING. */
const IGNORE = [
  // This gate's own self-test embeds sample /Users/… and /home/… paths as
  // detection FIXTURES — they are test data, not committed machine paths.
  "scripts/check-machine-paths.test.mjs",
  // sanitizeType's determinism tests (#79) feed it sample /Users/… import()
  // paths to assert they get STRIPPED — fixtures of the same kind as above.
  "packages/cli/test/docgen.test.mjs",
];

/** A machine-specific absolute home path: /Users/<name>/… or /home/<name>/… */
const MACHINE_PATH_RE = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;

/**
 * Scan file contents for machine-specific absolute home paths.
 *
 * @param {string} text - file content.
 * @returns {number[]} 1-based line numbers of offending lines.
 */
export function findMachinePathLines(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (MACHINE_PATH_RE.test(lines[i])) hits.push(i + 1);
  }
  return hits;
}

/** True if the buffer looks binary (NUL byte in the first 8 KB). */
function isBinary(buf) {
  const probe = buf.subarray(0, 8192);
  return probe.includes(0);
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");

  let tracked;
  try {
    tracked = execFileSync("git", ["-C", REPO_ROOT, "ls-files", "-z"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter(Boolean);
  } catch (e) {
    console.error(`✖ machine-paths gate: git ls-files failed: ${e.message}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const violations = [];
  for (const rel of tracked) {
    if (IGNORE.includes(rel)) continue;
    let buf;
    try {
      buf = readFileSync(join(REPO_ROOT, rel));
    } catch {
      continue; // deleted-but-staged etc. — not this gate's business
    }
    if (isBinary(buf)) continue;
    const lines = findMachinePathLines(buf.toString("utf8"));
    if (lines.length) violations.push({ file: rel, lines });
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ machine-paths" : "✖ machine-paths gate FAILED";
    console.error(`\n${label} (${violations.length} file(s)):`);
    for (const v of violations) {
      console.error(`  ${v.file} — line(s) ${v.lines.join(", ")}`);
    }
    console.error(
      "\nCommitted files must not contain machine-specific absolute home paths\n" +
        "(/Users/<name>/…, /home/<name>/…) — they break on every other machine and\n" +
        "leak local layout (repo safety rule, CLAUDE.md). Rewrite the path relative\n" +
        "to the repo root, or remove/.gitignore the scratch file (reports/ output\n" +
        "is generated, not maintained source). See GitHub issue #203.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(`✔ machine-paths: no tracked file commits a machine-specific absolute path.`);
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
