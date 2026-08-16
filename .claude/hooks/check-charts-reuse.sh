#!/usr/bin/env bash
# check-charts-reuse.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Dev-time heads-up for the charts reuse gate (#169):
# `@qlik-coe-emea/qlabs-components-charts` must not define components whose names collide with `@qlik-coe-emea/qlabs-components-ui`
# exports, and must not import from `@base-ui/react` or `@base-ui/*`.
#
# Detection logic lives ONCE in scripts/check-charts-reuse.mjs (shared with the
# blocking CI gate `pnpm charts:reuse:check`) — this hook just routes the edited
# file to it in --warn mode.
set -u

input="$(cat 2>/dev/null || true)"

file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file_path" ]; then
  file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi
[ -z "$file_path" ] && exit 0

# Only TypeScript sources inside packages/charts/src (skip tests/stories).
case "$file_path" in
  *packages/charts/src/*.ts | *packages/charts/src/*.tsx) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  *.test.ts | *.test.tsx | *.stories.tsx) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
script="$root/scripts/check-charts-reuse.mjs"
[ -f "$script" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# Delegate to the single detection implementation in --warn mode: it prints any
# finding to stderr (which PostToolUse surfaces) and never exits non-zero.
node "$script" --warn --file "$file_path" 1>/dev/null || true
exit 0
