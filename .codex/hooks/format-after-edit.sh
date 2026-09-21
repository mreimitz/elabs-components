#!/usr/bin/env bash
# format-after-edit.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# Formats ONLY the file that was just written/edited, if it is a supported type.
# Design goals (per repo rules):
#   * never fail destructively — always exit 0 so edits are never blocked
#   * be safe before dependencies are installed (no Prettier? skip silently)
#   * skip generated / vendored files
#
# It reads the hook JSON from stdin and pulls `tool_input.file_path`. jq is used
# when available, with a POSIX sed fallback so the hook works without jq.
set -u

input="$(cat 2>/dev/null || true)"

# --- extract the edited file path -------------------------------------------
file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file_path" ]; then
  file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

# --- skip generated / vendored paths ----------------------------------------
case "$file_path" in
  *node_modules/*|*/dist/*|*/storybook-static/*|*/.turbo/*|*/coverage/*|*/registry/__output/*)
    exit 0 ;;
esac

# --- only format supported extensions ---------------------------------------
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.mdx) ;;
  *) exit 0 ;;
esac

# --- run Prettier if we can find it; otherwise no-op ------------------------
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -x "$PROJECT_DIR/node_modules/.bin/prettier" ]; then
  "$PROJECT_DIR/node_modules/.bin/prettier" --write --log-level warn "$file_path" >/dev/null 2>&1 || true
elif command -v pnpm >/dev/null 2>&1; then
  (cd "$PROJECT_DIR" && pnpm exec prettier --write --log-level warn "$file_path" >/dev/null 2>&1) || true
fi

exit 0
