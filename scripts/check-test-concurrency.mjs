#!/usr/bin/env node
/**
 * check-test-concurrency.mjs — outer-parallelism gate (#80).
 *
 * `pnpm test` → `turbo run test` has no outer concurrency bound, so turbo fans out
 * to one `vitest run` invocation per package with a `test` script (13 today). Each
 * of those independently sizes its own worker pool from
 * `os.availableParallelism()` — every invocation assumes it owns the whole
 * machine. On a 4-vCPU box that is ~10x CPU oversubscription, and it is why a
 * full-suite failure "rotated" run to run instead of looking like one flaky spec:
 * any wall-clock-bounded assertion across the whole suite can lose its margin
 * simultaneously, and WHICH test loses depends on scheduling noise.
 *
 * This gate asserts the root `test` script bounds turbo's own fan-out — either an
 * explicit `--concurrency=<int>` flag on the `turbo run test` invocation, or a
 * non-empty `TURBO_CONCURRENCY` env var (turbo reads either). Do NOT "fix" a red
 * run here by raising a vitest `testTimeout` — that budgets for the contention
 * instead of removing it, which is exactly what issue #80 rejects (see #83,
 * superseded by #80 for this reason).
 *
 * Run via `pnpm test-concurrency:check`; self-tested via `pnpm test-concurrency:check:test`.
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root
const PKG_JSON = join(REPO_ROOT, "package.json");

/**
 * Check one `test` npm-script string (+ optional env) for an explicit turbo
 * concurrency bound. Pure — exported so the self-test can drive it with
 * in-memory fixtures instead of the real package.json.
 *
 * @param {unknown} script - the root package.json `scripts.test` value.
 * @param {Record<string, string | undefined>} env - process.env (or a fixture).
 * @returns {string[]} findings; empty means the gate passes.
 */
export function checkTestScript(script, env = {}) {
  if (typeof script !== "string" || script.trim() === "") {
    return [
      `root package.json "scripts.test" is missing or not a string (got: ${JSON.stringify(script)})`,
    ];
  }
  if (!/\bturbo\s+run\s+test\b/.test(script)) {
    return [
      `root package.json "test" script ("${script}") does not invoke \`turbo run test\` — ` +
        "this gate assumes turbo is the outer parallelism layer; update the gate if that changed.",
    ];
  }

  const hasFlag = /--concurrency(=|\s+)\S+/.test(script);
  const hasEnv = typeof env.TURBO_CONCURRENCY === "string" && env.TURBO_CONCURRENCY.trim() !== "";

  if (hasFlag || hasEnv) return [];

  return [
    `root package.json "test" script ("${script}") has no explicit turbo concurrency bound — ` +
      "add `--concurrency=<int>` to the script (or set TURBO_CONCURRENCY). Unbounded " +
      "`turbo run test` fans out one vitest invocation per package, and every invocation " +
      "independently saturates the host's CPU — see issue #80.",
  ];
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  if (!existsSync(PKG_JSON)) {
    console.error(`✖ test-concurrency: cannot find ${PKG_JSON}`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
  const script = pkg.scripts?.test;
  const findings = checkTestScript(script, process.env);
  if (findings.length) {
    console.error(`✖ test-concurrency (${findings.length}):`);
    for (const f of findings) console.error("  - " + f);
    process.exit(1);
  } else {
    console.log(`✔ test-concurrency: root "test" script bounds turbo's fan-out ("${script}").`);
  }
}
