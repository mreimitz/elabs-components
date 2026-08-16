#!/usr/bin/env bash
# gate-completion-claims.sh — Stop
# -----------------------------------------------------------------------------
# Nudges ONCE when the final assistant message asserts completion
# ("production-grade", "fully wired", "ready to ship", "all green", …) without
# saying what was NOT verified. Enforces quality-gates.md ("Reporting completion
# honestly" + "Theme-safe is observed"). Bounded to one nudge per stop via
# `stop_hook_active`, so it cannot loop. Silent + exit 0 on the happy path.
set -u

input="$(cat 2>/dev/null || true)"
command -v jq >/dev/null 2>&1 || exit 0

# Loop guard: if we already nudged and the agent is stopping again, let it stop.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
[ "$active" = "true" ] && exit 0

tp="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -z "$tp" ] && exit 0
[ -f "$tp" ] || exit 0

# Text blocks of the last assistant message.
last="$(jq -rs 'map(select(.message.role=="assistant")) | last | (.message.content // []) | map(select(.type=="text") | .text) | join("\n")' "$tp" 2>/dev/null || true)"
[ -z "$last" ] && exit 0

# Strong completion claims (case-insensitive). Bare "done" alone is too common to
# gate, but "done — …/all done/everything done/verified and done" claim shapes are
# included alongside the verification claims #46 flagged ("verified", "all green",
# "all verified", "across all six themes").
echo "$last" | grep -Eiq 'production[ -]grade|production[ -]ready|fully wired|fully native|ready to ship|ship it|shippable|all green|fully verified|all verified|fully tested|visually verified|genuinely match|(is|are|now|fully)[ -]?verified|verified (across|in) (all )?(the )?(six|6)? ?themes|across all (six|6) themes|all (six|6) themes (pass|verified|checked|render)|(all|everything) (is )?done|done (—|-|and|:) ' || exit 0

# Honesty markers — if the claim is already qualified, allow the stop.
if echo "$last" | grep -Eiq "unverified|not verified|did(n.?t| not) run|have(n.?t| not) run|not yet|untested|not tested|caveat|to confirm|needs? verif|still (need|to)|left to|follow.?up|i did not|i have(n.?t| not)"; then
  exit 0
fi

cat >&2 <<'MSG'
⚠ completion-claim gate: your final message asserts completion ("production-grade" / "all green" / "verified" / "across all six themes" / "done — …") without stating what was NOT verified.
Per .claude/rules/quality-gates.md (Reporting completion honestly + Theme-safe is observed):
  • Lead with what you did NOT run/observe (e.g. an "Unverified:" line).
  • "Verified" / "all green" must name the PRIMARY surface you actually ran — not what you wrote.
  • "Theme-safe" / "across all six themes" needs an observed render (visual sweep / test-storybook) of the REAL surface, not just token usage, and not a self-authored demo.
  • A11y claims must cite the REAL rendered component (story/browser), NEVER a mock that stands in for it (the #34/#46 mock-masking trap).
  • Validate a THEME / system-wide visual on a REAL, unmodified app screen (scenarios-*).
  • Confirm any file path / link you cite resolves.
Add the caveats (or run the verification), then finish.
MSG
exit 2
