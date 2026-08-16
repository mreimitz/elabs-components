#!/usr/bin/env node
/**
 * check-tokens-fresh.mjs — DTCG ⇄ themes.css freshness gate (WP-04 #61).
 *
 * Asserts that `packages/tokens/src/themes.css` is IN SYNC with the DTCG token
 * source under `packages/tokens/tokens/`: it computes what `tokens:build` WOULD
 * produce (the pure assembler, in memory — it does NOT write the real file) and
 * diffs that against the committed themes.css. Any difference → the file is
 * stale vs the DTCG values → exit 1.
 *
 * This is the anti-drift teeth: editing a token value in the DTCG JSON without
 * re-running the build (or hand-editing a synced value in themes.css) is caught
 * before it ships, exactly like the manifest / theme-parity stale-gates.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints the finding.
 *
 * Dependency-free apart from the in-package assembler; ESM; cwd-independent.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const THEMES_CSS = join(REPO_ROOT, "packages", "tokens", "src", "themes.css");
const ASSEMBLER = join(REPO_ROOT, "packages", "tokens", "scripts", "build-themes-css.mjs");

/**
 * Compute the would-be themes.css from the DTCG source WITHOUT writing it.
 * @returns {Promise<{ current: string, expected: string }>}
 */
export async function computeFreshness() {
  const { assembleFromSource } = await import(`file://${ASSEMBLER}`);
  const current = readFileSync(THEMES_CSS, "utf8");
  const expected = await assembleFromSource(current);
  return { current, expected };
}

/** First differing line (1-based) between two strings, or null if identical. */
function firstDiff(a, b) {
  if (a === b) return null;
  const al = a.split("\n");
  const bl = b.split("\n");
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i])
      return { line: i + 1, current: al[i] ?? "<EOF>", expected: bl[i] ?? "<EOF>" };
  }
  return { line: n, current: "<len>", expected: "<len>" };
}

// ───────────────────────────────── CLI ────────────────────────────────────────
async function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");

  let current, expected;
  try {
    ({ current, expected } = await computeFreshness());
  } catch (e) {
    console.error(`✖ tokens-fresh gate: failed to run the assembler: ${e.message}`);
    if (!warnOnly) process.exitCode = 1;
    return;
  }

  if (current === expected) {
    if (!warnOnly) console.log("✔ tokens-fresh: themes.css is in sync with the DTCG token source.");
    return;
  }

  const d = firstDiff(expected, current);
  const label = warnOnly ? "⚠ tokens-fresh" : "✖ tokens-fresh gate FAILED";
  console.error(`\n${label}: themes.css is stale vs the DTCG source.`);
  if (d) {
    console.error(`  first divergence at line ${d.line}:`);
    console.error(`    committed: ${d.current}`);
    console.error(`    expected : ${d.expected}`);
  }
  console.error(
    "\nthemes.css is stale vs the DTCG source — run " +
      "`pnpm --filter @qlik-coe-emea/qlabs-components-tokens tokens:build`\n" +
      "(then commit the regenerated themes.css). The token VALUES live in\n" +
      "packages/tokens/tokens/themes/<theme>.tokens.json; the file STRUCTURE is\n" +
      "hand-authored. See WP-04 / issue #61.",
  );
  if (!warnOnly) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.argv);
}
