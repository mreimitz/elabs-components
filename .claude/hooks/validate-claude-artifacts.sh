#!/usr/bin/env bash
# validate-claude-artifacts.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# Self-consistency linter for this repo's own agent-governance artifacts under
# .claude/. Catches the class of mistakes that /session-retro issue #12 was filed
# for — artifacts authored in isolation that don't agree with their own setup:
#   1. .claude/settings*.json that no longer parses as JSON        → hard block (exit 2)
#   2. a .claude/hooks/*.sh with a bash syntax error               → hard block (exit 2)
#   3. a .claude/commands/*.md whose prose invokes a Bash(<cmd>)
#      not covered by its own front-matter allowed-tools           → advisory (exit 0)
#
# Cases 1–2 break the harness silently, so they block; case 3 is heuristic, so it
# only warns. Reads the hook JSON from stdin and pulls tool_input.file_path (jq
# with a POSIX sed fallback), matching the sibling PostToolUse hooks. Quiet on the
# happy path.
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

# Only inspect our own .claude/ governance artifacts.
case "$file_path" in
  *.claude/*) ;;
  *) exit 0 ;;
esac

warn() { echo "⚠ artifact check ($(basename "$file_path")): $1" >&2; }

# 1. settings*.json must parse — broken settings are silently ignored by Claude Code.
case "$file_path" in
  *.claude/settings.json | *.claude/settings.local.json)
    if command -v node >/dev/null 2>&1; then
      if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$file_path" 2>/dev/null; then
        echo "✖ $file_path is not valid JSON — Claude Code will ignore it until fixed." >&2
        exit 2
      fi
    fi
    exit 0
    ;;
esac

# 2. hook scripts must be syntactically valid bash.
case "$file_path" in
  *.claude/hooks/*.sh)
    if ! bash -n "$file_path" 2>/dev/null; then
      echo "✖ $file_path has a bash syntax error (bash -n failed)." >&2
      exit 2
    fi
    exit 0
    ;;
esac

# 3. a command's prose must not invoke a Bash(<cmd>) outside its own allowed-tools.
case "$file_path" in
  *.claude/commands/*.md)
    allowed="$(sed -n 's/^allowed-tools:[[:space:]]*//p' "$file_path" | head -n1)"
    [ -z "$allowed" ] && exit 0
    # a bare `Bash` (no parens) in allowed-tools grants everything → nothing to check
    printf '%s' "$allowed" | grep -Eq '(^|[,[:space:]])Bash([,[:space:]]|$)' && exit 0
    # commands used on the first word of lines inside ```bash fenced blocks
    used="$(awk '/^```bash/{inb=1;next} /^```/{inb=0;next} inb{print}' "$file_path" |
      grep -vE '^[[:space:]]*#' |
      grep -oE '\b(gh|git|node|pnpm|npx|chmod|jq|shellcheck|bash|sed|awk|find|rg|ls|cat|mkdir|rm|cp|mv|curl|wget)\b' |
      sort -u)"
    miss=""
    for cmd in $used; do
      # covered if allowed-tools has Bash(<cmd>) where <cmd> is followed by : ) or space
      printf '%s' "$allowed" | grep -Eq "Bash\\(${cmd}[:) ]" && continue
      miss="$miss $cmd"
    done
    [ -n "$miss" ] && warn "prose uses command(s) not in allowed-tools:$miss — add Bash(<cmd>:*) to the front-matter (advisory)."
    exit 0
    ;;
esac

exit 0
