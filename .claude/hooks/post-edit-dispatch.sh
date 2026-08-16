#!/usr/bin/env bash
# post-edit-dispatch.sh — the single PostToolUse(Write|Edit) entrypoint.
# -----------------------------------------------------------------------------
# Parses the hook JSON ONCE, derives tool_input.file_path ONCE, then invokes
# ONLY the sub-hooks whose path-glob matches the edited file — instead of the
# harness spawning all ten PostToolUse hooks on every single Write|Edit (where
# 6–8 of them would just re-parse stdin and early-exit).
#
# Why a dispatcher (not ten settings.json entries):
#   * one subprocess + one jq parse per edit instead of ten;
#   * a typical packages/ui/src/components/x/x.tsx edit fans out to 3 sub-hooks,
#     a plain .md edit to 1, instead of 10 spawns every time;
#   * each sub-hook stays a standalone, independently-testable script — this
#     file only decides WHICH run, it does not reimplement their logic.
#
# Behaviour preservation:
#   * format-after-edit runs FIRST (it rewrites the file via Prettier) so the
#     content-reading validators see the formatted file, exactly as before;
#   * a sub-hook that hard-blocks (validate-claude-artifacts exits 2 on broken
#     settings JSON / bad bash) propagates: the FIRST non-zero exit becomes the
#     dispatcher's exit code, so the block still reaches Claude Code.
#
# Testability:
#   * DISPATCH_DRY_RUN=1 prints the matched sub-hook names (one per line) and
#     exits 0 WITHOUT running them — drives scripts/check-edit-dispatch.test.mjs.
#
# Routing is a verbatim mirror of each sub-hook's own primary path guard; the
# sub-hooks keep their secondary guards, so a redundant match is still correct.
set -u

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
input="$(cat 2>/dev/null || true)"

# --- parse file_path ONCE (jq, with a POSIX sed fallback) --------------------
file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file_path" ]; then
  file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi
[ -z "$file_path" ] && exit 0

# --- skip generated / vendored paths (mirrors format-after-edit) -------------
case "$file_path" in
  *node_modules/*|*/dist/*|*/storybook-static/*|*/.turbo/*|*/coverage/*|*/registry/__output/*)
    exit 0 ;;
esac

# --- build the matching sub-hook list by path --------------------------------
# Order matters: format-after-edit FIRST so validators read the formatted file.
hooks=""
add() { hooks="$hooks $1"; }

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.mdx) add format-after-edit.sh ;;
esac
case "$file_path" in
  *packages/*/src/*.ts|*packages/*/src/*.tsx|*apps/*/src/*.ts|*apps/*/src/*.tsx)
    add validate-component-boundaries.sh ;;
esac
case "$file_path" in
  *.claude/*) add validate-claude-artifacts.sh ;;
esac
case "$file_path" in
  *packages/*/package.json) add check-package-registered.sh ;;
esac
case "$file_path" in
  *packages/ui/src/components/*) add check-component-registered.sh ;;
esac
case "$file_path" in
  *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.stories.ts|*.stories.tsx|*.stories.js|*.stories.jsx)
    add check-mock-masking.sh ;;
esac
# charts / ai: source files only, NOT tests/stories (mirrors the sub-hook guard).
case "$file_path" in
  *.test.ts|*.test.tsx|*.stories.tsx) ;;
  *packages/charts/src/*.ts|*packages/charts/src/*.tsx) add check-charts-reuse.sh ;;
esac
case "$file_path" in
  *.test.ts|*.test.tsx|*.stories.tsx) ;;
  *packages/ai/src/*.ts|*packages/ai/src/*.tsx) add check-ai-sdk-types-only.sh ;;
esac
case "$file_path" in
  *packages/tokens/src/themes.css) add check-theme-parity.sh ;;
esac
case "$file_path" in
  *packages/tokens/tokens/*.tokens.json|*packages/tokens/src/themes.css) add check-tokens-fresh.sh ;;
esac

[ -z "$hooks" ] && exit 0

# --- dry-run: print the route set for the self-test, run nothing -------------
if [ "${DISPATCH_DRY_RUN:-0}" = "1" ]; then
  for h in $hooks; do echo "$h"; done
  exit 0
fi

# --- run the matched sub-hooks, re-feeding the original JSON on stdin --------
# Propagate the first non-zero exit so a hard-block (exit 2) still fires.
rc=0
for h in $hooks; do
  script="$HOOK_DIR/$h"
  [ -f "$script" ] || continue
  printf '%s' "$input" | bash "$script"
  code=$?
  if [ "$code" -ne 0 ] && [ "$rc" -eq 0 ]; then rc=$code; fi
done
exit "$rc"
