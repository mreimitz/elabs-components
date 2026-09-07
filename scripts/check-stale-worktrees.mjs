#!/usr/bin/env node
/**
 * check-stale-worktrees.mjs — fail when an orchestrated `/close-issues` worktree
 * has outlived the work it was created for.
 *
 * INCIDENT. A wave's six unit worktrees under `.claude/worktrees/` were never
 * torn down after their branches landed. Three things then went wrong at once,
 * and none of them named the real cause:
 *
 *  1. The editor's TypeScript server discovers `.claude/worktrees/<unit>/` as a
 *     FULL second copy of the repo — a `tsconfig.json` in every package — so it
 *     typechecked every package once per live worktree, and kept reporting
 *     diagnostics ("No inputs were found in config file
 *     '….claude/worktrees/<unit>/packages/ui/tsconfig.json'") against copies
 *     that had since been deleted. `.vscode/settings.json` now excludes the
 *     directory, which stops the editor half.
 *  2. `check-worktree-branch.mjs`'s primary-checkout guard blocks any commit on
 *     `main` while a `.expected-branch` marker exists ANYWHERE — so a stale
 *     marker from a finished wave blocks ordinary, unrelated work, and the
 *     failure text says "an orchestrated run is in flight" when none is.
 *  3. `git branch -d` refuses a unit branch until it is merged to the REMOTE,
 *     so leftovers accumulate quietly and the next wave starts on a dirty slate.
 *
 * Excluding the directory from the editor treats the symptom. This gate treats
 * the cause: a worktree whose work has LANDED and whose tree is CLEAN is
 * finished, and finished worktrees get removed. Per
 * .claude/rules/quality-gates.md § "Enforcement over reminders", the teardown
 * step in .claude/commands/close-issues.md ships with this check, not as prose
 * alone.
 *
 * WHAT COUNTS AS STALE. A registered worktree is stale when its tree is CLEAN
 * and its work has LANDED. "Landed" is two shapes, because the wave PR is
 * squash-merged (close-issues Phase 4):
 *   - MERGE: the branch is behind the integration ref and ahead of it by
 *     nothing. Being ahead by nothing is NOT enough on its own — a
 *     freshly-created unit branch points exactly AT the ref and is ahead by
 *     nothing too, and calling that stale would tell an orchestrator to delete
 *     a unit it had just dispatched. Landing means the ref moved past it.
 *   - SQUASH: the unit's commits are not ancestors of the ref at all (squash
 *     rewrites them), so reachability answers "not merged" for every normally
 *     completed unit. The branch's own tree is replayed onto the merge base as
 *     a throwaway commit and `git cherry` asks whether that PATCH is already
 *     upstream — the standard squash-detection trick, and the only one that
 *     sees the path this repo actually merges through.
 * An UNREGISTERED directory (git no longer tracks it) is stale only when it is
 * EMPTY. `git -C <dir> status` inside one walks up to the primary repo and
 * reports ITS cleanliness, and `.gitignore` hides `.claude/worktrees/` entirely,
 * so a directory full of unsaved work reads as clean — proof of nothing. Its
 * contents are checked directly instead.
 * Everything else passes silently: unmerged commits, a fresh unit, uncommitted
 * changes, a non-empty orphan, anything unreadable. This gate only ever reports
 * a directory it can prove is safe to delete, so a wave in flight never trips
 * it.
 *
 * Never removes anything: it prints the exact commands and exits 1.
 *
 * Dependency-free; ESM; cwd-independent. Pure classification exported for the
 * self-test (scripts/check-stale-worktrees.test.mjs, pnpm
 * worktrees:check:test).
 *
 * Usage:
 *   node scripts/check-stale-worktrees.mjs              # real run
 *   node scripts/check-stale-worktrees.mjs --root <dir> # explicit repo root (self-test)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const WORKTREES_DIRNAME = join(".claude", "worktrees");
/** Preferred integration ref, then the fallback when the repo has no remote. */
export const INTEGRATION_REFS = ["origin/main", "main"];
/** The orchestrator's per-worktree marker (`check-worktree-branch.mjs`), never work. */
export const MARKER_FILENAME = ".expected-branch";

/**
 * Pure verdict for ONE worktree. Exported for the self-test.
 *
 * Every `null` means "could not be established", and every one of them resolves
 * to NOT stale: this gate may only ever name a directory whose deletion it can
 * prove is safe.
 *
 * @param {{ registered: boolean, landed: boolean|null, dirty: boolean|null,
 *   empty: boolean|null }} w
 * @returns {{ stale: true, reason: string, kind: "worktree"|"orphan" } | { stale: false }}
 */
export function classifyWorktree({ registered, landed, dirty, empty }) {
  if (!registered) {
    // An unregistered directory's cleanliness cannot be read from git: `status`
    // run inside it answers for the PRIMARY repo, which ignores
    // `.claude/worktrees/` wholesale — so a directory full of unsaved work
    // reports clean. Only emptiness is real evidence here.
    if (empty === true)
      return {
        stale: true,
        kind: "orphan",
        reason: "an empty directory git no longer tracks as a worktree",
      };
    return { stale: false };
  }
  if (dirty === null || dirty) return { stale: false };
  if (landed !== true) return { stale: false };
  return {
    stale: true,
    kind: "worktree",
    reason: "its work has landed on the integration branch and its tree is clean",
  };
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
}

function gitOrNull(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

/**
 * Which ref should "has this landed?" be measured against? `origin/main` when
 * the repo has one (a branch merged locally but not yet pushed is NOT finished
 * — `git branch -d` refuses it for the same reason), else local `main`.
 * @returns {string|null} null when neither exists (nothing to measure against).
 */
export function resolveIntegrationRef(root) {
  for (const ref of INTEGRATION_REFS) {
    if (gitOrNull(root, ["rev-parse", "--verify", "--quiet", ref]) !== null) return ref;
  }
  return null;
}

/** The worktree paths git currently knows about, as absolute paths. */
export function listRegisteredWorktrees(root) {
  const out = gitOrNull(root, ["worktree", "list", "--porcelain"]);
  if (out === null) return new Set();
  const paths = new Set();
  for (const line of out.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    paths.add(canonical(line.slice("worktree ".length).trim()));
  }
  return paths;
}

/**
 * Compare paths the way git reports them. `git worktree list` prints RESOLVED
 * paths, so on macOS a repo reached through `/tmp` (a symlink to `/private/tmp`)
 * would never match a directory read back from `readdir` — every worktree would
 * look unregistered, and this gate would ask for a deletion that is not safe.
 */
function canonical(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * Has this branch's work reached `integrationRef`? Two shapes, because a wave
 * merges by SQUASH (close-issues Phase 4) and reachability cannot see that.
 *
 *  - Merged outright: nothing ahead of the ref, and the ref has moved PAST the
 *    branch. The second half is what separates a landed unit from one that was
 *    just created — a fresh unit branch points exactly at the ref, so it is
 *    "ahead by nothing" from its first second of life.
 *  - Squashed: the branch's whole diff exists upstream as one commit. Its tree
 *    is replayed onto the merge base as a throwaway commit object and
 *    `git cherry` reports `-` when an equivalent patch is already upstream.
 *    The object is unreferenced and is collected by the next `git gc`.
 *
 * @returns {boolean|null} null when it cannot be established.
 */
export function hasLanded(root, branch, integrationRef) {
  if (!branch || !integrationRef) return null;
  const ahead = gitOrNull(root, ["rev-list", "--count", `${integrationRef}..${branch}`]);
  const behind = gitOrNull(root, ["rev-list", "--count", `${branch}..${integrationRef}`]);
  if (ahead === null || behind === null) return null;
  if (Number(ahead) === 0) return Number(behind) > 0;

  const base = gitOrNull(root, ["merge-base", integrationRef, branch]);
  const tree = gitOrNull(root, ["rev-parse", `${branch}^{tree}`]);
  if (base === null || tree === null) return null;
  const squashed = gitOrNull(root, [
    "commit-tree",
    tree,
    "-p",
    base,
    "-m",
    "stale-worktrees probe",
  ]);
  if (squashed === null) return null;
  const cherry = gitOrNull(root, ["cherry", integrationRef, squashed]);
  if (cherry === null) return null;
  return cherry.startsWith("-");
}

/** Does the directory hold anything at all (the marker file aside)? */
export function isEffectivelyEmpty(dirPath) {
  try {
    const entries = readdirSync(dirPath).filter((e) => e !== ".expected-branch");
    return entries.length === 0;
  } catch {
    return null;
  }
}

/**
 * Probe one worktree directory on disk.
 * @returns {{ name: string, path: string, registered: boolean, landed: boolean|null,
 *   dirty: boolean|null, empty: boolean|null, branch: string|null }}
 */
export function probeWorktree(root, dirPath, name, registeredPaths, integrationRef) {
  const registered = registeredPaths.has(canonical(dirPath));
  if (!registered) {
    return {
      name,
      path: dirPath,
      registered,
      landed: null,
      // Deliberately NOT `git status`: run inside an unregistered directory it
      // answers for the primary repo, which ignores `.claude/worktrees/`.
      dirty: null,
      empty: isEffectivelyEmpty(dirPath),
      branch: null,
    };
  }
  const status = gitOrNull(dirPath, ["status", "--porcelain"]);
  // The orchestrator's own `.expected-branch` marker is machine-local state, not
  // work: this repo gitignores it, but a checkout that does not would otherwise
  // report every unit worktree as dirty and the gate would never fire at all.
  const dirty =
    status === null
      ? null
      : status
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .some((line) => !line.endsWith(MARKER_FILENAME));
  const branch = gitOrNull(dirPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return {
    name,
    path: dirPath,
    registered,
    landed: hasLanded(root, branch, integrationRef),
    dirty,
    empty: null,
    branch,
  };
}

/** Every directory directly under `.claude/worktrees/`. */
export function listWorktreeDirs(root) {
  const dir = join(root, WORKTREES_DIRNAME);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function main(argv) {
  const rootIdx = argv.indexOf("--root");
  let root;
  if (rootIdx >= 0) {
    root = argv[rootIdx + 1];
  } else {
    const top = gitOrNull(process.cwd(), ["rev-parse", "--show-toplevel"]);
    if (top === null) return 0; // not a git repo — nothing to check
    root = top;
  }

  if (!existsSync(join(root, WORKTREES_DIRNAME))) return 0;

  const registeredPaths = listRegisteredWorktrees(root);
  const integrationRef = resolveIntegrationRef(root);

  const stale = [];
  for (const { name, path } of listWorktreeDirs(root)) {
    const probe = probeWorktree(root, path, name, registeredPaths, integrationRef);
    const verdict = classifyWorktree(probe);
    if (verdict.stale) stale.push({ ...probe, reason: verdict.reason, kind: verdict.kind });
  }

  if (stale.length === 0) return 0;

  console.error(
    `✖ stale-worktrees gate FAILED — ${stale.length} orchestration worktree(s) outlived their work:\n`,
  );
  for (const w of stale) {
    console.error(`  ${w.name}${w.branch ? ` (${w.branch})` : ""} — ${w.reason}`);
  }
  console.error(
    "\nA finished worktree is not free. Its `tsconfig.json` copies are picked up as real\n" +
      "TypeScript projects by anything scanning the tree, and its `.expected-branch` marker\n" +
      'keeps `worktree-branch:check` blocking commits on `main` with "an orchestrated run is\n' +
      'in flight" long after the wave landed. Tear them down:\n',
  );
  const registered = stale.filter((w) => w.kind === "worktree");
  const orphans = stale.filter((w) => w.kind === "orphan");
  for (const w of registered) {
    console.error(`  git worktree remove ${join(WORKTREES_DIRNAME, w.name)}`);
  }
  if (registered.length > 0) console.error("  git worktree prune");
  for (const w of registered) {
    if (w.branch) console.error(`  git branch -d ${w.branch}`);
  }
  // `git worktree remove` refuses a path it does not know ("is not a working
  // tree"), so an orphan needs the plain filesystem command instead. It is only
  // ever reported when it is EMPTY, which is why `rmdir` is enough — and why
  // the command cannot destroy anything.
  for (const w of orphans) {
    console.error(`  rmdir ${join(WORKTREES_DIRNAME, w.name)}`);
  }
  console.error(
    "\nNothing is deleted for you: each of these is a real directory, and the decision to\n" +
      "remove it is the orchestrator's. Only two shapes are ever reported — a worktree whose\n" +
      "work has landed AND whose tree is clean, and an EMPTY directory git no longer tracks —\n" +
      "so there is nothing in either of them left to lose.",
  );
  return 1;
}

if (process.argv[1] && canonical(process.argv[1]) === canonical(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
