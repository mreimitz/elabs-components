---
name: Agent finding
about: A defect, regression, visual/UX problem, or accessibility violation surfaced by a finder agent, a failing test, or human feedback, and diagnosed via deep root-cause analysis before filing.
title: "[area] "
labels: ""
assignees: ""
---

<!--
This structure is canonical — see .claude/rules/issue-workflow.md ("Implementation-ready")
and docs/ISSUE_WORKFLOW.md ("What a filed issue contains"). It mirrors the spec the
brand-ui-root-cause-analyst agent produces (.claude/agents/brand-ui-root-cause-analyst.md),
filed via `/file-issue`. Every finding goes through that deep RCA before an issue is
opened — do not skip straight to this template with an undiagnosed symptom.

LABELS: type:<bug|a11y|visual|tech-debt|regression>, severity:<P0|P1|P2>,
area:<ui|data|ai|flow|maps|charts|marketing|editor|viewer|tokens|icons|docs|registry|test>
— see .github/labels.md for the full taxonomy and how to create the labels.
-->

## Summary

<!-- One paragraph: what's wrong and why it matters. -->

## Source

<!-- <agent/test/feedback> · <date> · <report path / screenshot / failing test name> -->

## Severity & impact

<!-- P0/P1/P2 — who/what is affected; which themes/viewports. -->

## Reproduction

<!-- Exact steps, failing test name, or Storybook story id + theme slug, or URL. -->

## Evidence

<!-- Console errors, screenshots, file:line references. -->

## Root cause analysis

<!-- Symptom -> why-chain -> the TRUE root cause, with file:line. Symptom vs. cause explicit. -->

## Proposed solution

<!-- Concrete change; files/functions to edit; token/rule references; alternatives if relevant. -->

## Affected files

- [ ] path/one
- [ ] path/two

## Acceptance criteria

- [ ] <testable outcome>
- [ ] passes in both themes (`light`, `dark`) (if visual/a11y)

## Test to add

<!-- Which spec/test and what it asserts, so the fix carries its own regression lock. -->

## Risks / ripple effects

<!-- Other themes, other components, registry items, docs, performance. -->

## References

<!-- .claude/rules/*, ADRs, related issues/PRs. -->
