#!/usr/bin/env bash
# gate-consultation-claims.sh — Stop
# -----------------------------------------------------------------------------
# A NEW sibling to gate-completion-claims.sh (#42), not a mode of it. That hook
# only ever reads the LAST assistant message's text and has zero consultation-
# phrase coverage in its claim lexicon — so a false claim buried inside a
# mid-session `Write` (a subagent's own result file — the real incident this
# closes: a `/close-issues` coder's result file claimed "Consulted
# `brand-ui-design-system-architect`, who confirmed…" with NO matching Task
# dispatch anywhere in that session's transcript) was invisible to it, and to
# every other gate in the repo. #42 is itself evidence for this: THIS run's own
# result file must not make an unbacked consultation claim either.
#
# Delegates the real logic to scripts/check-consultation-claims.mjs — the
# "bash-wraps-node" shape used by gate-pr-merge-readiness.sh, chosen over pure
# jq (session-cadence-nudge.sh's shape) because the ordering logic (a claim's
# transcript position vs. a prior Task dispatch's position) is easier to write
# correctly and test in JS than in jq.
#
# Bounded like every other Stop nudge in this repo: `stop_hook_active` guards
# against looping, and it prints once then lets the stop proceed as a nudge
# (exit 2 with a stderr message), never a hard block — the agent still has to
# be able to stop and fix the claim.
#
# Self-tested by scripts/check-consultation-claims.test.mjs
# (`pnpm consultation-claims:check:test`).
set -u

input="$(cat 2>/dev/null || true)"
command -v jq >/dev/null 2>&1 || exit 0

active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)"
[ "$active" = "true" ] && exit 0

tp="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -z "$tp" ] && exit 0
[ -f "$tp" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
checker="$root/scripts/check-consultation-claims.mjs"
# Fail OPEN only when the checker genuinely is not in this tree (e.g. an older
# checkout) — its absence where it should exist is caught by
# `pnpm consultation-claims:check:test` in CI, not here.
[ -f "$checker" ] || exit 0

out="$(node "$checker" "$tp" 2>&1)"
status=$?
[ "$status" -eq 0 ] && exit 0

cat >&2 <<MSG
⚠ consultation-claims nudge: this session claims a named-agent consultation or
sign-off with no matching prior Task dispatch found in the transcript:

$out

If the consultation really happened, this is a false positive — say so. If it
did not, correct the claim before reporting the work as done (quality-gates.md
▸ "Reporting completion honestly": never headline a claim you did not verify).
MSG
exit 2
