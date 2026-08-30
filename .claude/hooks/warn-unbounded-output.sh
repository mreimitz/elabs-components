#!/usr/bin/env bash
# warn-unbounded-output.sh — PreToolUse(Bash)
# -----------------------------------------------------------------------------
# WARN-ONLY (always exit 0). Reads the proposed Bash command from the hook JSON
# (tool_input.command) and, when it would dump an UNBOUNDED amount of text into
# the context, prints the bounded form instead. It never blocks — sometimes the
# whole output really is wanted, and a blocking hook here would be routed around
# within a day.
#
# Why this exists (measured, `.repo-cleanup/report.md`). Re-measured 2026-08-30 over
# 32 transcripts / 6,324 requests: tool results are 63.6 % of all context characters
# (10.4 M of 16.4 M) and Bash is 2,671 of the tool calls — still the dominant term by
# a wide margin, and still the one this hook exists for. (The 2026-08-02 run of the
# same analyzer read a larger, older transcript set and reported 79 % / 18,955; the
# share moved, the conclusion did not.) Every unfiltered command output is re-read on
# every later request of that context, so an unbounded dump is not paid once — it is
# paid for the rest of the session. See .claude/rules/quality-gates.md ("Enforcement
# over reminders").
#
# Quiet on the happy path: a command that already bounds itself (head/tail/wc, a
# --stat/--name-only, a jq selector, an output redirect to a file) never warns.
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

# Normalize whitespace for matching.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

# ── Already bounded? Then stay quiet. ────────────────────────────────────────
# A redirect to a file keeps the bytes OUT of the context entirely, which is the
# behaviour this hook is trying to encourage — never warn on it.
case "$norm" in
  *" > "*|*" >> "*|*"| head"*|*"| tail"*|*"| wc"*|*"|head"*|*"|tail"*|*"|wc"*) exit 0 ;;
  *" head "*|*" tail "*|*" wc "*) exit 0 ;;
  *"--stat"*|*"--name-only"*|*"--name-status"*|*"--quiet"*|*"--oneline"*) exit 0 ;;
  *"-maxdepth"*|*"-print -quit"*) exit 0 ;;
esac

hit=""
fix=""
case "$norm" in
  "cat "*|*"; cat "*|*"&& cat "*|*"| cat "*)
    hit="a bare \`cat\`"
    fix="Read the file with an offset/limit, or bound it: \`head -c 2000 <file>\` / \`sed -n '1,80p' <file>\`" ;;
esac
if [ -z "$hit" ]; then
  case "$norm" in
    *"git log -p"*|*"git log --patch"*|*"git show"*)
      hit="a full-patch git dump"
      fix="use \`--stat\` / \`--name-only\` first, and open only the hunks you need" ;;
    *"git diff"*)
      hit="an unbounded \`git diff\`"
      fix="use \`git diff --stat\` (or \`--name-only\`), then diff the one path that matters" ;;
    *"jq . "*|*"jq '.' "*|*'jq "." '*)
      hit="a whole-JSON \`jq .\` dump"
      fix="select what you need: \`jq '.some.path' <file>\`, or write it to a file and read a slice" ;;
    *"ls -R"*|*"find . "*|*"find /"*)
      hit="an unbounded recursive listing"
      fix="bound it: add \`-maxdepth N\`, a name filter, or \`| head -50\`" ;;
  esac
fi

[ -z "$hit" ] && exit 0

cat >&2 <<MSG
⚠ unbounded output ($hit): this looks like it will dump an unbounded amount of text
into the context. Tool results are already 64 % of context characters in this repo,
and an unfiltered result is re-read on every later request of this context.
  → $fix
  → Or write it to a file and read a slice: \`… > /tmp/out.txt\` then read what you need.
(Warning only — not blocked. If you genuinely need the whole output, proceed.)
MSG
exit 0
