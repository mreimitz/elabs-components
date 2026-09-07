#!/usr/bin/env node
/**
 * check-stale-worktrees.test.mjs — self-test for the stale-worktree gate
 * (pnpm worktrees:check:test).
 *
 * Per .claude/rules/quality-gates.md § "Enforcement over reminders", a gate is
 * only real if a planted BAD fixture actually fails it. So this builds throwaway
 * git repos on disk and runs the gate's `main()` against them.
 *
 * The shapes below are the ones review round 1 on PR #411 found the first cut
 * getting wrong, and each is now a fixture rather than a claim:
 *   - a SQUASH-merged unit (the path close-issues Phase 4 actually takes) must
 *     fail — reachability alone reports it as still live;
 *   - a FRESHLY CREATED unit must pass — its branch points at the integration
 *     ref, so "ahead by nothing" is true from its first second;
 *   - an unregistered directory WITH FILES in it must pass — `git status` run
 *     inside one answers for the primary repo, which ignores
 *     `.claude/worktrees/`, so it reads as clean while holding unsaved work;
 *   - an orphan's remediation line must be one that actually works on it.
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
  // Mirrors the real repo: the orchestrator's marker is ignored, never committed.
  writeFileSync(join(root, ".gitignore"), ".expected-branch\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "initial");
  mkdirSync(join(root, ".claude", "worktrees"), { recursive: true });
  return root;
}

/** Add a unit worktree on its own branch, with `commits` commits of its own. */
function addUnit(root, name, { commits = 1 } = {}) {
  const path = join(root, ".claude", "worktrees", name);
  git(root, "worktree", "add", "-b", `agents/${name}`, path);
  for (let i = 0; i < commits; i++) {
    writeFileSync(join(path, `${name}-${i}.txt`), "work\n");
    git(path, "add", "-A");
    git(path, "commit", "-m", `work ${i} for ${name}`);
  }
  // The orchestrator's marker, written AFTER the commits and never committed —
  // in the real repo `.gitignore` covers `.claude/worktrees/`, so it is an
  // untracked file that must not count as a dirty tree.
  writeFileSync(join(path, ".expected-branch"), `agents/${name}\n`);
  return path;
}

/** Land a unit the way close-issues Phase 4 does: SQUASH, not a merge commit. */
function squashMerge(root, unit) {
  git(root, "merge", "--squash", `agents/${unit}`);
  git(root, "commit", "-m", `fix: ${unit} (#000)`);
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
    const v = classifyWorktree({ registered: true, landed: true, dirty: false, empty: null });
    assert.equal(v.stale, true);
    assert.equal(v.kind, "worktree");
  });

  it("leaves a worktree whose work has not landed alone", () => {
    assert.equal(
      classifyWorktree({ registered: true, landed: false, dirty: false, empty: null }).stale,
      false,
    );
  });

  it("leaves a dirty worktree alone even once its work has landed", () => {
    assert.equal(
      classifyWorktree({ registered: true, landed: true, dirty: true, empty: null }).stale,
      false,
      "uncommitted work is exactly what must never be deleted on a gate's say-so",
    );
  });

  it("calls an EMPTY unregistered directory stale, and nothing else about it", () => {
    const v = classifyWorktree({ registered: false, landed: null, dirty: null, empty: true });
    assert.equal(v.stale, true);
    assert.equal(v.kind, "orphan", "an orphan cannot be removed with `git worktree remove`");
  });

  it("leaves an unregistered directory that still holds files alone", () => {
    assert.equal(
      classifyWorktree({ registered: false, landed: null, dirty: null, empty: false }).stale,
      false,
      "git cannot report cleanliness for an unregistered, gitignored directory",
    );
  });

  it("leaves anything it could not read alone", () => {
    assert.equal(
      classifyWorktree({ registered: true, landed: null, dirty: null, empty: null }).stale,
      false,
    );
    assert.equal(
      classifyWorktree({ registered: true, landed: null, dirty: false, empty: null }).stale,
      false,
    );
    assert.equal(
      classifyWorktree({ registered: false, landed: null, dirty: null, empty: null }).stale,
      false,
    );
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
    assert.equal(runGate(root).code, 0, "a unit branch with an unmerged commit is live work");
  });

  it("passes for a unit that was just created and has not committed yet", () => {
    const root = makeRepo();
    addUnit(root, "fix-fresh", { commits: 0 });
    const { code, output } = runGate(root);
    assert.equal(
      code,
      0,
      `a fresh unit branch points AT the integration ref, so "ahead by nothing" ` +
        `must not be read as landed:\n${output}`,
    );
  });

  it("FAILS on the planted bad fixture: a unit merged with a merge commit", () => {
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

  it("FAILS on a SQUASH-merged unit — the path close-issues actually takes", () => {
    const root = makeRepo();
    addUnit(root, "fix-squashed", { commits: 2 });
    squashMerge(root, "fix-squashed");

    // Reachability alone says this unit is still live; that is the bug.
    assert.notEqual(
      git(root, "rev-list", "--count", "main..agents/fix-squashed"),
      "0",
      "fixture check: a squash merge leaves the unit commits unreachable from main",
    );

    const { code, output } = runGate(root);
    assert.equal(code, 1, `a squash-merged unit must fail the gate:\n${output}`);
    assert.match(output, /fix-squashed/);
  });

  it("keeps quiet about a landed unit that still has uncommitted changes", () => {
    const root = makeRepo();
    const path = addUnit(root, "fix-landed-dirty");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-landed-dirty");
    writeFileSync(join(path, "scratch.txt"), "not committed\n");

    assert.equal(runGate(root).code, 0, "never ask for a directory with unsaved work in it");
  });

  it("FAILS on an EMPTY leftover directory git no longer tracks, with a command that works", () => {
    const root = makeRepo();
    addUnit(root, "fix-orphan");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-orphan");
    git(root, "worktree", "remove", "--force", join(root, ".claude", "worktrees", "fix-orphan"));
    mkdirSync(join(root, ".claude", "worktrees", "fix-orphan"), { recursive: true });

    const { code, output } = runGate(root);
    assert.equal(code, 1);
    assert.match(output, /no longer tracks as a worktree/);
    assert.match(
      output,
      /rmdir .*fix-orphan/,
      "`git worktree remove` refuses a path it does not know — the printed command must work",
    );
    assert.doesNotMatch(output, /git worktree remove .*fix-orphan/);
  });

  it("keeps quiet about an untracked directory that still holds files", () => {
    const root = makeRepo();
    addUnit(root, "fix-orphan-files");
    git(root, "merge", "--no-ff", "-m", "merge unit", "agents/fix-orphan-files");
    const path = join(root, ".claude", "worktrees", "fix-orphan-files");
    git(root, "worktree", "remove", "--force", path);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "important.txt"), "hours of unsaved work\n");

    const { code, output } = runGate(root);
    assert.equal(
      code,
      0,
      `\`git status\` inside an unregistered, gitignored directory answers for the PRIMARY ` +
        `repo and reads clean — emptiness is the only real evidence:\n${output}`,
    );
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
