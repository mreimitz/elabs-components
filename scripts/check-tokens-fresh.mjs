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
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const ASSEMBLER = join(REPO_ROOT, "packages", "tokens", "scripts", "build-themes-css.mjs");

/**
 * Compute the would-be content of EVERY theme stylesheet from the DTCG source
 * WITHOUT writing any of them. Since ADR 0029 that is the engine stylesheet plus
 * one file per reference theme, so the gate reports per file.
 *
 * @returns {Promise<Array<{ path: string, current: string, expected: string }>>}
 */
export async function computeFreshness() {
  const { assembleAllSources } = await import(`file://${ASSEMBLER}`);
  const sources = await assembleAllSources();
  // Anti-vacuity: no sources means nothing was compared and the gate would pass.
  if (sources.length === 0) {
    throw new Error("assembleAllSources() returned no theme stylesheets to compare");
  }
  return sources;
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

  let sources;
  try {
    sources = await computeFreshness();
  } catch (e) {
    console.error(`✖ tokens-fresh gate: failed to run the assembler: ${e.message}`);
    if (!warnOnly) process.exitCode = 1;
    return;
  }

  const stale = sources.filter((s) => s.current !== s.expected);
  if (stale.length === 0) {
    if (!warnOnly) {
      console.log(
        `✔ tokens-fresh: all ${sources.length} theme stylesheets are in sync with the DTCG token source.`,
      );
    }
    return;
  }

  const label = warnOnly ? "⚠ tokens-fresh" : "✖ tokens-fresh gate FAILED";
  console.error(`\n${label}: ${stale.length} theme stylesheet(s) stale vs the DTCG source.`);
  for (const s of stale) {
    const d = firstDiff(s.expected, s.current);
    console.error(`  ${relative(REPO_ROOT, s.path)}`);
    if (d) {
      console.error(`    first divergence at line ${d.line}:`);
      console.error(`      committed: ${d.current}`);
      console.error(`      expected : ${d.expected}`);
    }
  }
  console.error(
    "\nRun `pnpm --filter @elabs-ai/components-tokens tokens:build` (then commit the\n" +
      "regenerated stylesheets). The token VALUES live in\n" +
      "packages/tokens/tokens/themes/<theme>.tokens.json; the file STRUCTURE is\n" +
      "hand-authored. Since ADR 0029 the reference themes live in\n" +
      "packages/tokens/src/themes/<theme>.css, not in themes.css. See WP-04 / issue #61.",
  );
  if (!warnOnly) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.argv);
}
