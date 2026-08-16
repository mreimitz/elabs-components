#!/usr/bin/env node
/**
 * check-worktree-branch.mjs — guard against a commit landing on the wrong
 * branch inside an ORCHESTRATED worktree (#403).
 *
 * Incident: during the wave-3 `/close-issues` run, two independently-
 * dispatched coder agents committed directly to `main` instead of their
 * assigned isolated worktree/branch (stray commits `b8bbed6` and `513a216` —
 * both caught and reverted by the orchestrator with no residue). The
 * "operate only in your assigned worktree, never commit to `main`"
 * instruction was carried only as brief prose, and a STRONGER brief did not
 * prevent the second incident. Per .claude/rules/quality-gates.md §
 * "Enforcement over reminders", a must-always-hold invariant like this needs
 * a mechanical guard, not a better sentence.
 *
 * TWO complementary checks, because the incident can happen on either side
 * of the worktree boundary:
 *
 * 1. Marked-worktree check. When an orchestrator creates a worktree for a
 *    unit (see .claude/commands/close-issues.md, Phase 2), it writes an
 *    `.expected-branch` marker file at the worktree root naming the branch
 *    that unit is assigned to. If the marker is present and HEAD does not
 *    resolve to the branch it names, the commit is rejected with both branch
 *    names printed. An UNMARKED worktree (ordinary, non-orchestrated
 *    development — no `.expected-branch` file at all) is a silent no-op.
 *
 * 2. Primary-checkout check (the actual shape of the real incidents). A
 *    marker only ever lives inside a unit's OWN linked worktree — never in
 *    the PRIMARY checkout, where `main` normally lives. Git also refuses to
 *    check out a branch that is already checked out in another worktree, so
 *    a marked worktree can never itself have HEAD == `main` while `main` is
 *    checked out at the primary. That means the only place the real stray
 *    commits could have landed is a shell whose cwd was the PRIMARY
 *    checkout — which check 1 alone can never see, since the primary never
 *    carries a marker. So: while ANY `.claude/worktrees/<unit>/.expected-branch`
 *    marker exists anywhere under the main repo root (an orchestrated run is
 *    in flight), a commit on `main` in the PRIMARY checkout is blocked
 *    unless the orchestrator's own loud override
 *    (`ALLOW_MAIN_COMMIT=1`, set for its own merge/integration commits) is
 *    present. An ordinary contributor commit on `main` with NO orchestration
 *    running anywhere (the overwhelmingly common case) stays a silent no-op —
 *    `activeUnits` is empty, so this check never fires.
 *
 * Both checks are wired into `.githooks/pre-commit` as the very FIRST,
 * hard-abort step (a single call into this script's `main()`).
 *
 * Dependency-free; ESM; cwd-independent. Pure comparison logic exported for
 * the self-test (scripts/check-worktree-branch.test.mjs, pnpm
 * worktree-branch:check:test).
 *
 * Usage:
 *   node scripts/check-worktree-branch.mjs             # real run — HEAD of cwd's worktree
 *   node scripts/check-worktree-branch.mjs --root <dir> # explicit worktree root (self-test)
 *
 * Override (primary-checkout check only): ALLOW_MAIN_COMMIT=1 — for the
 * orchestrator's own deliberate commits on `main` (e.g. a merge/integration
 * step) while a wave is still in flight elsewhere.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";

export const MARKER_FILENAME = ".expected-branch";
export const GUARDED_PRIMARY_BRANCH = "main";
export const MAIN_COMMIT_OVERRIDE_ENV = "ALLOW_MAIN_COMMIT";

/**
 * Pure verdict: does HEAD resolve to the branch `.expected-branch` names?
 * `expectedBranch === null` means the marker is absent — always ok (the
 * whole point of this guard: an ordinary, unmarked worktree is never
 * affected). Exported for the self-test.
 * @returns {{ ok: true } | { ok: false, expectedBranch: string, currentBranch: string }}
 */
export function evaluateWorktreeBranch(expectedBranch, currentBranch) {
  if (expectedBranch == null) return { ok: true };
  if (expectedBranch === currentBranch) return { ok: true };
  return { ok: false, expectedBranch, currentBranch };
}

/**
 * Pure verdict for the PRIMARY-checkout check: is a commit on
 * `GUARDED_PRIMARY_BRANCH` (`main`) safe to let through? Safe unless we are
 * ON that branch, AND at least one other worktree is currently marked (an
 * orchestration run is in flight), AND no override is set. Exported for the
 * self-test.
 * @returns {{ ok: true } | { ok: false, currentBranch: string, activeUnits: string[] }}
 */
export function evaluatePrimaryCheckoutGuard({ currentBranch, activeUnits, overrideSet }) {
  if (currentBranch !== GUARDED_PRIMARY_BRANCH) return { ok: true };
  if (!activeUnits || activeUnits.length === 0) return { ok: true };
  if (overrideSet) return { ok: true };
  return { ok: false, currentBranch, activeUnits };
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
}

/**
 * Is `root` the PRIMARY checkout (as opposed to a linked worktree), and what
 * is the main repo root? A primary checkout's `--git-dir` and
 * `--git-common-dir` are the SAME path; a linked worktree's `--git-dir`
 * points into `<common-dir>/worktrees/<name>`, so the two differ. Prefers
 * `--path-format=absolute` (git >= 2.36); falls back to resolving whatever
 * `--git-dir`/`--git-common-dir` return against `root` for older git.
 * @returns {{ isPrimary: boolean, mainRoot: string } | null} null when git
 *   itself can't answer (not a git repo at all — nothing to guard).
 */
export function resolveGitLayout(root) {
  try {
    const out = git(root, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
    const [gitDir, commonDir] = out.split("\n");
    return { isPrimary: gitDir === commonDir, mainRoot: dirname(commonDir) };
  } catch {
    // older git without --path-format
  }
  try {
    const resolve = (p) => (isAbsolute(p) ? p : join(root, p));
    const gitDir = resolve(git(root, ["rev-parse", "--git-dir"]));
    const commonDir = resolve(git(root, ["rev-parse", "--git-common-dir"]));
    return { isPrimary: gitDir === commonDir, mainRoot: dirname(commonDir) };
  } catch {
    return null;
  }
}

/**
 * Which unit branches (if any) currently have a live `.expected-branch`
 * marker under `<mainRoot>/.claude/worktrees/*`? An orchestrated
 * `/close-issues` run is "in flight" exactly when this is non-empty.
 * Unreadable/missing dirs are treated as "no orchestration running" — this
 * check only ever ADDS a block, so any doubt resolves to letting the commit
 * through (never brick an unrelated repo layout).
 * @returns {string[]}
 */
export function findActiveOrchestrationUnits(mainRoot) {
  const worktreesDir = join(mainRoot, ".claude", "worktrees");
  let entries;
  try {
    entries = readdirSync(worktreesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const units = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const markerPath = join(worktreesDir, entry.name, MARKER_FILENAME);
    if (!existsSync(markerPath)) continue;
    try {
      units.push(readFileSync(markerPath, "utf8").trim() || entry.name);
    } catch {
      units.push(entry.name);
    }
  }
  return units.sort();
}

function main(argv) {
  const rootIdx = argv.indexOf("--root");
  let root;
  if (rootIdx >= 0) {
    root = argv[rootIdx + 1];
  } else {
    try {
      root = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
    } catch {
      return 0; // not inside a git worktree at all — nothing to guard
    }
  }

  const markerPath = join(root, MARKER_FILENAME);
  if (existsSync(markerPath)) {
    // Check 1 — this IS a marked, orchestrated worktree: HEAD must match it.
    const expectedBranch = readFileSync(markerPath, "utf8").trim();
    let currentBranch;
    try {
      currentBranch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch {
      return 0; // HEAD unresolvable (e.g. no commits yet) — nothing to compare, don't block
    }

    const verdict = evaluateWorktreeBranch(expectedBranch, currentBranch);
    if (!verdict.ok) {
      console.error(
        `✖ worktree-branch gate FAILED — this worktree is marked for branch \`${verdict.expectedBranch}\` ` +
          `(${MARKER_FILENAME}) but HEAD currently resolves to \`${verdict.currentBranch}\`.\n` +
          "This worktree was assigned to a specific branch by an orchestrator — committing on a\n" +
          "different branch here is exactly the #403 incident (an agent's shell drifting to the\n" +
          "wrong branch and committing straight to `main`). Checkout the assigned branch before\n" +
          `committing, or delete ${MARKER_FILENAME} if this worktree is being deliberately\n` +
          "repurposed for ordinary, non-orchestrated development.",
      );
      return 1;
    }
    return 0;
  }

  // Check 2 — no local marker: is this the PRIMARY checkout, committing on
  // `main`, while an orchestration run is in flight in ANOTHER worktree? This
  // is the shape the real wave-3 incidents must have taken (see file header).
  let currentBranch;
  try {
    currentBranch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    return 0; // HEAD unresolvable — nothing to compare, don't block
  }
  if (currentBranch !== GUARDED_PRIMARY_BRANCH) return 0; // only `main` is guarded here

  const layout = resolveGitLayout(root);
  if (!layout || !layout.isPrimary) return 0; // an ordinary unmarked LINKED worktree: unaffected

  const activeUnits = findActiveOrchestrationUnits(layout.mainRoot);
  const overrideSet = process.env[MAIN_COMMIT_OVERRIDE_ENV] === "1";
  const verdict = evaluatePrimaryCheckoutGuard({ currentBranch, activeUnits, overrideSet });
  if (!verdict.ok) {
    console.error(
      `✖ worktree-branch gate FAILED — an orchestrated /close-issues run is in flight ` +
        `(marked unit branch(es): ${verdict.activeUnits.join(", ")}) and this commit is being ` +
        `made directly on \`${verdict.currentBranch}\` in the PRIMARY checkout.\n` +
        "Each unit's work belongs in its OWN assigned worktree/branch, never on `main` — this is\n" +
        "exactly the #403 incident (an agent's shell landing in the primary checkout instead of\n" +
        "its assigned worktree). If this commit is the orchestrator's own deliberate merge or\n" +
        `integration step, set ${MAIN_COMMIT_OVERRIDE_ENV}=1 and re-run the commit.`,
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
