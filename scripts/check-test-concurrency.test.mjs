/**
 * check-test-concurrency.test.mjs — locks the #80 outer-parallelism gate.
 * Run in CI: `node --test scripts/check-test-concurrency.test.mjs`.
 *
 * Two halves, per the brief's verbatim "Test to add" #1 (plant a root
 * package.json whose `test` script is a bare `turbo run test`, assert the gate
 * EXITS NON-ZERO; plant one carrying `--concurrency=1`, assert it exits zero):
 *   - the pure `checkTestScript` function, driven with in-memory strings
 *     (fast, exhaustive over the matching logic);
 *   - the CLI itself (`main`/the `node check-test-concurrency.mjs --root <dir>`
 *     subprocess), spawned against a PLANTED package.json on disk and asserted
 *     on its real exit code — this is the arm that actually runs in CI, and a
 *     self-test that only drives the pure function cannot notice the CLI's own
 *     wiring (the `--root` flag, the `existsSync` guard, the `pkg.scripts?.test`
 *     read, the process exit code) silently breaking. Fixture shape mirrors
 *     scripts/check-worktree-branch.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkTestScript, main } from "./check-test-concurrency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, "check-test-concurrency.mjs");

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

// ── CLI (check-test-concurrency.mjs --root <dir>): a real subprocess, isolated fixtures ──

function plantPkg(dir, testScript) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ scripts: { test: testScript } }, null, 2),
  );
}

test("CLI: bare `turbo run test` — real subprocess exits non-zero (the #80 regression shape)", () => {
  const dir = mkdtempSync(join(tmpdir(), "test-concurrency-cli-bare-"));
  try {
    plantPkg(dir, "turbo run test");
    assert.throws(() => {
      execFileSync("node", [GATE, "--root", dir], { encoding: "utf8", stdio: "pipe" });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: `--concurrency=1` — real subprocess exits zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "test-concurrency-cli-bounded-"));
  try {
    plantPkg(dir, "turbo run test --concurrency=1");
    // Would throw on non-zero exit — the assertion IS that this does not throw.
    const out = execFileSync("node", [GATE, "--root", dir], { encoding: "utf8" });
    assert.match(out, /bounds turbo's fan-out/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: no package.json at --root — real subprocess exits non-zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "test-concurrency-cli-missing-"));
  try {
    assert.throws(() => {
      execFileSync("node", [GATE, "--root", dir], { encoding: "utf8", stdio: "pipe" });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: TURBO_CONCURRENCY in the spawned environment satisfies a bare script", () => {
  const dir = mkdtempSync(join(tmpdir(), "test-concurrency-cli-env-"));
  try {
    plantPkg(dir, "turbo run test");
    const spawnEnv = Object.assign({}, process.env, { TURBO_CONCURRENCY: "2" });
    const out = execFileSync("node", [GATE, "--root", dir], {
      encoding: "utf8",
      env: spawnEnv,
    });
    assert.match(out, /bounds turbo's fan-out/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── main(argv, env) in-process: same CLI entry point, no subprocess overhead ──

test("main(): returns 1 for a bare script, 0 once bounded, against a planted --root", () => {
  const dir = mkdtempSync(join(tmpdir(), "test-concurrency-main-"));
  try {
    plantPkg(dir, "turbo run test");
    assert.equal(main(["--root", dir], {}), 1);
    plantPkg(dir, "turbo run test --concurrency=1");
    assert.equal(main(["--root", dir], {}), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
