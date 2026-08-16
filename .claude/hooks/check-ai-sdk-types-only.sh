#!/usr/bin/env bash
# check-ai-sdk-types-only.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Dev-time heads-up for decision D6 / ADR-0008:
# `@elabs/components-ai` may import the Vercel AI SDK (`ai`) and `@ai-sdk/*` as TYPES ONLY —
# never the runtime. Warns the moment an edited packages/ai source file gains a
# value import (useChat, streamText, providers, a default/namespace/side-effect/
# dynamic import, or a value re-export).
#
# Detection logic lives ONCE in scripts/check-ai-sdk-types-only.mjs (shared with the
# blocking CI gate `pnpm ai:types-only`) — this hook just routes the edited file to
# it in --warn mode. (WP-12 #97.)
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

# Only TypeScript sources inside packages/ai/src (skip tests/stories).
case "$file_path" in
  *packages/ai/src/*.ts | *packages/ai/src/*.tsx) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  *.test.ts | *.test.tsx | *.stories.tsx) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
script="$root/scripts/check-ai-sdk-types-only.mjs"
[ -f "$script" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# Delegate to the single detection implementation in --warn mode: it prints any
# finding to stderr (which PostToolUse surfaces) and never exits non-zero. Discard
# stdout; guard so a script hiccup can never block an edit.
node "$script" --warn --file "$file_path" 1>/dev/null || true
exit 0
