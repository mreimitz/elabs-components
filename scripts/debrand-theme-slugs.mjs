#!/usr/bin/env node
/**
 * debrand-theme-slugs.mjs — one-shot codemod: theme slugs lose the brand.
 *
 *   qlik-bright → light
 *   qlik-dark   → dark
 *
 * plus every cased form the repo actually uses (verified by enumeration, not
 * guessed): the PascalCase story-export suffix (`…QlikDark` → `…Dark`), the
 * display labels (`Qlik Bright`/`Qlik Dark`), the shouted section headers in
 * `themes.css` (`QLIK BRIGHT`), and the spaced lowercase form in two
 * theme-switcher test matchers (`/qlik dark/i`).
 *
 * ## Why a token codemod and not a name map
 *
 * Same rule as `debrand-scope.mjs`: rewrite the TOKEN uniformly, everywhere,
 * rather than enumerating the places it appears. A per-file map is what leaves a
 * `startsWith(...)` prefix check matching nothing, so a gate passes vacuously —
 * the failure this repo has already shipped once.
 *
 * ## Two things this codemod deliberately does NOT do
 *
 * 1. **Filenames.** `tokens/themes/qlik-{bright,dark}.tokens.json` carry the slug
 *    in their NAME. `git mv` them separately — a content codemod cannot.
 * 2. **The `:root` sentinel.** The mode key for the neutral base was renamed
 *    `light` → `root` FIRST, in a separate step, because `light` is the new slug
 *    for the bright theme and a colliding sentinel makes `locateBlock()` resolve
 *    the light theme's block to `:root`. If that step has not run, stop.
 *
 * ## What is NOT a risk, despite appearances
 *
 * Naming a theme `dark` does not activate Tailwind's `dark:` variant for the
 * first time. `themes.css` defines `@custom-variant dark` against an explicit
 * SELECTOR list (`[data-theme="qlik-dark"]`, `[data-theme="blueprint"]`), not
 * against the theme's name — so every `dark:` utility in the tree already fires
 * under the dark theme today. This codemod only edits the selector string.
 *
 * Re-running is a no-op: nothing matches the old slugs any more.
 *
 * Usage:  node scripts/debrand-theme-slugs.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Assembled from fragments so this file cannot rewrite its own constants if the
// skip-self guard below is ever removed.
const Q = "Q" + "lik";
const q = "q" + "lik";
const QQ = "Q" + "LIK";

const DRY = process.argv.includes("--dry-run");

/**
 * [needle, replacement], longest/most-specific first. Every entry was derived by
 * enumerating the real occurrences (`rg -io 'qlik[-_ ]?(bright|dark)'`), so this
 * list is exhaustive for the tree as it stands rather than a guess at casings.
 */
const STEPS = [
  [`${q}-bright`, "light"],
  [`${q}-dark`, "dark"],
  [`${Q}Bright`, "Light"], // PascalCase story-export suffix
  [`${Q}Dark`, "Dark"],
  [`${Q} Bright`, "Light"], // display label / prose
  [`${Q} Dark`, "Dark"],
  [`${QQ} BRIGHT`, "LIGHT"], // themes.css section headers
  [`${QQ} DARK`, "DARK"],
  [`${q} bright`, "light"], // test matchers: /qlik dark/i
  [`${q} dark`, "dark"],
];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "release",
  "storybook-static",
  "coverage",
  ".turbo",
  "__output",
  ".next",
  "fonts",
]);

// This file documents the rename, so its prose quotes the OLD slugs on purpose.
const SKIP_FILES = new Set(["pnpm-lock.yaml", "debrand-theme-slugs.mjs"]);
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|yml|yaml|txt|sh|html)$/;

export function rewrite(text) {
  let out = text;
  for (const [needle, replacement] of STEPS) out = out.split(needle).join(replacement);
  return out;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(entry) && !SKIP_FILES.has(entry)) out.push(full);
  }
  return out;
}

let files = 0;
let hits = 0;

for (const file of walk(REPO_ROOT)) {
  const before = readFileSync(file, "utf8");
  if (!before.includes(q) && !before.includes(Q) && !before.includes(QQ)) continue;
  const after = rewrite(before);
  if (after === before) continue;

  // Count replacements so the run reports work done, not files opened.
  let n = 0;
  for (const [needle] of STEPS) n += before.split(needle).length - 1;
  files += 1;
  hits += n;
  if (!DRY) writeFileSync(file, after, "utf8");
  process.stdout.write(`  ${n.toString().padStart(4)}  ${relative(REPO_ROOT, file)}\n`);
}

process.stdout.write(
  `\n${DRY ? "(dry run) " : ""}theme slugs: ${hits} occurrence(s) across ${files} file(s).\n` +
    "Filenames are NOT covered — `git mv` tokens/themes/qlik-*.tokens.json separately.\n",
);
