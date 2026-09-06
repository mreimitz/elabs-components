#!/usr/bin/env bash
# gate-pr-merge-readiness.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# BLOCKING (exit 2) — deliberately, and deliberately NARROW. It fires on exactly
# one command shape: `gh pr merge`. That is the actor that merged PR #375 while
# `Quality gates (blocking)` reported FAIL and `Storybook interaction + axe` was
# still PENDING — the mechanism behind #379 and the durable half of #386.
#
# It does NOT touch `git merge` / `git push` / `git checkout main`: local
# integration is a normal part of the workflow, and a hook that bricked those
# would be worked around within a day. Its sibling `pre-merge-review-gate.sh`
# still warns on those. Scope is what keeps this one enforceable.
#
# 2026-08-17: the repository is public and branch protection on `main` IS active
# (pull requests required) — but `required_status_checks` is absent from that
# policy, so GitHub still merges over a red or pending X. This hook stays the
# enforcement until the blocking `CI` job is added as a required check.
#
# Escape hatch: ALLOW_UNVERIFIED_MERGE=1 (loud, documented, shows up in the log),
# accepted BOTH from the session environment and as an inline assignment on the
# command itself — see the block that reads it below for why the second form is
# load-bearing rather than a convenience.
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

# The override is read from TWO places, and the second one is the whole fix
# (measured 2026-09-06). This hook runs in its OWN process, BEFORE the command
# executes, so it inherits the session environment and can never observe a shell
# assignment prefix or an `export` written in the same tool call — which are the
# only two forms an agent inside a Bash tool call can write. An override that
# only a human's already-exported shell can reach is, for an agent, no override
# at all; and the next thing an agent reaches for is a channel this gate cannot
# see (a direct API merge). So the INLINE ASSIGNMENT is honoured too, read out
# of the command text exactly the way `gate-comment-attribution.sh` reads its
# own. Both forms print the same loud warning, and the warning names WHICH form
# was used — so the log still says whether a human or an agent lifted the gate.
# Neither form is silent, and the gate's default is unchanged.
#
# KNOWN LIMIT, stated rather than hidden: the inline match is a substring test,
# so a command that merely MENTIONS `ALLOW_UNVERIFIED_MERGE=1` in prose (a
# commit subject describing this gate, say) would also open it. That is the
# same class of imprecision `gate-comment-attribution.sh` documents at length
# for its own override, and the cost is asymmetric in the opposite direction
# here: a false OPEN costs one unverified merge by someone who was already
# typing the words, while a false BLOCK costs the operator their only usable
# escape hatch. Tightening it to a leading-assignment parse is a fair follow-up;
# do not tighten it back to environment-only, which is the bug this replaced.
override=""
if [ "${ALLOW_UNVERIFIED_MERGE:-}" = "1" ]; then
  override="the session environment"
else
  case "$norm" in
    *"ALLOW_UNVERIFIED_MERGE=1"*) override="an inline override on this command" ;;
  esac
fi

if [ -n "$override" ]; then
  echo "⚠ merge-readiness gate OVERRIDDEN by ALLOW_UNVERIFIED_MERGE=1 ($override) — merging without proof that the blocking battery passed (#386)." >&2
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

Why this is blocked rather than warned: branch protection on \`main\` is active but
declares NO required status checks (verified 2026-08-17 —
\`gh api repos/:owner/:repo/branches/main/protection\` has no
\`required_status_checks\` key), so GitHub will still merge over a red or pending
X. PR #375 did exactly that and put conflict markers on \`main\` (#379, #386).

Wait for the battery, fix what it reports, then merge.
Override (loud, and say why in the merge commit): ALLOW_UNVERIFIED_MERGE=1
MSG
exit 2
