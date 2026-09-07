#!/usr/bin/env bash
# stale-worktree-nudge.sh — Stop
# -----------------------------------------------------------------------------
# The runtime teeth for `pnpm worktrees:check`. The gate itself can only fire
# where the state exists, and review round 1 on PR #411 established that NOTHING
# was ever going to run it there:
#
#   • `/close-issues` Phase 3 runs `pnpm gates` INSIDE a unit worktree, whose own
#     repo root has no sibling `.claude/worktrees/` directory to inspect;
#   • Phase 4 explicitly forbids a post-merge battery, which is exactly the
#     moment the worktrees become stale;
#   • CI runs on a fresh checkout that never has local worktrees at all.
#
# So the gate would have been discovered by the runner, passed everywhere, and
# observed the state it exists for precisely never — the teardown would still
# have rested on the orchestrator remembering, which is the thing that already
# failed. This hook is where it actually runs: at the end of any session, in the
# primary checkout, where the leftovers are.
#
# ADVISORY: prints to stderr and ALWAYS exits 0 — a leftover worktree is a
# cleanup task, not a reason to refuse to stop. `stop_hook_active` bounds it to
# one fire per stop chain. Silent when the gate passes, and silent in a repo with
# no `.claude/worktrees/` at all (the overwhelmingly common case), so it costs
# nothing on an ordinary session.
#
# Self-tested by scripts/check-stale-worktrees.test.mjs's sibling — the gate's own
# behaviour is tested there; this file only decides WHEN to run it.
set -u

input="$(cat 2>/dev/null || true)"

# Loop guard: if we already nudged and the agent is stopping again, let it stop.
if command -v jq >/dev/null 2>&1; then
  active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
  [ "$active" = "true" ] && exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[ -n "$root" ] || exit 0
[ -d "$root/.claude/worktrees" ] || exit 0

# Nothing under it: no work to do, and no reason to spawn node.
if [ -z "$(ls -A "$root/.claude/worktrees" 2>/dev/null)" ]; then exit 0; fi

command -v node >/dev/null 2>&1 || exit 0
output="$(cd "$root" && node scripts/check-stale-worktrees.mjs 2>&1)" && exit 0

cat >&2 <<MSG
⚠ stale-worktree nudge: an orchestration worktree outlived the work it was created for.

$output

Advisory only — this hook never blocks the stop.
MSG
exit 0
