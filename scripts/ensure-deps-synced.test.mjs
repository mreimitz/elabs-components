// scripts/ensure-deps-synced.test.mjs — self-test for the deps-sync hook helper.
// Proves the lockfile-change detection and skip logic can't silently rot, per
// .claude/rules/quality-gates.md ("Self-tested gates"). Runs with `node --test`
// (`pnpm deps-sync:test`); needs `git` but no network / node_modules.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockfileChanged, shouldSkip } from "./ensure-deps-synced.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Build a throwaway repo; return { dir, A, B, C } refs and a cleanup fn. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "deps-sync-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t.t");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "commit.gpgsign", "false");

  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9'\n# v1\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "A: initial lockfile");
  const A = git(dir, "rev-parse", "HEAD");

  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9'\n# v2 — added a dep\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "B: change lockfile");
  const B = git(dir, "rev-parse", "HEAD");

  // C changes an unrelated file, leaving the lockfile identical to B.
  writeFileSync(join(dir, "README.md"), "hello\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "C: unrelated change");
  const C = git(dir, "rev-parse", "HEAD");

  return { dir, A, B, C, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("detects a lockfile change across refs", () => {
  const { dir, A, B, cleanup } = makeRepo();
  try {
    assert.equal(lockfileChanged(A, B, dir), true);
  } finally {
    cleanup();
  }
});

test("reports no change when the lockfile is untouched between refs", () => {
  const { dir, B, C, cleanup } = makeRepo();
  try {
    assert.equal(lockfileChanged(B, C, dir), false, "B→C only touched README");
  } finally {
    cleanup();
  }
});

test("no-op guards: identical, empty, and all-zeros refs", () => {
  const { dir, A, B, cleanup } = makeRepo();
  try {
    assert.equal(lockfileChanged(B, B, dir), false, "identical refs");
    assert.equal(lockfileChanged("", B, dir), false, "missing old ref");
    assert.equal(lockfileChanged(A, "", dir), false, "missing new ref");
    assert.equal(lockfileChanged("0".repeat(40), B, dir), false, "fresh clone / worktree add");
  } finally {
    cleanup();
  }
});

test("an unknown ref is treated as no-op, not a crash", () => {
  const { dir, A, cleanup } = makeRepo();
  try {
    assert.equal(lockfileChanged(A, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", dir), false);
  } finally {
    cleanup();
  }
});

test("shouldSkip honors CI and the opt-out env var", () => {
  assert.equal(shouldSkip({}), null);
  assert.equal(shouldSkip({ CI: "true" }), "CI");
  assert.equal(shouldSkip({ BRAND_UI_SKIP_AUTO_INSTALL: "1" }), "BRAND_UI_SKIP_AUTO_INSTALL");
});
