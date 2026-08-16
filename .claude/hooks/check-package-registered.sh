#!/usr/bin/env bash
# check-package-registered.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# NON-BLOCKING (always exit 0). Two warnings on a packages/<pkg>/package.json write:
#   1. a NEW library package whose name isn't referenced in CLAUDE.md — so a new
#      packages/<pkg> can't stay invisible to the agent/skill path.
#   2. a NEW public `exports` subpath key (vs the git-committed baseline) — a
#      subpath is a structural API change (route via brand-ui-design-system-architect +
#      register for discovery), see quality-gates.md "Adding a new package or a
#      public subpath export" + .claude/rules/component-api.md "Subpath exports".
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

# Only a package.json directly under packages/<pkg>/
case "$file_path" in
  *packages/*/package.json) ;;
  *) exit 0 ;;
esac

pkg_dir="$(dirname "$file_path")"
[ -f "$file_path" ] || exit 0

# --- (2) new public subpath export key (vs git-committed baseline) ------------
# Only meaningful when jq + git are available; silently skip otherwise.
if command -v jq >/dev/null 2>&1 && command -v git >/dev/null 2>&1; then
  root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  # subpath keys = exports keys other than ".".
  new_keys="$(jq -r '(.exports // {}) | keys[]? | select(. != ".")' "$file_path" 2>/dev/null | sort -u)"
  if [ -n "$new_keys" ]; then
    rel="$(git -C "$root" ls-files --full-name -- "$file_path" 2>/dev/null | head -n1)"
    old_keys=""
    if [ -n "$rel" ]; then
      old_keys="$(git -C "$root" show "HEAD:$rel" 2>/dev/null | jq -r '(.exports // {}) | keys[]? | select(. != ".")' 2>/dev/null | sort -u)"
    fi
    added=""
    while IFS= read -r k; do
      [ -z "$k" ] && continue
      if ! printf '%s\n' "$old_keys" | grep -qxF "$k"; then
        added="$added $k"
      fi
    done <<EOF
$new_keys
EOF
    # No git baseline (new/untracked file, or git show failed) → old_keys empty,
    # so every subpath counts as "added" and is worth a one-time heads-up.
    if [ -n "$added" ]; then
      cat >&2 <<MSG
⚠ subpath-export check ($(basename "$pkg_dir")): new public \`exports\` subpath:$added
A subpath is a structural API change, not an implementation detail. Per
quality-gates.md "Adding a new package or a public subpath export" + component-api.md
"Subpath exports" (gate: lighter dep-tree AND a real consumer needing the leaf):
  • route the decision through brand-ui-design-system-architect;
  • add it in all three places — exports + publishConfig.exports + tsup.config.ts entry;
  • register for discovery — run \`pnpm manifest\` and update the docs/skill surfaces.
MSG
    fi
  fi
fi

# --- (1) new library package not registered in CLAUDE.md ---------------------
# Only library packages that ship a public entry; skip config/cli packages.
[ -f "$pkg_dir/src/index.ts" ] || exit 0

name=""
if command -v jq >/dev/null 2>&1; then
  name="$(jq -r '.name // empty' "$file_path" 2>/dev/null || true)"
fi
[ -z "$name" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
claude="$root/CLAUDE.md"
[ -f "$claude" ] || exit 0

if ! grep -qF "$name" "$claude" 2>/dev/null; then
  cat >&2 <<MSG
⚠ new-package check: $name is not referenced in CLAUDE.md.
Register a new packages/* into the agent/skill path (quality-gates.md "Adding a new package"):
  CLAUDE.md packages list + one-way dep line · .claude/commands/new-component.md targets ·
  skills/brand-ui*/SKILL.md · PROJECT.md · AGENTS.md · apps/docs/stories/Introduction.mdx ·
  Storybook storySort · then run \`pnpm manifest\`.
MSG
fi
exit 0