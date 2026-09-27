#!/usr/bin/env node
/**
 * prune-worktrees.mjs — SessionStart(startup)
 * ---------------------------------------------------------------------------
 * Removes `.claude/worktrees/*` left behind by finished agent and workflow runs.
 * Claude Code only auto-removes an isolation worktree that has no changes, so
 * every builder and fix round that committed leaves a 1–3 GB folder behind; on
 * 2026-09-26 that had reached 95 worktrees.
 *
 * The hook itself returns at once: it reports the previous run's failures, if
 * any, then hands the work to a detached child so session start never waits.
 *
 * A worktree is removed only when ALL of these hold:
 *   - it lives under `<main checkout>/.claude/worktrees/` and is not locked;
 *   - no git activity for IDLE_HOURS (a fresh worktree sits at main's HEAD and
 *     would otherwise look "merged" while its agent is starting);
 *   - no process has its working directory inside it;
 *   - `git status` is clean (never discards unsaved edits);
 *   - its work is on origin/main: HEAD is an ancestor, or merging it changes
 *     nothing, or every commit subject is already on main (the charts
 *     workflow rebases each item, so its branches never look merged);
 *   - a detached HEAD that is not an ancestor is still held by some branch.
 * Removal is plain `git worktree remove` (no --force); branches are kept.
 *
 *   node .claude/hooks/prune-worktrees.mjs --dry-run   # print decisions only
 */
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const IDLE_HOURS = 24;
const BASE = "origin/main";

const git = (args, cwd) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim() };
};

const commonDir = git(
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  dirname(fileURLToPath(import.meta.url)),
);
if (!commonDir.ok) process.exit(0);
const mainRoot = dirname(commonDir.out);
const worktreesDir = join(mainRoot, ".claude", "worktrees");
const failureLog = join(worktreesDir, ".prune-failures.log");
const lockFile = join(worktreesDir, ".prune.lock");
if (!existsSync(worktreesDir)) process.exit(0);

const mode = process.argv[2];

if (mode !== "--run" && mode !== "--dry-run") {
  try {
    const failures = readFileSync(failureLog, "utf8").trim();
    if (failures) {
      console.log(
        `Old agent worktrees could not all be removed last time; details in ${failureLog}`,
      );
    }
  } catch {
    // No failures recorded.
  }
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--run"], {
    cwd: mainRoot,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  process.exit(0);
}

const dryRun = mode === "--dry-run";

// One pruner at a time: two sessions starting together would race on the same folders.
if (!dryRun) {
  try {
    closeSync(openSync(lockFile, "wx"));
  } catch {
    try {
      if (Date.now() - statSync(lockFile).mtimeMs < 60 * 60 * 1000) process.exit(0);
      writeFileSync(lockFile, "");
    } catch {
      process.exit(0);
    }
  }
}

const release = () => {
  if (!dryRun) rmSync(lockFile, { force: true });
};

// Working directories of every process. Without lsof (Windows) nothing can be proven idle.
const liveCwds = (() => {
  const result = spawnSync("lsof", ["-a", "-d", "cwd", "-Fn"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || !result.stdout) return null;
  return result.stdout
    .split("\n")
    .filter((line) => line.startsWith("n"))
    .map((line) => resolve(line.slice(1)));
})();
if (!liveCwds) {
  release();
  process.exit(0);
}

if (!dryRun) git(["fetch", "--quiet", "origin", "main"], mainRoot);
const baseTree = git(["rev-parse", `${BASE}^{tree}`], mainRoot);
if (!baseTree.ok) {
  release();
  process.exit(0);
}
const baseSubjects = new Set(git(["log", BASE, "--format=%s"], mainRoot).out.split("\n"));

const worktrees = [];
let current = {};
for (const line of git(["worktree", "list", "--porcelain"], mainRoot).out.split("\n")) {
  if (line.startsWith("worktree ")) current = { path: line.slice(9) };
  else if (line.startsWith("HEAD ")) current.head = line.slice(5);
  else if (line === "detached") current.detached = true;
  else if (line.startsWith("locked")) current.locked = true;
  else if (line === "") worktrees.push(current);
}
if (current.path && !worktrees.includes(current)) worktrees.push(current);

const lastGitActivity = (path) => {
  const gitDir = git(["rev-parse", "--absolute-git-dir"], path);
  if (!gitDir.ok) return Date.now();
  let newest = 0;
  for (const file of ["HEAD", "index", join("logs", "HEAD")]) {
    try {
      newest = Math.max(newest, statSync(join(gitDir.out, file)).mtimeMs);
    } catch {
      // File absent.
    }
  }
  return newest || Date.now();
};

const workOnMain = (path, head, detached) => {
  if (git(["merge-base", "--is-ancestor", head, BASE], mainRoot).ok) return "merged";
  if (detached && !git(["branch", "--contains", head], mainRoot).out) return null;
  const merged = git(["merge-tree", "--write-tree", BASE, head], mainRoot);
  if (merged.ok && merged.out.split("\n")[0] === baseTree.out) return "content on main";
  const commits = git(["rev-list", `${BASE}..${head}`], mainRoot)
    .out.split("\n")
    .filter(Boolean);
  const unmatched = commits.filter(
    (commit) => !baseSubjects.has(git(["log", "-1", "--format=%s", commit], mainRoot).out),
  );
  return unmatched.length === 0 ? "subjects on main" : null;
};

const failures = [];
for (const { path, head, detached, locked } of worktrees) {
  if (!path.startsWith(worktreesDir + sep) || !existsSync(path)) continue;
  const name = path.slice(worktreesDir.length + 1);
  const keep = (why) => dryRun && console.log(`keep    ${name}: ${why}`);
  if (locked) {
    keep("locked");
    continue;
  }
  const idleHours = (Date.now() - lastGitActivity(path)) / 3_600_000;
  if (idleHours < IDLE_HOURS) {
    keep(`git activity ${idleHours.toFixed(1)}h ago`);
    continue;
  }
  if (liveCwds.some((cwd) => cwd === path || cwd.startsWith(path + sep))) {
    keep("a process is running inside it");
    continue;
  }
  if (git(["status", "--porcelain"], path).out) {
    keep("uncommitted changes");
    continue;
  }
  const reason = workOnMain(path, head, detached);
  if (!reason) {
    keep("has work not on main");
    continue;
  }
  if (dryRun) {
    console.log(`remove  ${name}: ${reason}`);
    continue;
  }
  const removed = spawnSync("git", ["worktree", "remove", path], {
    cwd: mainRoot,
    encoding: "utf8",
  });
  if (removed.status !== 0) failures.push(`${name}: ${(removed.stderr ?? "").trim()}`);
}

if (!dryRun) {
  git(["worktree", "prune"], mainRoot);
  if (failures.length) writeFileSync(failureLog, `${failures.join("\n")}\n`);
  else rmSync(failureLog, { force: true });
}
release();
