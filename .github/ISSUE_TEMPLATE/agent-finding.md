---
name: Agent finding
about: A defect, regression, visual/UX problem, or accessibility violation surfaced by a review, a failing test, or human feedback, with its root cause located before filing.
title: "[area] "
labels: ""
assignees: ""
---

<!--
Usually filed via `/file-issue` (.claude/commands/file-issue.md; workflow in
docs/ISSUE_WORKFLOW.md), which writes a shorter capped body. When filing by hand, locate
the root cause (file:line) first — do not file an undiagnosed symptom.

LABELS: type:<bug|a11y|visual|tech-debt|regression>, severity:<P0|P1|P2>,
area:<ui|data|ai|flow|maps|charts|marketing|editor|viewer|terminal|process|tokens|icons|docs|registry|test>
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
