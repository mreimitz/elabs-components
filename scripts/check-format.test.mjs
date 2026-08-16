/**
 * check-format.test.mjs — self-test for the `pnpm format:check` gate (#239).
 * Run in CI: `node --test scripts/check-format.test.mjs` (`pnpm format:check:test`).
 *
 * A gate that can silently stop firing is worse than none (quality-gates.md,
 * "Self-tested gates"). `format:check` is a thin wrapper over `prettier --check .`
 * (see package.json) — this locks that the underlying mechanism actually detects
 * unformatted content and clears once formatted, using an isolated temp fixture
 * (never the whole repo, so this stays fast and hermetic; the CI `format:check`
 * step already covers the real tree).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const PRETTIER = join(REPO_ROOT, "node_modules", ".bin", "prettier");

/** Run `prettier --check <file>` from a sandbox dir carrying the repo's own
 * `.prettierrc.json` (so the self-test exercises the SAME config `format:check`
 * uses, not Prettier's bare defaults). Returns { status, stdout, stderr }. */
function prettierCheck(dir, file) {
  try {
    const stdout = execFileSync(PRETTIER, ["--check", file], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-format-"));
  const cfg = join(REPO_ROOT, ".prettierrc.json");
  if (existsSync(cfg)) cpSync(cfg, join(dir, ".prettierrc.json"));
  return dir;
}

test("FLAGS: an unformatted file — prettier --check exits non-zero and names it", () => {
  const dir = makeSandbox();
  try {
    // Inconsistent quotes/spacing/missing semicolon — violates the repo's
    // singleQuote:false / semi:true / printWidth:100 config.
    const file = "bad.ts";
    writeFileSync(join(dir, file), "export const x = { a:1,   b :  'two' }\n");
    const result = prettierCheck(dir, file);
    assert.notEqual(result.status, 0, "prettier --check must fail on unformatted input");
    assert.match(result.stderr + result.stdout, /bad\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PASSES: the same file, formatted, exits zero", () => {
  const dir = makeSandbox();
  try {
    const file = "good.ts";
    writeFileSync(join(dir, file), 'export const x = { a: 1, b: "two" };\n');
    const result = prettierCheck(dir, file);
    assert.equal(result.status, 0, "prettier --check must pass on already-formatted input");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("round-trip: format the bad fixture, then it passes", () => {
  const dir = makeSandbox();
  try {
    const file = "roundtrip.ts";
    writeFileSync(join(dir, file), "export const x = { a:1,   b :  'two' }\n");
    assert.notEqual(prettierCheck(dir, file).status, 0);
    execFileSync(PRETTIER, ["--write", file], { cwd: dir, stdio: "ignore" });
    assert.equal(prettierCheck(dir, file).status, 0, "must pass after prettier --write");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
