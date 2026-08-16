---
TYPE: issue
TITLE: "[plugin] new-app skill — the staged interview + living app-spec"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: VP-02
---

## Summary

Author the `new-app` skill that runs the greenfield interview: 7 stages (intent → archetype → surfaces
& nav → data & entities → brand & feel → per-surface detail → confirm), each one or two
`AskUserQuestion` rounds, writing every answer into a living `app-spec.md`. Stages with a visual choice
run the VP-04 feedback loop.

## Source

[`../../02-greenfield-guided-flow.md`](../../02-greenfield-guided-flow.md) (the stage table + design
principles); Spec-Kit-style intake.

## Severity & impact

**P1.** This is the guided experience the product is for — taking a non-expert from idea to spec
without them needing to know brand-ui.

## Current state & why the gap exists

New. brand-ui has consumer skills but no guided build flow.

## Proposed solution

- `skills/new-app/SKILL.md` (user-invocable) + `reference/stages.md` (the interview script, progressive
  disclosure). Orchestrate the 7 stages; map archetype → a playbook (WP-09) + template (WP-13).
- Write/maintain `app-spec.md` after every stage (the source of truth the scaffold reads).
- Integrate the VP-04 visual loop at stages 2–6 (propose → preview → pick → refine), preferring the
  Storybook-MCP real render in the chosen theme.
- Allow "skip detail, use sensible defaults" (record defaults in the spec).
- End by handing the spec to `brand-ui scaffold` (issue-02).

## Affected files

- [ ] `skills/new-app/SKILL.md` + `reference/stages.md` (new)
- [ ] spec template `app-spec.md` shape (documented)
- [ ] plugin registration (VP-01)

## Acceptance criteria

- [ ] Running `new-app` walks the 7 stages via `AskUserQuestion`, with visual previews where a choice
      is visual, and produces a complete `app-spec.md`.
- [ ] Archetype maps to a real playbook + template; theme/density captured.
- [ ] The spec is sufficient input for `brand-ui scaffold` with no further questions.

## Test to add

A fixture run (scripted answers) that yields a valid `app-spec.md` matching the documented schema.

## Risks / ripple effects

- `AskUserQuestion` is ≤4 questions/round → multi-turn; keep stages crisp so it doesn't feel like a
  form. Don't advance a visual choice on text alone if a render is available (VP-04).

## References

- `../../02-greenfield-guided-flow.md`; WP-09 (playbooks), WP-13 (templates), VP-04 (visual loop).
