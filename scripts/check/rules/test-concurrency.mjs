/**
 * test-concurrency — the root `test` script bounds turbo's outer fan-out (#80).
 * Ported from scripts/check-test-concurrency.mjs.
 *
 * Unbounded `turbo run test` starts one vitest per package, each sizing its worker pool to
 * the whole machine — ~10x CPU oversubscription on a small CI runner, which makes timing-bound
 * assertions fail "randomly". Never "fix" that by raising `testTimeout`.
 *
 * Deliberate narrowing vs the old script: the `TURBO_CONCURRENCY` env-var alternative is not
 * honoured (rules are hermetic and see files only) — the bound must be in the script.
 */
import { lineOf } from "../context.mjs";

/** Pure: findings for one `scripts.test` value (empty = bounded). */
export function checkTestScript(script) {
  if (typeof script !== "string" || script.trim() === "")
    return [`"scripts.test" is missing or not a string (got: ${JSON.stringify(script)})`];
  if (!/\bturbo\s+run\s+test\b/.test(script))
    return [
      `"test" script ("${script}") does not invoke \`turbo run test\` — this rule assumes turbo is the outer parallelism layer; update it if that changed`,
    ];
  if (/--concurrency(=|\s+)\S+/.test(script)) return [];
  return [
    `"test" script ("${script}") has no explicit turbo concurrency bound — add \`--concurrency=<int>\` (unbounded fan-out oversubscribes the CPU, #80)`,
  ];
}

const root = (test) => ({
  files: { "package.json": JSON.stringify({ scripts: test === undefined ? {} : { test } }) },
});

export default {
  id: "test-concurrency",
  scope: "repo",
  doc: "The root `test` script runs `turbo run test --concurrency=<int>`; never raise a vitest `testTimeout` to absorb CPU oversubscription (#80).",
  baseline: "none",
  run(ctx) {
    if (!ctx.exists("package.json"))
      return [{ file: "package.json", line: 1, msg: "root package.json not found" }];
    const text = ctx.readFile("package.json");
    const i = text.search(/"test"\s*:/);
    const line = i < 0 ? 1 : lineOf(text, i);
    return checkTestScript(JSON.parse(text).scripts?.test).map((msg) => ({
      file: "package.json",
      line,
      msg,
    }));
  },
  fixtures: {
    pass: [
      root("turbo run test --concurrency=1"),
      root("turbo run test --concurrency=4 --force"),
      root("turbo run test --concurrency 2"),
    ],
    fail: [root("turbo run test"), root("vitest run"), root(undefined), root(""), { files: {} }],
  },
};
