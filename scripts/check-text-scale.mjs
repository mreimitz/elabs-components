#!/usr/bin/env node
/**
 * check-text-scale.mjs — semantic type-scale ratchet (#187, research 07 §F).
 *
 * "Type is a role, not a size." Component source should reach for a type ROLE —
 * the `text-<role>` utility (display/title/subtitle/body/caption/meta/kpi/code)
 * or the `Heading`/`Text` primitives — never a raw font-size utility
 * (`text-sm`, `text-xl`, `text-[17px]`). The repo has a large pre-existing raw
 * surface (~365 uses), so this gate is a RATCHET, not a rewrite mandate:
 *
 *   - the committed baseline (`scripts/text-scale-baseline.json`, per-file
 *     counts) is the allowed ceiling — a file may only go DOWN or stay;
 *   - any file whose count RISES, and any NEW file with raw uses, FAILS
 *     (new flatness is blocked at the source);
 *   - `registry/` is WARN-only — copy-own blocks are expected to diverge and
 *     are owned downstream;
 *   - when counts drop, run `--update` to ratchet the baseline down (the gate
 *     refuses to ratchet UP via --update unless `--force` is also given).
 *
 * Scope: packages/*\/src/**\/*.{ts,tsx} + apps/docs/stories/**, excluding only
 * *.test.* (tests may demo/assert raw sizes) and generated dirs. STORIES ARE
 * GATED — reference/scenario/template stories are the exemplar + copy-own
 * surfaces, so "type is a role" holds there too (a genuine type-scale demo
 * carries its raw uses in the baseline).
 *
 * Flags:
 *   --warn     never exit non-zero; still prints findings.
 *   --update   rewrite the baseline from the current tree (ratchet down).
 *   --force    allow --update to raise a file's ceiling (use in the same PR
 *              that justifies the new raw use — should be rare).
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers exported for the
 * self-test (check-text-scale.test.mjs / pnpm text-scale:check:test).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { PAUSED_PACKAGE_DIR_NAMES } from "./lib/paused-surfaces.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "text-scale-baseline.json");

/**
 * A raw font-size utility: Tailwind's numeric scale (`text-xs`…`text-9xl`) or
 * an arbitrary LENGTH value (`text-[17px]`, `text-[1.2rem]`). Color/var
 * arbitraries (`text-[#fff]`, `text-[var(--x)]`) and the role utilities
 * (`text-body`, `text-title`, …) and alignment (`text-left`) do NOT match.
 */
export const RAW_TYPE_RE =
  /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b|\btext-\[[0-9.]+(?:px|rem|em)\b[^\]]*\]/g;

/** Count raw font-size utilities in one file's text. */
export function countRawTypeUtilities(text) {
  return (text.match(RAW_TYPE_RE) ?? []).length;
}

/**
 * Compare current per-file counts to the baseline.
 * @param {Record<string, number>} counts - current {relPath: count} (count > 0 only).
 * @param {Record<string, number>} baseline - committed ceilings.
 * @returns {{ file: string, count: number, allowed: number }[]} files over ceiling.
 */
export function compareToBaseline(counts, baseline) {
  const violations = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) violations.push({ file, count, allowed });
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file));
}

/** Recursively collect scannable source files under `dir`. */
function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (/node_modules|dist|storybook-static|\.turbo|coverage|__output/.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) collectFiles(p, out);
    // Stories are gated; only *.test.* are excluded (they assert on raw classes).
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Scan a root dir → {relPath: count} for files with count > 0. */
export function scanTree(rootAbs, repoRoot = REPO_ROOT) {
  const counts = {};
  for (const file of collectFiles(rootAbs)) {
    const n = countRawTypeUtilities(readFileSync(file, "utf8"));
    if (n > 0) counts[relative(repoRoot, file).split("\\").join("/")] = n;
  }
  return counts;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");

  // packages/*/src + apps/docs/stories — gated; registry — warn-only.
  const pkgsDir = join(REPO_ROOT, "packages");
  const pkgCounts = {};
  for (const pkg of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    // A paused package is not gated (.claude/rules/paused-surfaces.md).
    if (PAUSED_PACKAGE_DIR_NAMES.has(pkg)) continue;
    const src = join(pkgsDir, pkg, "src");
    if (existsSync(src)) Object.assign(pkgCounts, scanTree(src));
  }
  // Cross-package composition/scenario stories live here (not in any package).
  const docsStories = join(REPO_ROOT, "apps", "docs", "stories");
  if (existsSync(docsStories)) Object.assign(pkgCounts, scanTree(docsStories));
  const registryCounts = scanTree(join(REPO_ROOT, "registry"));

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};

  if (update) {
    const raised = compareToBaseline(pkgCounts, baseline);
    if (raised.length && !force) {
      console.error(
        "✖ text-scale --update would RAISE the ceiling for:\n" +
          raised.map((v) => `  ${v.file}  ${v.allowed} → ${v.count}`).join("\n") +
          "\nThe ratchet only goes down. If the new raw use is justified, re-run with --force.",
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(pkgCounts, null, 2) + "\n");
    const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
    console.log(
      `✔ text-scale baseline updated: ${Object.keys(pkgCounts).length} files, ${total} raw uses.`,
    );
    return;
  }

  const violations = compareToBaseline(pkgCounts, baseline);
  const totalNow = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
  const totalBase = Object.values(baseline).reduce((a, b) => a + b, 0);

  const regTotal = Object.values(registryCounts).reduce((a, b) => a + b, 0);
  if (regTotal > 0) {
    console.warn(
      `⚠ text-scale (registry, warn-only): ${regTotal} raw font-size use(s) in copy-own blocks — ` +
        "the role vocabulary (`text-<role>`) is the recommended default.",
    );
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ text-scale" : "✖ text-scale gate FAILED";
    console.error(`\n${label} — raw font-size utilities above the ratchet baseline:`);
    for (const v of violations) {
      console.error(`  ${v.file} — ${v.count} raw use(s), baseline allows ${v.allowed}`);
    }
    console.error(
      "\nType is a ROLE, not a size (#187). Reach for `text-<role>` " +
        "(display/title/subtitle/body/caption/meta/kpi/code — `--text-body == text-sm`,\n" +
        "so swapping `text-sm` → `text-body` is a visual no-op) or the Heading/Text\n" +
        "primitives. The baseline only ratchets DOWN; see .claude/rules/styling-and-tokens.md\n" +
        "(Typography scale) and scripts/text-scale-baseline.json.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (totalNow < totalBase) {
    console.log(
      `✔ text-scale: ${totalNow} raw use(s) (baseline ${totalBase} — it dropped! ` +
        "Run `pnpm text-scale:check -- --update` to ratchet the baseline down.)",
    );
  } else if (!warnOnly) {
    console.log(`✔ text-scale: no new raw font-size utilities (${totalNow} baselined uses).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
