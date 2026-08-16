#!/usr/bin/env bash
# close-issues-delegation-nudge.sh — Stop  (also: --ledger <transcript>)
# -----------------------------------------------------------------------------
# The runtime teeth for .claude/commands/close-issues.md ▸ "The delegation
# contract" + "Model routing". Those rules were prose for two full runs and both
# runs broke them without anything noticing. Measured by replaying the on-disk
# transcripts in ~/.claude/projects/-Users-czq-Documents-DEV-elabs-elabs-components/:
#
#   feadd8a6 (full run)  38 dispatches (19 sonnet / 19 opus) · largest parallel
#                        batch 1 · haiku 0 · 3 orchestrator source files edited
#                        · 642k main-thread output tokens on Opus
#   f50da42e (--only)    13 dispatches (8 sonnet / 5 opus) · largest parallel
#                        batch 1 · haiku 0 · 0 source edits (its 2 Writes were
#                        scratchpad briefs — exactly what the contract asks for)
#
# So this hook fires ONCE, at Stop, on a session that actually invoked
# /close-issues, and reports which of the four contract clauses the run broke:
#
#   1. SERIAL      — every Agent dispatch in its own message. Multiple Agent calls
#                    in ONE message run concurrently; one per message serializes the
#                    whole loop through the orchestrator (the expensive model).
#   2. SOURCE EDIT — the orchestrator edited product source itself. Its context is
#                    the most polluted in the loop and it is the actor that once
#                    committed conflict markers into 17 files. Briefs, scratchpad
#                    files, memory and handoff notes are NOT source and never count.
#   3. INHERITED   — a dispatch with no `model`, which silently inherits the session
#                    model (Opus) — the single most expensive default in the run.
#   4. NO CHEAP    — a large wave that never once reached for `haiku`. Advisory: the
#                    routing table allows a run where nothing qualified, but the
#                    report must then say so rather than omit it.
#
# It is a NUDGE, never a hard block: `stop_hook_active` bounds it to one fire per
# stop chain, exactly like gate-completion-claims.sh and session-cadence-nudge.sh
# (same exit contract — 2, so the message reaches the agent). Silent + exit 0 on the
# happy path, and silent on every session that did not run /close-issues.
#
# `--ledger <transcript.jsonl>` prints the same numbers and exits 0. That mode is
# what the command's report section calls, so the ledger in the report and the
# ledger in the nudge can never drift apart into two different definitions.
#
# Self-tested by scripts/check-close-issues-delegation.test.mjs
# (`pnpm close-issues:check:test`).
set -u

# A run this small can legitimately be serial (you cannot batch one agent).
SERIAL_MIN_DISPATCHES=3
# Below this, "no haiku at all" is not yet evidence of a routing failure.
HAIKU_MIN_DISPATCHES=8

command -v jq >/dev/null 2>&1 || exit 0

# --- Measurement -----------------------------------------------------------------
# Main thread only: a sidechain IS a subagent, and a subagent dispatching helpers is
# not an orchestrator failure. `Agent` is the current tool name and `Task` the legacy
# one — count both, so this survives the rename that already made the command's
# allowed-tools line stale.
measure() {
  local tp="$1"
  read -r dispatches batch haiku inherited <<EOF
$(jq -rs '
    def tools: (.message.content // []) | if type == "array" then . else [] end;
    [ .[]
      | select(((.isSidechain? // false) | not) and ((.message.role? // "") == "assistant"))
      | [ tools[] | select((.type? // "") == "tool_use" and (((.name? // "") == "Agent") or ((.name? // "") == "Task"))) ]
    ] as $per
    | [ ($per | map(length) | add // 0),
        ($per | map(length) | max // 0),
        ($per | flatten | map(select((.input.model? // "") == "haiku")) | length),
        ($per | flatten | map(select((.input.model? // "") == "")) | length) ]
    | @tsv
  ' "$tp" 2>/dev/null || echo "0	0	0	0")
EOF
  : "${dispatches:=0}" "${batch:=0}" "${haiku:=0}" "${inherited:=0}"

  # Product source only, and worktree copies count (the contract's whole point is
  # that `.claude/worktrees/<unit>/packages/**` is an AGENT's tree, not the
  # orchestrator's). Scratchpad briefs, memory files, handoff notes, docs and
  # `.claude/` config are not source and must never count — writing a brief to a
  # file is the behaviour this contract asks for, not a violation of it.
  source_edits="$(jq -rs '
      def tools: (.message.content // []) | if type == "array" then . else [] end;
      [ .[]
        | select(((.isSidechain? // false) | not) and ((.message.role? // "") == "assistant"))
        | tools[]
        | select((.type? // "") == "tool_use"
            and (((.name? // "") == "Edit") or ((.name? // "") == "Write")
              or ((.name? // "") == "MultiEdit") or ((.name? // "") == "NotebookEdit")))
        | (.input.file_path? // empty)
      ] | .[]
    ' "$tp" 2>/dev/null |
    grep -E '(^|/)(packages/[^/]+/(src|lib|bin)/|apps/[^/]+/(src|stories)/|skills/[^/]+/)' |
    sort -u | wc -l | tr -d ' ')"
  [ -z "$source_edits" ] && source_edits=0
}

ledger_line() {
  printf '%s dispatches · largest parallel batch %s · haiku %s · inherited-model %s · orchestrator source files edited %s\n' \
    "$dispatches" "$batch" "$haiku" "$inherited" "$source_edits"
}

# --- `--ledger` mode (used by the command's report section) ----------------------
if [ "${1:-}" = "--ledger" ]; then
  [ -f "${2:-}" ] || {
    echo "usage: close-issues-delegation-nudge.sh --ledger <transcript.jsonl>" >&2
    exit 1
  }
  measure "$2"
  ledger_line
  exit 0
fi

# --- Stop-hook mode ---------------------------------------------------------------
input="$(cat 2>/dev/null || true)"

# Loop guard: if we already nudged and the agent is stopping again, let it stop.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
[ "$active" = "true" ] && exit 0

tp="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -z "$tp" ] && exit 0
[ -f "$tp" ] || exit 0

# Did this session actually RUN /close-issues? Detection is the part an earlier hook
# (session-cadence-nudge.sh) got wrong twice, so it is deliberately narrow. Claude
# Code injects the command/skill roster into EVERY session as `type:"attachment"`
# lines, and this command's own description names itself — a whole-file grep for
# "close-issues" therefore matches every transcript in the project, including the
# session that merely edited the command. The only honest signal is the slash-command
# envelope Claude Code writes into the USER turn that invoked it:
#   <command-name>/close-issues</command-name>
# Attachments, meta lines, assistant prose and tool_result payloads are all dropped:
# reading or writing ABOUT the command is not running it.
invoked="$(jq -rs '
    map(select(((.type? // "") != "attachment") and ((.isMeta? // false) | not)))
    | map(select((.message.role? // "") == "user"))
    | map(.message.content // []
        | if type == "string" then [{ type: "text", text: . }] else . end
        | map(select((.type? // "") == "text") | (.text? // "")))
    | flatten
    | .[]
  ' "$tp" 2>/dev/null | grep -cE '<command-name>/?close-issues</command-name>' || true)"
[ -z "$invoked" ] && invoked=0
[ "$invoked" -ge 1 ] || exit 0

measure "$tp"

findings=""
if [ "$dispatches" -ge "$SERIAL_MIN_DISPATCHES" ] && [ "$batch" -le 1 ]; then
  findings="${findings}  • SERIAL: ${dispatches} dispatches, largest parallel batch 1. Independent agents (all triage, all disjoint-unit coders) go in ONE message; one-per-message serializes the run through the orchestrator.
"
fi
if [ "$source_edits" -gt 0 ]; then
  findings="${findings}  • SOURCE EDIT: the orchestrator edited ${source_edits} product file(s) itself. Target is 0 — dispatch an agent (conflict merges included) or name the file and why no agent could do it.
"
fi
if [ "$inherited" -gt 0 ]; then
  findings="${findings}  • INHERITED MODEL: ${inherited} dispatch(es) passed no \`model\` and silently ran on the session model. \`model\` is mandatory on every dispatch.
"
fi
if [ "$dispatches" -ge "$HAIKU_MIN_DISPATCHES" ] && [ "$haiku" -eq 0 ]; then
  findings="${findings}  • NO CHEAP TIER: ${dispatches} dispatches, \`haiku\` used 0 times. Allowed — but the report must say why nothing qualified, not omit it.
"
fi

[ -z "$findings" ] && exit 0

cat >&2 <<MSG
⚠ close-issues delegation nudge — this run broke its own contract
(.claude/commands/close-issues.md ▸ "The delegation contract" / "Model routing"):

${findings}
Dispatch ledger for the report: $(ledger_line)
State these numbers in the report's dispatch ledger — do not assert compliance you
did not measure — and fix what is still fixable before you finish.
MSG
exit 2
