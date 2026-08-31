/**
 * check-test-concurrency.test.mjs — locks the #80 outer-parallelism gate.
 * Run in CI: `node --test scripts/check-test-concurrency.test.mjs`.
 *
 * All fixtures are in-memory script strings (hermetic — never the real package.json).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTestScript } from "./check-test-concurrency.mjs";

test("FLAGS a bare `turbo run test` with no concurrency bound (the #80 regression shape)", () => {
  const findings = checkTestScript("turbo run test");
  assert.ok(findings.length > 0);
});

test("PASSES when the script carries an explicit --concurrency=<int> flag", () => {
  assert.deepEqual(checkTestScript("turbo run test --concurrency=1"), []);
});

test("PASSES with --concurrency=<int> in any position", () => {
  assert.deepEqual(checkTestScript("turbo run test --concurrency=4 --force"), []);
});

test("PASSES when TURBO_CONCURRENCY is set in the environment instead of the flag", () => {
  assert.deepEqual(checkTestScript("turbo run test", { TURBO_CONCURRENCY: "1" }), []);
});

test("FLAGS when TURBO_CONCURRENCY is present but empty", () => {
  const findings = checkTestScript("turbo run test", { TURBO_CONCURRENCY: "" });
  assert.ok(findings.length > 0);
});

test("FLAGS a script that does not even invoke `turbo run test`", () => {
  const findings = checkTestScript("vitest run");
  assert.ok(findings.length > 0);
});

test("FLAGS a missing/undefined script", () => {
  const findings = checkTestScript(undefined);
  assert.ok(findings.length > 0);
});
