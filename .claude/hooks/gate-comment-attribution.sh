#!/usr/bin/env bash
# gate-comment-attribution.sh — PreToolUse(Bash|mcp__github__add_issue_comment|mcp__github__create_issue)
#
# #78: this repo's automation posts GitHub comments/issues under the repo
# owner's own `gh` identity (there is no separate bot account). A later
# automated run can then read an EARLIER machine-drafted comment and mistake
# it for a maintainer's own ruling — the exact circular-authority failure that
# motivated this gate. Real incident: a triage agent examining issue #26 found
# every comment that looked like a maintainer ruling was actually unmarked
# automation output and had to escalate to a human before it could act.
#
# This hook refuses (exit 2) a `gh issue comment` / `gh issue close --comment`
# / `gh issue create` / `gh pr comment` / `gh pr review --body` Bash call, a
# `gh api` POST/PATCH/PUT to a comment/issue/review endpoint, or a call to
# mcp__github__add_issue_comment / mcp__github__create_issue, whose body does
# not carry the machine-attribution marker (see
# scripts/lib/comment-attribution.mjs). A body the hook cannot statically
# inspect (stdin redirect, heredoc, piped input, a device, or a `\$VAR`/`\$( … )`
# the shell would expand) is refused outright, not passed through.
#
# The decision is made by PARSING the command line, not by matching it — the
# guard walks every simple command in the line and treats any `gh` invocation
# as a candidate wherever it sits. `scripts/check-comment-attribution.mjs`'s
# header explains why, and names the declared limits.
set -u

input="$(cat 2>/dev/null || true)"
[ -z "$input" ] && exit 0

if [ "${ALLOW_UNATTRIBUTED_COMMENT:-}" = "1" ]; then
  echo "⚠ comment-attribution gate OVERRIDDEN by ALLOW_UNATTRIBUTED_COMMENT=1 — posting without a machine-attribution marker (#78)." >&2
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-.}"
guard="$root/scripts/check-comment-attribution.mjs"
if [ ! -f "$guard" ]; then
  exit 0
fi

# The guard may ALLOW and still have something to say — the documented
# ALLOW_UNATTRIBUTED_COMMENT=1 override is "loud, logged", so its warning has to
# reach stderr instead of being swallowed with the success status (#78 fix
# round 2, verdict Finding 4).
out="$(printf '%s' "$input" | node "$guard" --hook 2>&1)"
rc=$?
if [ "$rc" -eq 0 ]; then
  [ -n "$out" ] && printf '%s\n' "$out" >&2
  exit 0
fi

cat >&2 <<MSG
⛔ comment-attribution gate: refusing to post (#78).
$out

Override (a human typing their own ruling through the CLI only) — either form:
  ALLOW_UNATTRIBUTED_COMMENT=1 gh issue comment …   (inline prefix)
  export ALLOW_UNATTRIBUTED_COMMENT=1               (session environment)
MSG
exit 2
