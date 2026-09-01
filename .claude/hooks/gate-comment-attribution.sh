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
# / `gh issue create` / `gh pr comment` / `gh pr review --body` Bash call, or a
# call to mcp__github__add_issue_comment / mcp__github__create_issue, whose
# body does not carry the machine-attribution marker (see
# scripts/lib/comment-attribution.mjs). A body the hook cannot statically
# inspect (stdin redirect, heredoc, piped input) is refused outright, not
# passed through.
#
# Known, accepted limit: nothing here can stop a human from pasting an
# unmarked comment straight into the GitHub web UI — this binds the
# agent/CLI/MCP tool path inside a Claude Code session only.
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

if out="$(printf '%s' "$input" | node "$guard" --hook 2>&1)"; then
  exit 0
fi

cat >&2 <<MSG
⛔ comment-attribution gate: refusing to post (#78).
$out

Override (a human typing their own ruling through the CLI only): ALLOW_UNATTRIBUTED_COMMENT=1
MSG
exit 2
