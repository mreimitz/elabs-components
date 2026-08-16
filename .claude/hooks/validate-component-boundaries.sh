#!/usr/bin/env bash
# validate-component-boundaries.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# Lightweight, NON-BLOCKING architectural linter. Prints advisory warnings to
# stderr and always exits 0 (per repo rules: "keep it lightweight and
# non-annoying"). Promote a check to `exit 2` only if you want it to hard-block.
#
# Warns when an edited package/app source file:
#   1. reaches across packages with deep relative paths (../../..) instead of
#      the public @qlik-coe-emea/qlabs-components-* package alias
#   2. imports a package's private internals via @qlik-coe-emea/qlabs-components-<pkg>/src/...
#   3. hardcodes a raw hex color (use semantic tokens; tokens package exempt)
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
[ -f "$file_path" ] || exit 0

# Only inspect TS/TSX inside package or app source trees.
case "$file_path" in
  *packages/*/src/*.ts|*packages/*/src/*.tsx|*apps/*/src/*.ts|*apps/*/src/*.tsx) ;;
  *) exit 0 ;;
esac

warn() { echo "⚠ boundary check ($file_path): $1" >&2; }

# 1. relative imports deep enough to escape a package (../../.. or more, or any
#    path that walks into packages/). Within-package imports (e.g. ../../lib) are
#    only two levels deep and are intentionally NOT flagged.
if grep -Eq "from \"(\.\./){3,}" "$file_path" 2>/dev/null || \
   grep -Eq "from \"[^\"]*\.\./[^\"]*packages/" "$file_path" 2>/dev/null; then
  warn "relative import escapes the package — import from the @qlik-coe-emea/qlabs-components-* package alias instead of crossing boundaries."
fi

# 2. importing a package's private internals
if grep -Eq "from \"@qlik-coe-emea/qlabs-components-[a-z-]+/src/" "$file_path" 2>/dev/null; then
  warn "imports @qlik-coe-emea/qlabs-components-<pkg>/src/... — use the package's public entry (its index) instead of internals."
fi

# 3. raw hex colors outside the tokens package
case "$file_path" in
  *packages/tokens/*) ;; # tokens are allowed to define raw colors
  *)
    if grep -Eiq "#[0-9a-f]{3}([0-9a-f]{3})?\b" "$file_path" 2>/dev/null; then
      warn "raw hex color detected — use semantic tokens (e.g. bg-primary, text-muted-foreground)."
    fi ;;
esac

# 4. raw animation timing literals — use the gated motion tokens so the
#    --motion-factor gate + reduced-motion can scale them. Stories/tests exempt;
#    ease-linear is an allowed built-in for loops.
case "$file_path" in
  *.stories.tsx|*.test.tsx|*.test.ts|*packages/tokens/*) ;;
  *)
    if grep -Eq '(^|[" ])duration-[0-9]+' "$file_path" 2>/dev/null; then
      warn "raw duration-<n> literal — use duration-fast/base/slow/slower so motion can be themed + reduced."
    fi
    if grep -Eq '(^|[" ])ease-(in-out|in|out)\b' "$file_path" 2>/dev/null; then
      warn "raw ease-(in|out|in-out) — use ease-standard/ease-entrance/ease-exit (ease-linear ok for loops)."
    fi ;;
esac

exit 0
