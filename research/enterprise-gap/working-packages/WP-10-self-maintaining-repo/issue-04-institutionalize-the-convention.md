---
TYPE: issue
TITLE: "[governance] Institutionalize 'enforcement over reminders' in the contribution rules"
LABELS: type:tech-debt, severity:P2, area:governance, area:docs, needs-triage
WP: WP-10
---

## Summary

Make "enforcement over reminders" a standing rule, not a one-off. Every future change that introduces
a convention should ship its own generator/gate/hook/skill wiring, so the repo's self-maintenance
doesn't decay over time. This bakes the principle into the PR template, the quality-gates rule, and
CONTRIBUTING — **and wires the session cadence** so agents reliably run **visual-review + the review
agents against their own work after larger building sessions, and `/session-retro` at session
completion** (the machinery already exists; it just isn't triggered automatically today).

## Source

Maintainer requirement (this session) + gap area G (doc 03) + roadmap rule 3 (doc 04).

## Severity & impact

**P2** (it's documentation/process, not a runtime gate) — but high-leverage: it's what keeps WP-10's
machinery from eroding as the library grows.

## Current state & why the gap exists

The repo has strong process docs (quality-gates, issue-workflow) but no explicit rule that "a new
convention must be enforced by automation, not prose." So future conventions could re-introduce manual
reminders.

**The self-review machinery already exists but nothing triggers it:** `/visual-review`, `/review-component`,
the `visual-ux-reviewer` + `accessibility-reviewer` agents, `/session-retro` + the `session-reviewer`
agent (there are even past digests in `.claude/retros/`). The only `Stop` hook
(`gate-completion-claims.sh`) just nudges on dishonest completion claims — **no hook prompts visual-review
of the agent's own work after a big session, nor `/session-retro` at the end.** In a long multi-agent run
that's exactly when self-review matters most, so it must be wired, not remembered.

## Proposed solution

- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`): add a checklist item — "If this introduces a
  convention (a new file that must be registered, a new inventory, a new rule), it ships with a
  generator and/or a gate/hook — not just a doc note."
- **quality-gates rule** (`.claude/rules/quality-gates.md`): add an "Enforcement over reminders"
  section stating the principle and pointing to the WP-10 machinery (manifest stale-gate, component
  registration gate, inventory generator) as the place to plug in.
- **CONTRIBUTING.md**: a short "self-maintaining repo" note for humans.
- Optionally add a `meta`/`type:process` issue label convention so future drift gets filed like
  `/session-retro` findings.
- **Wire the session cadence (the runtime teeth of this issue):**
  - A `Stop`/`SessionEnd` hook (sibling of `gate-completion-claims.sh`, bounded by `stop_hook_active` so
    it can't loop) that, when the session changed a **meaningful number of component/token/story files**,
    **nudges the agent to run `/visual-review` + the `visual-ux-reviewer`/`accessibility-reviewer` agents
    against its own changed work, and `/session-retro` before wrapping** — findings filed via `/file-issue`
    (finders report, builders fix).
  - A short **`.claude/rules/quality-gates.md`** addition: "After a larger building session, review your
    own work (visual + a11y) on the changed surfaces and run `/session-retro`." So the cadence is both a
    written rule **and** a nudge.
  - Keep it a **nudge, not a hard block** (self-review needs judgment about "larger"); the honesty gate
    (`gate-completion-claims.sh`) already stops false "done" claims.

## Affected files

- [ ] `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] `.claude/rules/quality-gates.md` (Enforcement-over-reminders section + the session-cadence rule)
- [ ] `CONTRIBUTING.md`
- [ ] `.claude/hooks/` + `settings.json` — the `Stop`/`SessionEnd` session-cadence nudge (visual-review +
      review agents on changed work; `/session-retro` at completion), bounded like `gate-completion-claims.sh`

## Acceptance criteria

- [ ] The PR template requires new conventions to ship enforcement.
- [ ] quality-gates.md has an "Enforcement over reminders" section referencing the WP-10 gates **and** a
      session-cadence rule (visual + a11y self-review after larger sessions; `/session-retro` at completion).
- [ ] CONTRIBUTING explains the self-maintaining-repo expectation.
- [ ] A bounded `Stop`/`SessionEnd` hook nudges (once) to run visual-review + the review agents on the
      session's changed work and `/session-retro`, when the session touched a meaningful number of
      component/token/story files; it never loops.

## Test to add

A hook smoke test: a simulated stop after N changed component files triggers the nudge exactly once
(respects `stop_hook_active`); a trivial session does not. (The rest is process/docs; `/session-retro`
is the ongoing audit that catches regressions of this principle.)

## Risks / ripple effects

Low. Keep it short so it's actually read; the real teeth are the gates in issue-01/02/03.

## References

- doc 03 area G; doc 04 sequencing rule 3; `.claude/rules/quality-gates.md`, `.claude/rules/issue-workflow.md`.
