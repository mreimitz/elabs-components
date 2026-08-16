#!/usr/bin/env bash
# gate-design-first.sh — Stop
# -----------------------------------------------------------------------------
# WARN-ONLY (always exit 0 — never blocks). Sibling of gate-completion-claims.sh,
# same `stop_hook_active` re-entry guard so it cannot loop.
#
# Nudges when THIS session created a net-new screen/route-shaped file — a Write
# under an app's routes|pages|screens tree, or a *.stories.tsx whose `title:`
# starts with "Patterns/" or "Templates/" — with no sign anywhere in the
# transcript that the design-first ritual (.claude/rules/design-first.md /
# `/new-screen`) actually ran: an intent sentence, named references, 2-3
# concepts, or a state grid.
#
# This is a best-effort heuristic, not a proof — "is this file a screen" and
# "did the ritual happen" are both judgment calls a regex can't decide (see
# quality-gates.md "Enforcement over reminders": a hook is one rung below a CI
# gate for exactly this reason). It is scoped to the same run's OWN transcript,
# so it only ever second-guesses the agent that is stopping, never a teammate's
# unrelated screen.
set -u

input="$(cat 2>/dev/null || true)"
command -v jq >/dev/null 2>&1 || exit 0

# Loop guard: if we already nudged and the agent is stopping again, let it stop.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
[ "$active" = "true" ] && exit 0

tp="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -z "$tp" ] && exit 0
[ -f "$tp" ] || exit 0

# Every Write tool call this session: "<file_path>\t<content-first-2000-chars>".
# jq -s reads the whole JSONL transcript into one array (mirrors gate-completion-claims.sh).
writes="$(jq -rs '
  map(select(.message.role=="assistant"))
  | map(.message.content // [])
  | flatten
  | map(select(.type=="tool_use" and .name=="Write"))
  | map([(.input.file_path // ""), ((.input.content // "")[0:2000] | gsub("\n";" "))])
  | map(join("\t"))
  | .[]
' "$tp" 2>/dev/null || true)"
[ -z "$writes" ] && exit 0

# A "net-new screen"-shaped Write this session: an app route/page/screen file, or a
# story file titled under Patterns/ or Templates/ (registry-style whole-screen demos).
screen_hit=""
while IFS=$'\t' read -r fp content; do
  [ -z "$fp" ] && continue
  case "$fp" in
    *apps/*/routes/*|*apps/*/pages/*|*apps/*/screens/*)
      screen_hit="$fp" ;;
    *.stories.tsx)
      case "$content" in
        *'title: "Patterns/'*|*"title: 'Patterns/"*|*'title:"Patterns/'*| \
        *'title: "Templates/'*|*"title: 'Templates/"*|*'title:"Templates/'*)
          screen_hit="$fp" ;;
      esac
      ;;
  esac
  [ -n "$screen_hit" ] && break
done <<< "$writes"

[ -z "$screen_hit" ] && exit 0

# Concept-note evidence: did the session's own assistant text ever show the ritual
# (intent sentence / named references / distinct concepts / state grid)? Heuristic
# keyword scan — a false "ran" is acceptable here (warn-only), a false "didn't run"
# just repeats a nudge the agent can dismiss with the honesty markers below.
text="$(jq -rs '
  map(select(.message.role=="assistant"))
  | map(.message.content // [])
  | flatten
  | map(select(.type=="text") | .text)
  | join("\n")
' "$tp" 2>/dev/null || true)"

if echo "$text" | grep -Eiq 'intent sentence|design-first|design first ritual|state grid|2-3 concepts|2–3 concepts|distinct concepts|comparable products|/new-screen'; then
  exit 0
fi

cat >&2 <<MSG
⚠ design-first gate: this session wrote a screen/route-shaped file ($screen_hit)
with no sign in the transcript that the design-first ritual ran — an intent
sentence, 2-3 named references, 2-3 distinct concepts, or a designed state grid.
Per .claude/rules/design-first.md: a net-new screen starts as DESIGN, not
component assembly. If this genuinely is a new screen, run /new-screen (or note
the intent/references/concepts/state-grid you already used) before finishing.
(Advisory — judging "is this a screen" and "did the ritual happen" is not
decidable by this hook; use judgment, don't silently dismiss a real gap.)
MSG
exit 0
