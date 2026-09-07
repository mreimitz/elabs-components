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
 * WHAT COUNTS AS STALE. A directory under `.claude/worktrees/` is stale when
 * BOTH hold:
 *   - its branch has no commits missing from the integration ref (it is fully
 *     merged — `origin/main` when that ref exists, else `main`), or git no
 *     longer knows it as a worktree at all (a leftover directory); AND
 *   - its tree is clean (nothing uncommitted to lose).
 * Anything else is live work and passes silently: unmerged commits, uncommitted
 * changes, or a worktree git cannot read. This gate only ever reports a
 * worktree it is safe to delete, so a wave in flight never trips it.
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

/**
 * Pure verdict for ONE worktree. Exported for the self-test.
 *
 * `registered` false means git no longer lists the directory as a worktree —
 * a leftover folder, which is stale as soon as it has nothing uncommitted in
 * it (there is no branch left to be unmerged).
 *
 * @param {{ name: string, registered: boolean, merged: boolean|null, dirty: boolean|null }} w
 * @returns {{ stale: true, reason: string } | { stale: false }}
 */
export function classifyWorktree({ registered, merged, dirty }) {
  // Anything unreadable (either probe returned null) is left alone: this gate
  // only ever asks for a deletion it can prove is safe.
  if (dirty === null) return { stale: false };
  if (dirty) return { stale: false };
  if (!registered) return { stale: true, reason: "no longer a registered git worktree" };
  if (merged === null) return { stale: false };
  if (merged) return { stale: true, reason: "its branch is fully merged and its tree is clean" };
  return { stale: false };
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
 * Probe one worktree directory on disk.
 * @returns {{ name: string, path: string, registered: boolean, merged: boolean|null,
 *   dirty: boolean|null, branch: string|null }}
 */
export function probeWorktree(root, dirPath, name, registeredPaths, integrationRef) {
  const registered = registeredPaths.has(canonical(dirPath));
  const status = gitOrNull(dirPath, ["status", "--porcelain"]);
  const dirty = status === null ? (registered ? null : false) : status.length > 0;
  const branch = registered ? gitOrNull(dirPath, ["rev-parse", "--abbrev-ref", "HEAD"]) : null;

  let merged = null;
  if (registered && branch && integrationRef) {
    const ahead = gitOrNull(root, ["rev-list", "--count", `${integrationRef}..${branch}`]);
    if (ahead !== null) merged = Number(ahead) === 0;
  }
  return { name, path: dirPath, registered, merged, dirty, branch };
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
    if (verdict.stale) stale.push({ ...probe, reason: verdict.reason });
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
  for (const w of stale) {
    console.error(`  git worktree remove ${join(WORKTREES_DIRNAME, w.name)}`);
  }
  console.error("  git worktree prune");
  for (const w of stale) {
    if (w.branch) console.error(`  git branch -d ${w.branch}`);
  }
  console.error(
    "\nNothing is deleted for you: each of these is a real directory, and the decision to\n" +
      "remove it is the orchestrator's. This gate only reports worktrees whose branch has\n" +
      "already landed AND whose tree is clean, so there is nothing in them left to lose.",
  );
  return 1;
}

if (process.argv[1] && canonical(process.argv[1]) === canonical(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
