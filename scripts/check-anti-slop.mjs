#!/usr/bin/env node
/**
 * check-anti-slop.mjs — content anti-slop ratchet (WP-15 #107, research 09).
 *
 * The "Jane Doe effect": shipped component source should not bake in generic
 * placeholder names ("John Doe"), fake-perfect numbers ("99.99%"), or startup-
 * slop brand names ("Acme"/"Nexus"/"SmartFlow"/"Cloudly"). Brand identity lives
 * in tokens + the logo; sample copy should use real, domain-specific content.
 *
 * This is the TEETH for the taste-skill's content catalog (the read-only
 * `brand-ui audit` only *reports* it). The slop patterns are imported from
 * `packages/cli/lib/audit.mjs` (`CONTENT_SLOP_RULES` / `countContentSlop`) so the
 * gate and the audit can never drift — ONE source of truth.
 *
 * Placeholder content is sometimes intentional (a few syntax-doc examples), so —
 * exactly like the type-scale (#187) and surface-separation (#187) gates — this
 * is a RATCHET, not a hard ban:
 *
 *   - the committed baseline (`scripts/anti-slop-baseline.json`, per-file counts)
 *     is the allowed ceiling — a file may only go DOWN or stay;
 *   - any file whose count RISES, and any NEW file with slop, FAILS (new slop is
 *     blocked at the source);
 *   - `registry/` AND copy-own `**\/blocks/**` are WARN-only — copy-own blocks
 *     are expected to carry sample content and are owned downstream;
 *   - when counts drop, run `--update` to ratchet the baseline down (the gate
 *     refuses to ratchet UP via --update unless `--force` is also given).
 *
 * Scope: packages/*\/src/**\/*.{ts,tsx}, excluding *.test.* / *.stories.* (which
 * demo placeholder content deliberately) and copy-own `blocks/` and generated dirs.
 *
 * Flags: --warn (never exit non-zero) · --update (ratchet down) · --force
 * (allow --update to raise a ceiling, in the PR that justifies it).
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers exported for the self-test
 * (check-anti-slop.test.mjs / pnpm slop:check:test).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import {
  countContentSlop,
  findContentSlop,
  CONTENT_SLOP_RULES,
} from "../packages/cli/lib/audit.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "anti-slop-baseline.json");

// Re-exported for the self-test so it imports the same source of truth.
export { countContentSlop, findContentSlop, CONTENT_SLOP_RULES };

/** A copy-own block path (warn-only, like registry — sample content is expected). */
export const isBlockPath = (p) => /[/\\]blocks[/\\]/.test(p);

/**
 * Compare current per-file counts to the baseline (same contract as the
 * type-scale / separation ratchets).
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

/**
 * Scan a root dir → {relPath: count} for files with content slop > 0.
 * @param {string} rootAbs
 * @param {{ repoRoot?: string, predicate?: (absPath: string) => boolean }} [opts]
 *   predicate: keep a file iff it returns true (used to split gated vs blocks).
 */
export function scanTree(rootAbs, { repoRoot = REPO_ROOT, predicate } = {}) {
  const counts = {};
  for (const file of collectFiles(rootAbs)) {
    if (predicate && !predicate(file)) continue;
    const n = countContentSlop(readFileSync(file, "utf8"));
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

  // packages/*/src — gated (excluding copy-own blocks); registry + blocks — warn-only.
  const pkgsDir = join(REPO_ROOT, "packages");
  const pkgCounts = {};
  const blockCounts = {};
  for (const pkg of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    const src = join(pkgsDir, pkg, "src");
    if (!existsSync(src)) continue;
    Object.assign(pkgCounts, scanTree(src, { predicate: (p) => !isBlockPath(p) }));
    Object.assign(blockCounts, scanTree(src, { predicate: isBlockPath }));
  }
  const registryCounts = scanTree(join(REPO_ROOT, "registry"));

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};

  if (update) {
    const raised = compareToBaseline(pkgCounts, baseline);
    if (raised.length && !force) {
      console.error(
        "✖ anti-slop --update would RAISE the ceiling for:\n" +
          raised.map((v) => `  ${v.file}  ${v.allowed} → ${v.count}`).join("\n") +
          "\nThe ratchet only goes down. If the placeholder is genuinely intentional, re-run with --force.",
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(pkgCounts, null, 2) + "\n");
    const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
    console.log(
      `✔ anti-slop baseline updated: ${Object.keys(pkgCounts).length} files, ${total} occurrence(s).`,
    );
    return;
  }

  const violations = compareToBaseline(pkgCounts, baseline);

  const warnTotal =
    Object.values(registryCounts).reduce((a, b) => a + b, 0) +
    Object.values(blockCounts).reduce((a, b) => a + b, 0);
  if (warnTotal > 0) {
    console.warn(
      `⚠ anti-slop (registry + copy-own blocks, warn-only): ${warnTotal} placeholder-content ` +
        "occurrence(s) — fine for copy-own samples, but a real product name reads better.",
    );
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ anti-slop" : "✖ anti-slop gate FAILED";
    console.error(`\n${label} — content slop above the ratchet baseline (the "Jane Doe effect"):`);
    for (const v of violations) {
      console.error(`  ${v.file} — ${v.count} occurrence(s), baseline allows ${v.allowed}`);
      // Show WHAT matched so the fix is actionable (not just a count).
      const abs = join(REPO_ROOT, v.file);
      if (existsSync(abs)) {
        for (const hit of findContentSlop(readFileSync(abs, "utf8"))) {
          console.error(`      ${v.file}:${hit.line}  [${hit.id}] “${hit.match}” — ${hit.msg}`);
        }
      }
    }
    console.error(
      "\nThe brand lives in tokens + the logo, never in hardcoded sample copy. Use a\n" +
        "realistic, domain-specific name/number/brand instead of generic AI slop. The\n" +
        "baseline only ratchets DOWN; see skills/brand-ui-audit/reference/anti-patterns.md\n" +
        "(Content anti-slop) and scripts/anti-slop-baseline.json.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
  if (!warnOnly) {
    console.log(`✔ anti-slop: no new content slop (${total} baselined occurrence(s)).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
