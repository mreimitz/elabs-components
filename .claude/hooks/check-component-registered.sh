#!/usr/bin/env bash
# check-component-registered.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Component-level sibling of check-package-registered.sh.
# Warns when a @elabs/components-ui component folder (packages/ui/src/components/<name>/) is
# written but NOT re-exported from the package barrel (src/index.ts) — i.e. the
# component is invisible to consumers, the manifest, and the Storybook-MCP path.
#
# This is the local heads-up on the happy path; the universal backstop is the CI
# gate `pnpm components:check` (scripts/check-components-registered.mjs). (WP-10 #86.)
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

# Only a file inside packages/ui/src/components/<name>/
case "$file_path" in
  *packages/ui/src/components/*) ;;
  *) exit 0 ;;
esac

# Component folder name = the path segment right after components/
name="$(printf '%s' "$file_path" | sed -n 's#.*packages/ui/src/components/\([^/]*\)/.*#\1#p' | head -n1)"
[ -z "$name" ] && exit 0
# Skip intentional internal-only folders (leading underscore) — matches the CI gate.
case "$name" in _*) exit 0 ;; esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
barrel="$root/packages/ui/src/index.ts"
[ -f "$barrel" ] || exit 0

if ! grep -qF "./components/$name" "$barrel" 2>/dev/null; then
  cat >&2 <<MSG
⚠ component-registration: @elabs/components-ui components/$name/ is not re-exported from src/index.ts.
A component with no barrel export is invisible to consumers, the manifest, and the
Storybook-MCP agent path. Register it (or scaffold via /new-component):
  • add  export * from "./components/$name";  to packages/ui/src/index.ts
  • add a co-located $name.stories.tsx
  • run  pnpm manifest   (refresh the ground-truth manifest)
The CI gate \`pnpm components:check\` enforces this on every PR.
MSG
fi
exit 0
