---
name: Session retro (meta)
about: A finding from /session-retro about the AGENT's own process during a work session — a mistake, a skipped step, a moment the user had to correct or remind — and the governance gap that let it happen. Never product code; see .claude/commands/session-retro.md.
title: "[meta] "
labels: "meta, type:process, severity:P1, area:governance"
assignees: ""
---

<!--
This structure is canonical — see .claude/commands/session-retro.md Phase 4 ("Create,
using the retro template's structure"). It is filed ONLY by /session-retro, from a
digest-grounded finding the brand-ui-session-reviewer agent produced — never hand-authored
from memory of a conversation. Scope: agent process/behaviour, not product code (a
product bug goes to .github/ISSUE_TEMPLATE/agent-finding.md via /file-issue instead).

Adjust the label line above if this finding's severity/category differs from the
P1/process/governance default (see .github/labels.md for the full taxonomy).
-->

## Summary

<!-- One or two sentences: what did the agent get wrong, or fail to do until reminded? -->

## Evidence

<!-- Cite the digest anchors and quote the transcript (#NNN + quote) — never paste raw
     transcript or secrets beyond the quoted evidence itself. -->

## Root cause (governance gap)

<!-- Classify: MISSING (no rule covers it) / WEAK (a rule exists but is too vague to
     bind) / UNENFORCED (a clear rule exists but nothing checks it) / IGNORED (the rule
     was clear and the agent didn't follow it). Name the specific rule/doc, or its absence. -->

## Prevention (docs + hook)

<!-- The concrete fix: the doc/rule edit (file + what changes) and/or the active hook
     (.claude/hooks/<name>.sh — event, matcher, what it checks/blocks). Prefer an active
     hook over a reminder when a rule keeps being ignored. -->

## Affected files

- [ ] path/one
- [ ] path/two

## Acceptance

- [ ] <the one-line check that confirms the fix landed>

## Test-or-check to add

<!-- The self-test or gate that locks the prevention in, so the gap can't silently
     reopen (see .claude/rules/quality-gates.md "Enforcement over reminders"). -->
