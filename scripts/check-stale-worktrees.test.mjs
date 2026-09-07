#!/usr/bin/env node
/**
 * check-stale-worktrees.test.mjs — self-test for the stale-worktree gate
 * (pnpm worktrees:check:test).
 *
 * Per .claude/rules/quality-gates.md § "Enforcement over reminders", a gate is
 * only real if a planted BAD fixture actually fails it. So this builds throwaway
 * git repos on disk and runs the gate's `main()` against them: a landed-and-
 * clean worktree must fail, and every "still working" shape must pass. The pure
 * classifier is table-tested alongside, because that is where the safety rule
 * lives (never ask for a deletion we cannot prove is safe).
 */
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { classifyWorktree, main } from "./check-stale-worktrees.mjs";

const created = [];
after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
}

/** A repo with one commit on `main` and a `.claude/worktrees/` directory. */
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "stale-worktrees-"));
  created.push(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  writeFileSync(join(root, "README.md"), "# fixture\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "initial");
  mkdirSync(join(root, ".claude", "worktrees"), { recursive: true });
  return root;
}

/** Add a unit worktree on its own branch, with one commit of its own. */
function addUnit(root, name, { commit = true } = {}) {
  const path = join(root, ".claude", "worktrees", name);
  git(root, "worktree", "add", "-b", `agents/${name}`, path);
  if (commit) {
    writeFileSync(join(path, `${name}.txt`), "work\n");
    git(path, "add", "-A");
    git(path, "commit", "-m", `work for ${name}`);
  }
  return path;
}

/** Run the gate against `root`, capturing what it printed. */
function runGate(root) {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    return { code: main(["--root", root]), output: errors.join("\n") };
  } finally {
    console.error = original;
  }
}

describe("classifyWorktree", () => {
  it("calls a landed, clean worktree stale", () => {
    assert.equal(
      classifyWorktree({ registered: true, merged: true, dirty: false }).stale,
      true,
      "a merged branch with a clean tree has nothing left to do",
    );
  });

  it("leaves a worktree with unmerged commits alone", () => {
    assert.equal(classifyWorktree({ registered: true, merged: false, dirty: false }).stale, false);
  });

  it("leaves a dirty worktree alone even once its branch has landed", () => {
    assert.equal(
      classifyWorktree({ registered: true, merged: true, dirty: true }).stale,
      false,
      "uncommitted work is exactly what must never be deleted on a gate's say-so",
    );
  });

  it("calls an unregistered leftover directory stale", () => {
    assert.equal(classifyWorktree({ registered: false, merged: null, dirty: false }).stale, true);
  });

  it("leaves anything it could not read alone", () => {
    assert.equal(classifyWorktree({ registered: true, merged: null, dirty: null }).stale, false);
    assert.equal(classifyWorktree({ registered: true, merged: null, dirty: false }).stale, false);
  });
});

describe("the gate, against real repos", () => {
  it("passes when there is no worktrees directory at all (CI's shape)", () => {
    const root = makeRepo();
    rmSync(join(root, ".claude"), { recursive: true, force: true });
    assert.equal(runGate(root).code, 0);
  });

  it("passes while a wave is genuinely in flight", () => {
    const root = makeRepo();
    addUnit(root, "fix-in-flight");
    const { code } = runGate(root);
    assert.equal(code, 0, "a unit branch with an unmerged commit is live work");
  });

  it("FAILS on the planted bad fixture: a unit whose branch has landed", () => {
    const root = makeRepo();
    addUnit(root, "fix-landed");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-landed");

    const { code, output } = runGate(root);
    assert.equal(code, 1, "a landed, clean worktree must fail the gate");
    assert.match(output, /stale-worktrees gate FAILED/);
    assert.match(output, /fix-landed/);
    assert.match(output, /git worktree remove/, "the failure has to say how to fix itself");
    assert.match(output, /git branch -d agents\/fix-landed/);
  });

  it("keeps quiet about a landed unit that still has uncommitted changes", () => {
    const root = makeRepo();
    const path = addUnit(root, "fix-landed-dirty");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-landed-dirty");
    writeFileSync(join(path, "scratch.txt"), "not committed\n");

    assert.equal(runGate(root).code, 0, "never ask for a directory with unsaved work in it");
  });

  it("FAILS on a leftover directory git no longer tracks", () => {
    const root = makeRepo();
    addUnit(root, "fix-orphan");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-orphan");
    // Deregister it the way a half-finished teardown does: git forgets the
    // worktree, the directory stays behind.
    git(root, "worktree", "remove", "--force", join(root, ".claude", "worktrees", "fix-orphan"));
    mkdirSync(join(root, ".claude", "worktrees", "fix-orphan"), { recursive: true });

    const { code, output } = runGate(root);
    assert.equal(code, 1);
    assert.match(output, /no longer a registered git worktree/);
  });

  it("reports every stale unit in one run, not just the first", () => {
    const root = makeRepo();
    addUnit(root, "fix-one");
    addUnit(root, "fix-two");
    git(root, "merge", "--no-ff", "-m", "merge one", "agents/fix-one");
    git(root, "merge", "--no-ff", "-m", "merge two", "agents/fix-two");

    const { code, output } = runGate(root);
    assert.equal(code, 1);
    assert.match(output, /2 orchestration worktree\(s\)/);
    assert.match(output, /fix-one/);
    assert.match(output, /fix-two/);
  });
});
