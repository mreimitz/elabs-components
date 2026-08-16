---
TYPE: issue
TITLE: "[ai] Define the playbook format and author the first 3–5 playbooks"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-09
---

## Summary

Define a small, consistent **playbook schema** and author the first set of playbooks from brand-ui's
existing composition patterns. A playbook is a prompt-ready recipe for a whole pattern (dashboard, AI
chat app, data app, flow canvas, app shell) that an agent can follow to assemble the right components
correctly on the first try — "the full recipe, not just a component reference."

## Source

Research doc 02 §B (playbooks) + AgnosticUI review; gap E8. brand-ui's patterns already exist as prose
in `skills/brand-ui/reference/composition.md` and the component-selection table in
`skills/brand-ui/SKILL.md` — this structures them.

## Severity & impact

**P1.** Directly targets the dominant agent failure mode (whole-screen mis-assembly). High leverage:
each playbook turns a pattern brand-ui already supports into a reliable, repeatable agent capability.

## Current state & why the gap exists

Composition guidance is prose an agent must read and interpret; there's no structured, invokable recipe
with an intent label, an explicit component list, assembly steps, a runnable example, and anti-patterns.

## Proposed solution

- **Define the schema** (co-located `playbooks/<name>/playbook.md` + a `playbook.json` for the machine
  parts), e.g.:
  - `intent` (natural-language trigger: "build a dashboard", "add an AI chat surface"),
  - `components` (the `@qlik-coe-emea/qlabs-components-*` parts used, with packages),
  - `steps` (ordered assembly: shell → regions → data → states),
  - `example` (a runnable story/snippet that **doubles as the test** — per the examples-as-tests rule),
  - `antiPatterns` (e.g. "don't nest two AppShells", "don't bypass DataTable's toolbar render-prop"),
  - `tokensAndThemes` (note six-theme safety).
- **Author the first set** (start with the highest-traffic, all of which brand-ui already supports):
  1. App shell, 2. Dashboard, 3. AI chat app, 4. Data app, 5. Flow canvas.
- Each playbook's example is added as a Storybook story so it's verified across six themes (WP-02 bar)
  and runs under `test-storybook` (WP-01 CI).
- Seed content from `composition.md` + the SKILL component-selection table — much already exists.

## Affected files

- [ ] `playbooks/<name>/playbook.md` + `playbook.json` (new; location TBD — repo root `playbooks/` or
      `skills/brand-ui/playbooks/`)
- [ ] a runnable example/story per playbook (in `apps/docs` or co-located)
- [ ] seed source: `skills/brand-ui/reference/composition.md`, `skills/brand-ui/SKILL.md`
- [ ] schema doc / JSON Schema for `playbook.json`

## Acceptance criteria

- [ ] A documented playbook schema exists (human `.md` + machine `.json`).
- [ ] 3–5 playbooks authored, each with intent, components, steps, a runnable example, and
      anti-patterns.
- [ ] Each example renders + passes across all six themes (`test-storybook`).
- [ ] An agent given the playbook's intent assembles the correct components first try (spot-check on a
      real task).

## Test to add

Each playbook's example story is its test (interaction + axe via `test-storybook`). Add a schema-
validation test for `playbook.json`.

## Risks / ripple effects

- Keep playbooks composed of **real, current** components (validate names via `brand-ui search` — don't
  hand-write component names that could drift). Registration/stale-gating handled in issue-02 + WP-10.

## References

- research doc 02 §B; `skills/brand-ui/reference/composition.md`; gap E8; feeds WP-03 context file +
  WP-10 stale-gate.
