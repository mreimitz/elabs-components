#!/usr/bin/env node
/**
 * check-raw-palette.mjs — raw Tailwind palette ratchet (#189, research 10 §F).
 *
 * "Semantic tokens only." Component source must use token-backed color
 * utilities (`text-info-text`, `bg-success/10`, `border-destructive`, …) —
 * never a raw Tailwind PALETTE utility (`text-yellow-600`, `bg-red-500`,
 * `border-blue-300`, `fill-green-400`, …), which bypasses all six themes (the
 * #182 bug class: the boundary hook only catches `#hex`, so raw palette
 * slipped through). The repo has a pre-existing raw surface (schema-display,
 * package-info, terminal, commit, …), so this gate is a RATCHET, not a
 * rewrite mandate — the same contract as check-text-scale.mjs:
 *
 *   - the committed baseline (`scripts/raw-palette-baseline.json`, per-file
 *     counts) is the allowed ceiling — a file may only go DOWN or stay;
 *   - any file whose count RISES, and any NEW file with raw palette uses,
 *     FAILS (new off-token color is blocked at the source);
 *   - `registry/` is WARN-only — copy-own blocks are owned downstream;
 *   - when counts drop, run `--update` to ratchet the baseline down (the gate
 *     refuses to ratchet UP via --update unless `--force` is also given).
 *
 * Scope: packages/*\/src/**\/*.{ts,tsx}, excluding *.test.* / *.stories.*
 * (stories/tests may demo raw colors deliberately) and generated dirs.
 *
 * Flags:
 *   --warn     never exit non-zero; still prints findings.
 *   --update   rewrite the baseline from the current tree (ratchet down).
 *   --force    allow --update to raise a file's ceiling (rare; justify in PR).
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers exported for the
 * self-test (check-raw-palette.test.mjs / pnpm palette:check:test).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "raw-palette-baseline.json");

/**
 * A raw Tailwind PALETTE color utility: a color-bearing prefix + a named
 * palette hue + a numeric shade (`text-yellow-600`, `bg-red-500/80`,
 * `border-blue-300`). Semantic-token utilities (`text-info`, `bg-success/10`,
 * `border-destructive`) do NOT match — they have no `<hue>-<shade>` tail.
 */
export const RAW_PALETTE_RE =
  /\b(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** Count raw palette utilities in one file's text. */
export function countRawPaletteUtilities(text) {
  return (text.match(RAW_PALETTE_RE) ?? []).length;
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
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Scan a root dir → {relPath: count} for files with count > 0. */
export function scanTree(rootAbs, repoRoot = REPO_ROOT) {
  const counts = {};
  for (const file of collectFiles(rootAbs)) {
    const n = countRawPaletteUtilities(readFileSync(file, "utf8"));
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

  // packages/*/src — gated; registry — warn-only.
  const pkgsDir = join(REPO_ROOT, "packages");
  const pkgCounts = {};
  for (const pkg of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    const src = join(pkgsDir, pkg, "src");
    if (existsSync(src)) Object.assign(pkgCounts, scanTree(src));
  }
  const registryCounts = scanTree(join(REPO_ROOT, "registry"));

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};

  if (update) {
    const raised = compareToBaseline(pkgCounts, baseline);
    if (raised.length && !force) {
      console.error(
        "✖ raw-palette --update would RAISE the ceiling for:\n" +
          raised.map((v) => `  ${v.file}  ${v.allowed} → ${v.count}`).join("\n") +
          "\nThe ratchet only goes down. If the new raw palette use is justified, re-run with --force.",
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(pkgCounts, null, 2) + "\n");
    const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
    console.log(
      `✔ raw-palette baseline updated: ${Object.keys(pkgCounts).length} files, ${total} raw use(s).`,
    );
    return;
  }

  const violations = compareToBaseline(pkgCounts, baseline);
  const totalNow = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
  const totalBase = Object.values(baseline).reduce((a, b) => a + b, 0);

  const regTotal = Object.values(registryCounts).reduce((a, b) => a + b, 0);
  if (regTotal > 0) {
    console.warn(
      `⚠ raw-palette (registry, warn-only): ${regTotal} raw palette use(s) in copy-own blocks — ` +
        "semantic tokens are the recommended default.",
    );
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ raw-palette" : "✖ raw-palette gate FAILED";
    console.error(`\n${label} — raw Tailwind palette utilities above the ratchet baseline:`);
    for (const v of violations) {
      console.error(`  ${v.file} — ${v.count} raw use(s), baseline allows ${v.allowed}`);
    }
    console.error(
      "\nSemantic tokens only (#189/#182). Raw palette utilities (`text-yellow-600`,\n" +
        "`bg-red-500`, …) bypass all six themes. Reach for the token-backed\n" +
        "utilities (`text-info-text`, `bg-success/10`, `text-destructive-text`, …) or\n" +
        "the canonical StatusBadge/StatusIcon for execution status. The baseline only\n" +
        "ratchets DOWN; see .claude/rules/styling-and-tokens.md and\n" +
        "scripts/raw-palette-baseline.json.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (totalNow < totalBase) {
    console.log(
      `✔ raw-palette: ${totalNow} raw use(s) (baseline ${totalBase} — it dropped! ` +
        "Run `pnpm palette:check -- --update` to ratchet the baseline down.)",
    );
  } else if (!warnOnly) {
    console.log(`✔ raw-palette: no new raw palette utilities (${totalNow} baselined uses).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
