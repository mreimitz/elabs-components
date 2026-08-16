#!/usr/bin/env node
/**
 * check-separation.mjs — redundant-border ratchet (#187, research 08 §F).
 *
 * The surface-separation convention: each region owns ONE focal separation
 * gesture — fill / rail / elevation / a single divider — picked by semantic
 * role. A bare `border` stacked on a region that ALREADY has a non-default
 * fill is (usually) a redundant boundary: the border channel carries no type
 * information and the screen reads as identical rectangles (BTN-4).
 *
 * Detectable slice (honest scope, 08 §F): within ONE class-string literal, the
 * standalone `border` token co-occurring with a non-default fill
 * (`bg-surface-muted` / `bg-surface-elevated` / `bg-chat-user` /
 * `bg-<status>/N` alpha-wash). Cross-element regions and "is the border the
 * sole cue?" are perceptual — they belong to the visual reviewer, not a regex.
 * `border bg-card` is the legitimate generic-Card default and does NOT flag;
 * rails (`border-s-*`), axis borders (`border-t/b/l/r/x/y`) and `border-0/none/
 * transparent` never flag.
 *
 * RATCHET: pre-existing co-occurrences are baselined
 * (`scripts/separation-baseline.json`); a file may only go down or stay.
 * `registry/` is warn-only (copy-own). Same flags as check-text-scale.mjs:
 * --warn / --update / --force.
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers exported for the
 * self-test (check-separation.test.mjs / pnpm separation:check:test).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "separation-baseline.json");

/** Non-default fills that make a bare `border` redundant (08 §F). */
const FILL_RE =
  /^bg-(?:surface-muted|surface-elevated|chat-user|(?:success|warning|destructive|info)\/\d+)$/;

/** String literals a className could live in (single-line; class strings are). */
const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

/**
 * Does ONE class string violate the rule? True iff it contains the standalone
 * token `border` (not border-s-N / border-t / border-0 / …) AND a non-default fill token.
 */
export function classStringViolates(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  // standalone `border`, possibly behind a variant prefix (`dark:border`)
  const hasBareBorder = tokens.some((t) => t.replace(/^.*:/, "") === "border");
  const hasFill = tokens.some((t) => FILL_RE.test(t.replace(/^.*:/, "")));
  return hasBareBorder && hasFill;
}

/** Count violating class-string literals in one file's text. */
export function countSeparationViolations(text) {
  let n = 0;
  for (const m of text.match(STRING_LITERAL_RE) ?? []) {
    const inner = m.slice(1, -1);
    if (classStringViolates(inner)) n++;
  }
  return n;
}

/** Compare current per-file counts to the baseline (same contract as text-scale). */
export function compareToBaseline(counts, baseline) {
  const violations = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) violations.push({ file, count, allowed });
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file));
}

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

export function scanTree(rootAbs, repoRoot = REPO_ROOT) {
  const counts = {};
  for (const file of collectFiles(rootAbs)) {
    const n = countSeparationViolations(readFileSync(file, "utf8"));
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
        "✖ separation --update would RAISE the ceiling for:\n" +
          raised.map((v) => `  ${v.file}  ${v.allowed} → ${v.count}`).join("\n") +
          "\nThe ratchet only goes down. If the combination is genuinely not redundant, re-run with --force.",
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(pkgCounts, null, 2) + "\n");
    const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
    console.log(
      `✔ separation baseline updated: ${Object.keys(pkgCounts).length} files, ${total} co-occurrence(s).`,
    );
    return;
  }

  const violations = compareToBaseline(pkgCounts, baseline);
  const regTotal = Object.values(registryCounts).reduce((a, b) => a + b, 0);
  if (regTotal > 0) {
    console.warn(
      `⚠ separation (registry, warn-only): ${regTotal} border+fill co-occurrence(s) in copy-own blocks.`,
    );
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ separation" : "✖ separation gate FAILED";
    console.error(`\n${label} — bare \`border\` stacked on a non-default fill (new occurrences):`);
    for (const v of violations) {
      console.error(`  ${v.file} — ${v.count} co-occurrence(s), baseline allows ${v.allowed}`);
    }
    console.error(
      "\nEach region owns ONE focal separation gesture (#187, research 08): fill OR\n" +
        "rail OR elevation OR a single divider — a border on an already-filled region\n" +
        "is redundant unless it is the sole structural cue (then keep `border` and\n" +
        "drop the fill, or use `border-strong`). Rails (`border-s-*`) and axis\n" +
        "dividers (`border-t` …) are fine. See .claude/rules/styling-and-tokens.md\n" +
        "(Surface separation).",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
  if (!warnOnly) {
    console.log(`✔ separation: no new border+fill co-occurrences (${total} baselined).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
