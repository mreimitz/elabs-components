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
#   * reading secret files (.env, *.pem, *.key, id_rsa, credentials)
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
case "$norm" in
  *"cat "*".env"*|*"cat "*".pem"*|*"cat "*".key"*|*"cat "*"id_rsa"*|*"cat "*"credentials"*|\
  *"less "*".env"*|*"head "*".env"*|*"tail "*".env"*|*"cat "*"/secrets/"*)
    block "reading a secret/credential file" ;;
esac

# Pipe-to-shell from the network.
case "$norm" in
  *"curl "*"| sh"*|*"curl "*"| bash"*|*"wget "*"| sh"*|*"wget "*"| bash"*)
    block "piping a network download directly into a shell" ;;
esac

exit 0
