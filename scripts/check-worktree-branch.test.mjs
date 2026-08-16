// check-worktree-branch.test.mjs — self-test for the worktree-branch guard
// (#403). Incident: during the wave-3 /close-issues run, two independently-
// dispatched coder agents committed directly to `main` instead of their
// assigned isolated worktree/branch (stray commits b8bbed6 and 513a216 —
// caught and reverted, no residue). Per .claude/rules/quality-gates.md §
// "Enforcement over reminders", a must-always-hold invariant needs a
// mechanical guard, not a better sentence.
//
// Locks: (1) the pure comparison (`evaluateWorktreeBranch`) treats an absent
// marker as always-ok (the unmarked-worktree no-op) and flags a mismatch,
// naming both branches; (2) the CLI (`--root`) mirrors that at the process
// level; (3) end-to-end, the ACTUAL `.githooks/pre-commit` (as modified for
// #403) rejects a commit on the wrong branch inside a MARKED worktree and
// prints both branch names, while an UNMARKED worktree commits normally —
// exercising the real hook file, not a reimplementation.
//
// Run: node --test scripts/check-worktree-branch.test.mjs  (pnpm worktree-branch:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  copyFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  evaluateWorktreeBranch,
  evaluatePrimaryCheckoutGuard,
  findActiveOrchestrationUnits,
  resolveGitLayout,
  MAIN_COMMIT_OVERRIDE_ENV,
} from "./check-worktree-branch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

// ── evaluateWorktreeBranch: pure comparison logic ──────────────────────────

test("evaluateWorktreeBranch: no marker (null) is always ok — the unmarked-worktree no-op", () => {
  assert.deepEqual(evaluateWorktreeBranch(null, "main"), { ok: true });
});

test("evaluateWorktreeBranch: marker matches HEAD — ok", () => {
  assert.deepEqual(evaluateWorktreeBranch("agents/governance", "agents/governance"), { ok: true });
});

test("evaluateWorktreeBranch: marker names a DIFFERENT branch than HEAD — rejected, names both", () => {
  const result = evaluateWorktreeBranch("agents/governance", "main");
  assert.equal(result.ok, false);
  assert.equal(result.expectedBranch, "agents/governance");
  assert.equal(result.currentBranch, "main");
});

// ── evaluatePrimaryCheckoutGuard: pure PRIMARY-checkout comparison logic ───
// (Finding 4 of the wave-4 validation: the marker-only guard is inert in the
// PRIMARY checkout, which is exactly where the real stray commits happened.)

test("evaluatePrimaryCheckoutGuard: on a non-main branch — always ok, regardless of active units", () => {
  assert.deepEqual(
    evaluatePrimaryCheckoutGuard({
      currentBranch: "feature/x",
      activeUnits: ["agents/unitA"],
      overrideSet: false,
    }),
    { ok: true },
  );
});

test("evaluatePrimaryCheckoutGuard: on main, no active units anywhere — ok (the everyday, non-orchestrated case)", () => {
  assert.deepEqual(
    evaluatePrimaryCheckoutGuard({ currentBranch: "main", activeUnits: [], overrideSet: false }),
    { ok: true },
  );
});

test("evaluatePrimaryCheckoutGuard: on main, an orchestration IS in flight, no override — rejected, names the units", () => {
  const result = evaluatePrimaryCheckoutGuard({
    currentBranch: "main",
    activeUnits: ["agents/unitA", "agents/unitB"],
    overrideSet: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.currentBranch, "main");
  assert.deepEqual(result.activeUnits, ["agents/unitA", "agents/unitB"]);
});

test("evaluatePrimaryCheckoutGuard: on main, an orchestration is in flight, override set — ok", () => {
  assert.deepEqual(
    evaluatePrimaryCheckoutGuard({
      currentBranch: "main",
      activeUnits: ["agents/unitA"],
      overrideSet: true,
    }),
    { ok: true },
  );
});

// ── findActiveOrchestrationUnits: scans <mainRoot>/.claude/worktrees/*/.expected-branch ──

test("findActiveOrchestrationUnits: no .claude/worktrees dir at all — empty (never brick an unrelated repo layout)", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-scan-none-"));
  try {
    assert.deepEqual(findActiveOrchestrationUnits(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveOrchestrationUnits: finds marked units, ignores unmarked ones, sorted", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-scan-mixed-"));
  try {
    mkdirSync(join(dir, ".claude", "worktrees", "unitB"), { recursive: true });
    mkdirSync(join(dir, ".claude", "worktrees", "unitA"), { recursive: true });
    mkdirSync(join(dir, ".claude", "worktrees", "unitC"), { recursive: true }); // no marker
    writeFileSync(join(dir, ".claude", "worktrees", "unitB", ".expected-branch"), "agents/unitB\n");
    writeFileSync(join(dir, ".claude", "worktrees", "unitA", ".expected-branch"), "agents/unitA\n");
    assert.deepEqual(findActiveOrchestrationUnits(dir), ["agents/unitA", "agents/unitB"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── CLI (check-worktree-branch.mjs --root <dir>): git-backed, isolated ────

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo(dir, branch) {
  git(dir, ["init", "--quiet", `--initial-branch=${branch}`]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  git(dir, ["add", "seed.txt"]);
  git(dir, ["commit", "--quiet", "-m", "seed"]);
}

test("CLI: no .expected-branch marker — exits 0, silent (unmarked worktree no-op)", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-cli-nomarker-"));
  try {
    initRepo(dir, "agents/governance");
    const out = execFileSync("node", [join(HERE, "check-worktree-branch.mjs"), "--root", dir], {
      encoding: "utf8",
    });
    assert.equal(out, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: marker matches current branch — exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-cli-match-"));
  try {
    initRepo(dir, "agents/governance");
    writeFileSync(join(dir, ".expected-branch"), "agents/governance\n");
    // Would throw on non-zero exit — the assertion IS that this does not throw.
    execFileSync("node", [join(HERE, "check-worktree-branch.mjs"), "--root", dir], {
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: marker names a DIFFERENT branch than HEAD — exits non-zero, names both branches", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-cli-mismatch-"));
  try {
    initRepo(dir, "agents/governance");
    git(dir, ["checkout", "--quiet", "-b", "main"]);
    writeFileSync(join(dir, ".expected-branch"), "agents/governance\n");
    const result = spawnSync("node", [join(HERE, "check-worktree-branch.mjs"), "--root", dir], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /agents\/governance/);
    assert.match(result.stderr, /main/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── resolveGitLayout + CLI --root: PRIMARY-checkout check, real worktree topology ──
// Unlike check 1 (which is provable with a single, standalone `--root` fixture
// repo), check 2 depends on the actual primary-vs-linked-worktree relationship
// git itself tracks (`--git-dir` vs `--git-common-dir`) — so these fixtures
// build a REAL primary repo plus a REAL `git worktree add` linked worktree,
// exactly like an orchestrated `/close-issues` run does.

function setupPrimaryWithMarkedUnit(unitName, unitBranch) {
  const primaryDir = mkdtempSync(join(tmpdir(), "worktree-branch-primary-"));
  initRepo(primaryDir, "main");
  const unitDir = join(primaryDir, ".claude", "worktrees", unitName);
  mkdirSync(join(primaryDir, ".claude", "worktrees"), { recursive: true });
  git(primaryDir, ["worktree", "add", unitDir, "-b", unitBranch]);
  writeFileSync(join(unitDir, ".expected-branch"), `${unitBranch}\n`);
  return { primaryDir, unitDir };
}

test("resolveGitLayout: the PRIMARY checkout reports isPrimary=true, mainRoot=itself", () => {
  const { primaryDir, unitDir } = setupPrimaryWithMarkedUnit("unitA", "agents/unitA");
  try {
    const layout = resolveGitLayout(primaryDir);
    assert.equal(layout.isPrimary, true);
    // realpath both sides: macOS's tmpdir() is a symlink (/var → /private/var),
    // and git resolves symlinks when reporting --git-common-dir.
    assert.equal(layout.mainRoot, realpathSync(primaryDir));
    const unitLayout = resolveGitLayout(unitDir);
    assert.equal(unitLayout.isPrimary, false);
  } finally {
    git(primaryDir, ["worktree", "remove", "--force", unitDir]);
    rmSync(primaryDir, { recursive: true, force: true });
  }
});

test("CLI --root (primary): commit on `main` while a unit is marked elsewhere is BLOCKED, names the unit", () => {
  const { primaryDir, unitDir } = setupPrimaryWithMarkedUnit("unitA", "agents/unitA");
  try {
    const result = spawnSync(
      "node",
      [join(HERE, "check-worktree-branch.mjs"), "--root", primaryDir],
      {
        encoding: "utf8",
      },
    );
    assert.notEqual(
      result.status,
      0,
      `expected rejection, got: ${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stderr, /agents\/unitA/);
    assert.match(result.stderr, /PRIMARY/);
  } finally {
    git(primaryDir, ["worktree", "remove", "--force", unitDir]);
    rmSync(primaryDir, { recursive: true, force: true });
  }
});

test(`CLI --root (primary): ${MAIN_COMMIT_OVERRIDE_ENV}=1 lets the orchestrator's own commit through`, () => {
  const { primaryDir, unitDir } = setupPrimaryWithMarkedUnit("unitA", "agents/unitA");
  try {
    const result = spawnSync(
      "node",
      [join(HERE, "check-worktree-branch.mjs"), "--root", primaryDir],
      {
        encoding: "utf8",
        env: { ...process.env, [MAIN_COMMIT_OVERRIDE_ENV]: "1" },
      },
    );
    assert.equal(result.status, 0, `expected success, got: ${result.stdout}\n${result.stderr}`);
  } finally {
    git(primaryDir, ["worktree", "remove", "--force", unitDir]);
    rmSync(primaryDir, { recursive: true, force: true });
  }
});

test("CLI --root (primary): NO orchestration running anywhere — ordinary main commit is unaffected", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-primary-solo-"));
  try {
    initRepo(dir, "main");
    const out = execFileSync("node", [join(HERE, "check-worktree-branch.mjs"), "--root", dir], {
      encoding: "utf8",
    });
    assert.equal(out, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── End-to-end: the ACTUAL .githooks/pre-commit (this repo's real file) ────

function setupHookRepo(dir, branch) {
  mkdirSync(join(dir, ".githooks"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  copyFileSync(join(REPO_ROOT, ".githooks", "pre-commit"), join(dir, ".githooks", "pre-commit"));
  chmodSync(join(dir, ".githooks", "pre-commit"), 0o755);
  copyFileSync(
    join(HERE, "check-worktree-branch.mjs"),
    join(dir, "scripts", "check-worktree-branch.mjs"),
  );
  // check-conflict-markers.mjs (step after the branch guard) is dependency-free
  // and self-contained — copy it too so the REST of the real hook can run to
  // completion on the happy path, exactly as it would in a real worktree.
  copyFileSync(
    join(REPO_ROOT, "scripts", "check-conflict-markers.mjs"),
    join(dir, "scripts", "check-conflict-markers.mjs"),
  );
  initRepo(dir, branch);
  git(dir, ["config", "core.hooksPath", ".githooks"]);
}

test("pre-commit hook: a commit on the WRONG branch inside a MARKED worktree is REJECTED, both branches named", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-hook-reject-"));
  try {
    setupHookRepo(dir, "agents/governance");
    git(dir, ["checkout", "--quiet", "-b", "main"]);
    writeFileSync(join(dir, ".expected-branch"), "agents/governance\n");
    writeFileSync(join(dir, "work.txt"), "work\n");
    git(dir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "should be rejected"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.notEqual(
      result.status,
      0,
      `expected rejection, got: ${result.stdout}\n${result.stderr}`,
    );
    const combined = `${result.stdout}\n${result.stderr}`;
    assert.match(combined, /agents\/governance/);
    assert.match(combined, /\bmain\b/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pre-commit hook: an UNMARKED worktree commits normally — no false positive", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-hook-ok-"));
  try {
    setupHookRepo(dir, "agents/some-unit");
    writeFileSync(join(dir, "work.txt"), "work\n");
    git(dir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "ordinary commit"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `expected success, got: ${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pre-commit hook: a MARKED worktree committing on ITS OWN assigned branch is unaffected", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-hook-assigned-"));
  try {
    setupHookRepo(dir, "agents/governance");
    writeFileSync(join(dir, ".expected-branch"), "agents/governance\n");
    writeFileSync(join(dir, "work.txt"), "work\n");
    git(dir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "legitimate unit commit"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `expected success, got: ${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── End-to-end (check 2): the REAL pre-commit hook, PRIMARY checkout + a
// REAL linked worktree carrying the marker — the actual incident shape. Only
// the PRIMARY needs the hook files: `core.hooksPath` (a relative path) is
// resolved against whichever worktree's own top-level is running the
// commit, so a commit made FROM the primary never even looks inside the
// linked worktree for hooks (verified empirically before writing this test).

function setupPrimaryHookRepoWithMarkedUnit(unitName, unitBranch) {
  const primaryDir = mkdtempSync(join(tmpdir(), "worktree-branch-hook-primary-"));
  setupHookRepo(primaryDir, "main");
  const unitDir = join(primaryDir, ".claude", "worktrees", unitName);
  mkdirSync(join(primaryDir, ".claude", "worktrees"), { recursive: true });
  git(primaryDir, ["worktree", "add", unitDir, "-b", unitBranch]);
  writeFileSync(join(unitDir, ".expected-branch"), `${unitBranch}\n`);
  return { primaryDir, unitDir };
}

test("pre-commit hook: PRIMARY checkout commit on `main` while a unit is marked elsewhere is REJECTED", () => {
  const { primaryDir, unitDir } = setupPrimaryHookRepoWithMarkedUnit("unitA", "agents/unitA");
  try {
    writeFileSync(join(primaryDir, "work.txt"), "work\n");
    git(primaryDir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "should be rejected"], {
      cwd: primaryDir,
      encoding: "utf8",
    });
    assert.notEqual(
      result.status,
      0,
      `expected rejection, got: ${result.stdout}\n${result.stderr}`,
    );
    const combined = `${result.stdout}\n${result.stderr}`;
    assert.match(combined, /agents\/unitA/);
    assert.match(combined, /PRIMARY/);
  } finally {
    git(primaryDir, ["worktree", "remove", "--force", unitDir]);
    rmSync(primaryDir, { recursive: true, force: true });
  }
});

test(`pre-commit hook: PRIMARY checkout, ${MAIN_COMMIT_OVERRIDE_ENV}=1 lets the orchestrator's own commit through`, () => {
  const { primaryDir, unitDir } = setupPrimaryHookRepoWithMarkedUnit("unitA", "agents/unitA");
  try {
    writeFileSync(join(primaryDir, "work.txt"), "work\n");
    git(primaryDir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "orchestrator merge commit"], {
      cwd: primaryDir,
      encoding: "utf8",
      env: { ...process.env, [MAIN_COMMIT_OVERRIDE_ENV]: "1" },
    });
    assert.equal(result.status, 0, `expected success, got: ${result.stdout}\n${result.stderr}`);
  } finally {
    git(primaryDir, ["worktree", "remove", "--force", unitDir]);
    rmSync(primaryDir, { recursive: true, force: true });
  }
});

test("pre-commit hook: PRIMARY checkout, NO orchestration running anywhere — ordinary main commit unaffected", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-branch-hook-primary-solo-"));
  try {
    setupHookRepo(dir, "main");
    writeFileSync(join(dir, "work.txt"), "work\n");
    git(dir, ["add", "work.txt"]);
    const result = spawnSync("git", ["commit", "-m", "ordinary main commit"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `expected success, got: ${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
