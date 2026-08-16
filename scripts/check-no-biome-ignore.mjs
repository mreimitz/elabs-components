#!/usr/bin/env node
/**
 * check-no-biome-ignore.mjs — no inert `biome-ignore` directives in source (#185).
 *
 * This repo lints with **ESLint 9**, not Biome. A `biome-ignore` comment is
 * therefore a no-op: it reads like a reviewed, justified suppression while the
 * underlying warning stays live. #185 found 49 of them across
 * `packages/charts/src`, hiding real `react-hooks/exhaustive-deps` and
 * `@typescript-eslint/no-explicit-any` findings — one of which (a `useLayoutEffect`
 * with no dependency array in `sankey-link.tsx`) re-measured an SVG path on every
 * render.
 *
 * The convention: suppress with `// eslint-disable-next-line <rule> -- <reason>`.
 * Per "enforcement over reminders" (.claude/rules/quality-gates.md) the convention
 * ships with its teeth — this gate fails the build (exit 1) on any `biome-ignore`
 * (or `biome-ignore-all` / `biome-ignore-start`) in tracked source.
 *
 * Scope: git-TRACKED source files under `packages/`, `apps/` and `registry/`
 * (code + stylesheet extensions; `node_modules/`, `dist/` and build output are
 * never tracked, so no exclusion list is needed). The gate's own self-test lives
 * in `scripts/` and is out of scope by construction.
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

/** Roots whose tracked source must be free of Biome directives. */
const ROOTS = ["packages/", "apps/", "registry/"];

/** Source extensions a `biome-ignore` comment could plausibly appear in. */
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|css|scss|less)$/;

/**
 * `biome-ignore`, `biome-ignore-all`, `biome-ignore-start`, `biome-ignore-end`.
 * Matched anywhere on the line — these only ever appear inside comments.
 */
const BIOME_IGNORE_RE = /biome-ignore(?:-all|-start|-end)?\b/;

/**
 * True when this repo-relative path is in the gate's scope.
 *
 * @param {string} rel - repo-relative path (POSIX separators, as `git ls-files` emits).
 * @returns {boolean}
 */
export function isScannedPath(rel) {
  return ROOTS.some((root) => rel.startsWith(root)) && SOURCE_EXT.test(rel);
}

/**
 * Scan file contents for Biome suppression directives.
 *
 * @param {string} text - file content.
 * @returns {number[]} 1-based line numbers of offending lines.
 */
export function findBiomeIgnoreLines(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (BIOME_IGNORE_RE.test(lines[i])) hits.push(i + 1);
  }
  return hits;
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
    console.error(`✖ biome-ignore gate: git ls-files failed: ${e.message}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const scanned = tracked.filter(isScannedPath);
  const violations = [];
  for (const rel of scanned) {
    let text;
    try {
      text = readFileSync(join(REPO_ROOT, rel), "utf8");
    } catch {
      continue; // deleted-but-staged etc. — not this gate's business
    }
    const lines = findBiomeIgnoreLines(text);
    if (lines.length) violations.push({ file: rel, lines });
  }

  if (violations.length) {
    const total = violations.reduce((n, v) => n + v.lines.length, 0);
    const label = warnOnly ? "⚠ biome-ignore" : "✖ biome-ignore gate FAILED";
    console.error(`\n${label} — ${total} directive(s) in ${violations.length} file(s):`);
    for (const v of violations) {
      for (const line of v.lines) console.error(`  ${v.file}:${line}`);
    }
    console.error(
      "\nThis repo has NO Biome — a `biome-ignore` comment is INERT, so the warning it\n" +
        "claims to suppress is still live (GitHub issue #185). Either fix the finding, or\n" +
        "suppress it for real:\n" +
        "  // eslint-disable-next-line <rule> -- <reason>\n" +
        "If the named Biome rule has no enabled ESLint equivalent, delete the directive\n" +
        "(keep the rationale as a plain comment).",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ biome-ignore: no inert Biome directives in ${scanned.length} tracked source file(s).`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
