#!/usr/bin/env bash
# check-theme-parity.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Dev-time heads-up for the theme-token-parity gate
# (#89): every theme block in packages/tokens/src/themes.css must define every
# semantic token the other theme blocks define — a missing token silently falls
# back to :root and renders wrong in that theme.
#
# Detection logic lives ONCE in scripts/check-theme-parity.mjs (shared with the
# blocking CI gate `pnpm theme-parity:check`) — this hook just runs it in --warn
# mode when the edited file is themes.css.
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

# Only the design-system theme source.
case "$file_path" in
  *packages/tokens/src/themes.css) ;;
  *) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
script="$root/scripts/check-theme-parity.mjs"
[ -f "$script" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# Delegate to the single detection implementation in --warn mode: it prints any
# finding to stderr (which PostToolUse surfaces) and never exits non-zero.
node "$script" --warn 1>/dev/null || true
exit 0
