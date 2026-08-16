#!/usr/bin/env bash
# check-git-add-all.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Warns when a Bash command stages with `git add -A`
# or `git add .` — CLAUDE.md requires staging files BY NAME so a commit can't
# accidentally sweep in secrets (.env), large binaries, or unrelated in-flight work
# (e.g. uncommitted changes living in the same tree). Nudge, don't block. (meta #138)
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

# Match `git add -A`, `git add --all`, `git add .`, `git add -A .` (with flag clusters).
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+add[[:space:]]+(-[A-Za-z]*A|--all|\.)([[:space:]]|$)'; then
  cat >&2 <<'MSG'
⚠ git-staging: prefer staging files BY NAME over `git add -A` / `git add .`.
CLAUDE.md: name the files (`git add path/a path/b`) so a commit can't sweep in
secrets, binaries, or unrelated in-flight changes sharing the tree. (meta #138)
MSG
fi
exit 0
