#!/usr/bin/env bash
# block-dangerous-commands.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# Deterministic guard rail. Reads the proposed Bash command from the hook JSON
# (tool_input.command) and BLOCKS clearly dangerous operations by exiting 2 with
# a human-readable reason on stderr (Claude Code feeds stderr back to the model
# and cancels the tool call on exit 2).
#
# Blocks:
#   * rm -rf on / ~ $HOME or with a leading "/" or "*" target
#   * deleting a .git directory
#   * git push --force / -f   (unless ALLOW_FORCE_PUSH=1 is exported)
#   * reading secret files (.env, *.pem, *.key, id_rsa, credentials) passed to a reader (cat, head, less, …)
#   * sudo, and curl|wget piped into a shell
#   * disk-wrecking primitives: mkfs, dd of=, writing to /dev/sd*
set -u

input="$(cat 2>/dev/null || true)"

cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
fi
if [ -z "$cmd" ]; then
  cmd="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -n1)"
fi

[ -z "$cmd" ] && exit 0

block() {
  echo "BLOCKED by .claude/hooks/block-dangerous-commands.sh: $1" >&2
  echo "Command: $cmd" >&2
  exit 2
}

# Normalize whitespace for matching.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

case "$norm" in
  *"rm -rf /"*|*"rm -rf /*"*|*"rm -fr /"*|*"rm -rf ~"*|*"rm -rf \$HOME"*|*"rm -rf --no-preserve-root"*)
    block "recursive force-delete targeting root/home" ;;
  *"rm -rf .git"*|*"rm -rf ./.git"*|*"rm -r .git"*)
    block "deletion of the .git directory" ;;
  *"sudo "*)
    block "sudo is not permitted in this project" ;;
  *"mkfs"*|*" dd "*"of="*|*"> /dev/sd"*|*"of=/dev/"*)
    block "disk-destroying primitive (mkfs/dd/device write)" ;;
esac

# Force push (allow opt-out via env for the rare deliberate case).
case "$norm" in
  *"git push --force"*|*"git push -f"*|*"git push "*" --force"*|*"git push "*" -f"*)
    if [ "${ALLOW_FORCE_PUSH:-0}" != "1" ]; then
      block "force push (set ALLOW_FORCE_PUSH=1 to override deliberately)"
    fi ;;
esac

# Reading secrets.
# A secret-ish token only counts when it is an ARGUMENT to a reader command —
# never merely present somewhere in the command string. The old unanchored
# globs refused innocent things like piping a file into `jq -r '.keys'`.
#
# The command is split into segments on shell separators (newlines included,
# so $cmd is used here rather than the flattened $norm), each segment is judged
# on its own, and within a segment the first word (after assignments, wrappers,
# keywords and options) must be a reader before any later word is tested as a
# path. Separators inside quotes still split, so an inner command passed to
# `bash -c` is judged too; grouping parens inside quotes do not, because there
# they are text.

# Readers that dump a file's contents to stdout or a pager.
is_reader() {
  case "${1##*/}" in
    cat|bat|less|more|head|tail|tac|nl|xxd|od|strings|base64) return 0 ;;
  esac
  return 1
}

# Words that may sit in front of the real command word.
is_prefix_word() {
  case "${1##*/}" in
    sudo|doas|env|command|builtin|exec|eval|nohup|time|nice|xargs) return 0 ;;
    bash|sh|zsh|dash|ksh) return 0 ;; # an inner -c command still counts
    do|then|else|elif) return 0 ;;    # loop / conditional body
    -*) return 0 ;;                   # an option of one of the above
    "{"|"}"|"("|")"|"!") return 0 ;;  # grouping / negation
    *=*) return 0 ;;                  # leading VAR=value assignment
  esac
  return 1
}

# Does this argument name a secret/credential file?
is_secret_path() {
  case "$1" in
    */secrets/*|secrets/*) return 0 ;;
    *.env*|*.pem*|*.key*|*id_rsa*|*credentials*) return 0 ;;
  esac
  return 1
}

# One segment per line: quotes are dropped (so a quoted path is still seen),
# a newline, `|`, `;`, `&`, a backtick and `$(` always split, `(`/`)` split
# only outside quotes, `<`/`>` become their own words (so `cat<.env` is seen)
# while `<<`/`>>` stay whole, and the result is lower-cased so an upper-case
# name cannot slip past.
segments="$(printf '%s\n' "$cmd" | awk '
BEGIN { sq = sprintf("%c", 39) }
{
  q = ""; out = ""
  for (i = 1; i <= length($0); i++) {
    c = substr($0, i, 1)
    if (q == "" && (c == sq || c == "\"")) { q = c; continue }
    if (q != "" && c == q) { q = ""; continue }
    if (c == "$" && substr($0, i + 1, 1) == "(") { out = out "\n"; i++; continue }
    if (c == "|" || c == ";" || c == "&" || c == "`") { out = out "\n"; continue }
    if (q == "" && (c == "(" || c == ")")) { out = out "\n"; continue }
    out = out c
  }
  gsub(/</, " < ", out); gsub(/>/, " > ", out)  # isolate redirect operators
  gsub(/ <  < /, " << ", out)                   # but keep << and >> whole
  gsub(/ >  > /, " >> ", out)
  print tolower(out)
}')"

set -f # no pathname expansion while word-splitting the segments
while IFS= read -r seg; do
  [ -z "$seg" ] && continue
  verb=""
  for tok in $seg; do
    if [ -z "$verb" ]; then
      is_prefix_word "$tok" && continue
      is_reader "$tok" || break # not a reader: this segment reads no file
      verb="$tok"
      continue
    fi
    case "$tok" in
      "<<"*) break ;;             # heredoc/herestring body is data, not a path
      "<"|">"|">>") continue ;;   # bare operator; the path is the next word
    esac
    [ -z "$tok" ] && continue
    if is_secret_path "$tok"; then
      set +f
      block "reading a secret/credential file"
    fi
  done
done <<SEGMENTS
$segments
SEGMENTS
set +f

# Pipe-to-shell from the network.
case "$norm" in
  *"curl "*"| sh"*|*"curl "*"| bash"*|*"wget "*"| sh"*|*"wget "*"| bash"*)
    block "piping a network download directly into a shell" ;;
esac

exit 0
