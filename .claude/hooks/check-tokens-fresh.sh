#!/usr/bin/env bash
# check-tokens-fresh.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Dev-time heads-up for the DTCG ⇄ themes.css
# freshness gate (WP-04 #61): the token VALUES live in the DTCG source under
# packages/tokens/tokens/, and src/themes.css must stay in sync with them. Edit
# a token value in the JSON (or hand-edit a synced value in themes.css) without
# re-running `pnpm --filter @qlik-coe-emea/qlabs-components-tokens tokens:build` and the file goes stale.
#
# Detection logic lives ONCE in scripts/check-tokens-fresh.mjs (shared with the
# blocking CI gate `pnpm tokens:check`) — this hook just runs it in --warn mode
# when a *.tokens.json or themes.css is written.
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

# Only the DTCG token source or the design-system theme CSS.
case "$file_path" in
  *packages/tokens/tokens/*.tokens.json) ;;
  *packages/tokens/src/themes.css) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
script="$root/scripts/check-tokens-fresh.mjs"
[ -f "$script" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# Delegate to the single detection implementation in --warn mode: it prints any
# finding to stderr (which PostToolUse surfaces) and never exits non-zero.
node "$script" --warn 1>/dev/null || true
exit 0
