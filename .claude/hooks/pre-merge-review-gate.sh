#!/usr/bin/env bash
# pre-merge-review-gate.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# WARN-ONLY (always exit 0). Reads the proposed Bash command from the hook JSON
# (tool_input.command) and, when it looks like an integration into the DEFAULT
# branch (git merge / git checkout main / git push ... main), prints a reminder
# to run the Definition-of-Done review battery FIRST. It never blocks — review
# precedence is a judgment call, and a blocking hook here would brick the very
# merge/push it is meant to guard. See .claude/rules/quality-gates.md
# ("Definition-of-Done battery"). Quiet on the happy path.
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

# Normalize whitespace for matching.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

hit=""
case "$norm" in
  *"git merge"*) hit="git merge" ;;
  *"git checkout main"*|*"git checkout master"*|*"git switch main"*|*"git switch master"*) hit="checkout/switch to the default branch" ;;
esac
# git push ... main / master (the default branch as a ref anywhere in the push)
case "$norm" in
  *"git push"*)
    case "$norm" in
      *" main"*|*":main"*|*" master"*|*":master"*|*" origin main"*|*" origin master"*) hit="git push to the default branch" ;;
    esac ;;
esac

[ -z "$hit" ] && exit 0

cat >&2 <<MSG
⚠ pre-merge review gate ($hit): you are about to integrate into the default branch.
Confirm the Definition-of-Done review battery already RAN and passed (review precedes
integration, per .claude/rules/quality-gates.md "Definition-of-Done battery"):
  • any change      → full-repo pnpm typecheck + lint + test + build
  • component / UI   → /review-component + brand-ui-accessibility-reviewer (real-surface a11y)
  • security/network → /security-review
  • structural/API   → brand-ui-design-system-architect
  • merge-to-main / pre-publish → /prepare-release
If the battery has NOT run yet, run it FIRST, then merge/push. (Warning only — not blocked.)
MSG
exit 0
