#!/usr/bin/env bash
# gate-pr-merge-readiness.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# BLOCKING (exit 2) — deliberately, and deliberately NARROW. It fires on exactly
# one command shape: `gh pr merge`. That is the actor that merged PR #375 while
# `Quality gates (blocking)` reported FAIL and `Storybook interaction + axe` was
# still PENDING — the mechanism behind #379 and the durable half of #386.
#
# It does NOT touch `git merge` / `git push` / `git checkout main`: on this repo's
# plan branch protection is unavailable (403 "Upgrade to GitHub Pro"), local
# integration is a normal part of the workflow, and a hook that bricked those
# would be worked around within a day. Its sibling `pre-merge-review-gate.sh`
# still warns on those. Scope is what keeps this one enforceable.
#
# Escape hatch: ALLOW_UNVERIFIED_MERGE=1 (loud, documented, shows up in the log).
# See .claude/rules/quality-gates.md ▸ "Merge discipline" and issue #386.
set -u

input="$(cat 2>/dev/null || true)"

cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
fi
if [ -z "$cmd" ]; then
  cmd="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -n1)"
fi

[ -z "$cmd" ] && exit 0

norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"
case "$norm" in
  *"gh pr merge"*) ;;
  *) exit 0 ;;
esac

if [ "${ALLOW_UNVERIFIED_MERGE:-}" = "1" ]; then
  echo "⚠ merge-readiness gate OVERRIDDEN by ALLOW_UNVERIFIED_MERGE=1 — merging without proof that the blocking battery passed (#386)." >&2
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-.}"
guard="$root/scripts/check-merge-readiness.mjs"
if [ ! -f "$guard" ]; then
  # Fail OPEN only when the guard genuinely is not in this tree (e.g. an older
  # checkout). Its absence in a tree that should have it is caught by
  # `pnpm merge:check:test` in CI, not here.
  exit 0
fi

# First PR number that appears in the command, if any; otherwise the guard
# resolves the PR for the current branch itself.
pr="$(printf '%s' "$norm" | sed -n 's/.*gh pr merge[[:space:]]\{1,\}\([0-9]\{1,\}\).*/\1/p' | head -n1)"

if out="$(node "$guard" ${pr:+"$pr"} 2>&1)"; then
  exit 0
fi

cat >&2 <<MSG
⛔ merge-readiness gate: refusing \`gh pr merge\`.

$out

Why this is blocked rather than warned: branch protection is unavailable on this
repo's plan (verified — \`gh api repos/:owner/:repo/branches/main/protection\`
returns 403 "Upgrade to GitHub Pro"), so GitHub will merge over a red or pending
X. PR #375 did exactly that and put conflict markers on \`main\` (#379, #386).

Wait for the battery, fix what it reports, then merge.
Override (loud, and say why in the merge commit): ALLOW_UNVERIFIED_MERGE=1
MSG
exit 2
