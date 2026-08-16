#!/usr/bin/env bash
# session-cadence-nudge.sh — Stop
# -----------------------------------------------------------------------------
# The runtime teeth for quality-gates.md ▸ "Session cadence (review your own work
# — wired, not remembered)". After a LARGER building session the agent is supposed
# to run its own review battery (/visual-review, the accessibility reviewer,
# /review-component, /session-retro). That was prose only — WP-10 #67's DoD called
# for a bounded Stop nudge and it was never built.
#
# This nudges ONCE when the session edited >= THRESHOLD distinct PRODUCT files and
# the agent never actually DISPATCHED a self-review (see the evidence rules below —
# neither raw transcript bytes nor the agent's own prose count; both silently
# disabled earlier revisions of this hook). It is a NUDGE, never a hard block:
# `stop_hook_active` bounds it to a single fire per stop chain, exactly like
# gate-completion-claims.sh (same exit contract — 2 so the message reaches the
# agent). Silent + exit 0 on the happy path.
#
# Self-tested by scripts/check-session-cadence.test.mjs (`pnpm cadence:check:test`).
set -u

# How many distinct product files make a session "larger". Judgment call, kept as
# one tunable constant: below this, the review battery is disproportionate.
THRESHOLD=5

input="$(cat 2>/dev/null || true)"
command -v jq >/dev/null 2>&1 || exit 0

# Loop guard: if we already nudged and the agent is stopping again, let it stop.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
[ "$active" = "true" ] && exit 0

tp="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -z "$tp" ] && exit 0
[ -f "$tp" ] || exit 0

# Distinct product files this session wrote: assistant tool_use blocks for the
# file-writing tools, narrowed to the component/app source trees. Scripts, docs,
# rules and hooks are deliberately NOT counted — the battery is about UI surfaces.
edited="$(jq -rs '
    map(select(.message.role == "assistant"))
    | map(.message.content // [])
    | flatten
    | map(select((.type? // "") == "tool_use"
        and ((.name? // "") == "Write" or (.name? // "") == "Edit" or (.name? // "") == "MultiEdit")))
    | map(.input.file_path? // empty)
    | .[]
  ' "$tp" 2>/dev/null |
  grep -E '(^|/)packages/[^/]+/src/|(^|/)apps/[^/]+/(src|stories)/' |
  grep -Ev '\.(test|spec)\.[jt]sx?$' |
  sort -u | wc -l | tr -d ' ')"
[ -z "$edited" ] && edited=0
[ "$edited" -ge "$THRESHOLD" ] || exit 0

# Already reviewed? Scope the answer to what was actually EXECUTED — never to raw
# transcript bytes, and never to the agent's own prose. Two failure modes, both
# observed by replaying this hook over the real transcripts in
# ~/.claude/projects/-Users-czq-Documents-DEV-qlabs-qlabs-components/:
#
#   1. Whole-file grep — Claude Code injects `type:"attachment"` lines into EVERY
#      session (`agent_listing_delta` enumerates `brand-ui-*-reviewer`,
#      `skill_listing` enumerates `review-component` / `visual-review` /
#      `session-retro`), so a raw grep matched on line ~5 of every transcript and
#      the hook could never fire. A `Read` of quality-gates.md (tool_result), a
#      `<system-reminder>`, and a `Write` of a plan that quotes the battery hit the
#      same grep — reading or writing ABOUT a review is not running one.
#   2. Assistant TEXT — prose is not an action, and the prose that talks about the
#      battery is overwhelmingly the prose that DECLINES it: "a
#      brand-ui-visual-ux-reviewer three-theme sweep on a real screen is still
#      owed", "if you want the belt-and-suspenders render check, run
#      /visual-review". Counting it inverted the hook, silencing it on exactly the
#      sessions it exists to catch (two 18/19-product-file sessions with ZERO
#      reviewer dispatches exited 0).
#
# Evidence therefore comes from exactly two places:
#   • assistant tool_use — a REAL dispatch: Task.subagent_type /
#                          SlashCommand.command / Skill.skill (the reviewer's own
#                          name). Every reviewer in this repo is reachable only
#                          through those three tools, so nothing legitimate is lost.
#   • user TEXT          — the human typing `/visual-review` et al, which is the
#                          one non-dispatch way a review genuinely gets requested.
# `<system-reminder>` blocks, tool_result payloads, `isMeta` lines and every
# non-message line are dropped. Selection is by `.message.role` (not `.type`) so it
# holds for both the on-disk shape and the self-test fixtures.
evidence="$(jq -rs '
    map(select(((.type? // "") != "attachment") and ((.isMeta? // false) | not)))
    | map(select(((.message.role? // "") == "assistant") or ((.message.role? // "") == "user")))
    | map(
        (.message.role? // "") as $role
        | (.message.content // [] | if type == "string" then [{ type: "text", text: . }] else . end)
        | map(
            if ($role == "user") and ((.type? // "") == "text") then (.text? // "")
            elif ($role == "assistant") and ((.type? // "") == "tool_use")
              and (((.name? // "") == "Task") or ((.name? // "") == "SlashCommand") or ((.name? // "") == "Skill"))
            then [(.input.subagent_type? // ""), (.input.command? // ""), (.input.skill? // "")] | join(" ")
            else "" end
          )
      )
    | flatten
    | map(select((. | test("<system-reminder>")) | not))
    | .[]
  ' "$tp" 2>/dev/null || true)"

if printf '%s' "$evidence" |
  grep -Eq 'visual-review|review-component|review-interface|session-retro|brand-ui-visual-ux-reviewer|brand-ui-accessibility-reviewer|brand-ui-session-reviewer'; then
  exit 0
fi

cat >&2 <<MSG
⚠ session-cadence nudge: this session edited ${edited} product files and never ran a self-review.
Per .claude/rules/quality-gates.md ("Session cadence — review your own work"), a larger building session ends with its own review battery:
  • /visual-review        — brand-ui-visual-ux-reviewer over the surfaces you touched (all three themes)
  • brand-ui-accessibility-reviewer — real-surface a11y on those same surfaces
  • /review-component <path>  — for every new/changed component
  • /session-retro        — at session completion, so the process gaps get filed
Findings route through /file-issue (finders report, builders fix) — do not silently patch.
Run what applies (or say why it does not), then finish.
MSG
exit 2
