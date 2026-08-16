---
TYPE: issue
TITLE: "[ai] A2UI Phase-0 spike — render the Basic Catalog with brand-ui via web_core"
LABELS: type:tech-debt, severity:P2, area:ai, needs-triage
WP: WP-11
---

## Summary

Before committing to A2UI support, build a throwaway proof-of-concept that renders A2UI's **Basic
Catalog** using a handful of brand-ui components, to (a) validate the architecture end-to-end and
(b) measure the "moving target" risk of a young spec. A2UI is v0.8 stable / v0.9 draft and the
`theme` field is still `z.any()`, so a cheap spike de-risks the real work.

## Source

[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md) (Phase 0). A2UI renderer guide:
https://a2ui.org/guides/renderer-development/

## Severity & impact

**P2.** Low-cost, high-information: confirms `@a2ui/web_core` + the React renderer pattern works with
brand-ui and surfaces spec churn before Phase 1 investment.

## Current state & why the gap exists

New — no A2UI work exists. brand-ui is React + token-themed, so it's structurally a good renderer
target, but this is unproven in practice.

## Proposed solution

- In a scratch branch / `apps/playground` route, install `@a2ui/web_core` + the official A2UI React
  renderer (reference: a2ui-project/a2ui `renderers/react`).
- Implement adapters for ~6 components: `Text`→`Label`, `Button`, `Card`, `TextField`→`Input`,
  `Row`/`Column`→flex wrappers.
- Feed a hand-written A2UI v0.9 JSON sample (a small form) through `web_core`'s `MessageProcessor`;
  render with the brand-ui adapters inside `ThemeProvider`.
- Verify: it renders, themes apply (switch a theme → A2UI surface restyles via tokens), a `Button`
  `action` produces a `userAction` callback, and data binding (`{path}`) resolves.
- Write a short findings note: does theming flow through cleanly? how stable is the v0.9 API? what
  surprised us? Recommend go/no-go for Phase 1.

## Affected files

- [ ] scratch: `apps/playground/src/a2ui-spike/*` (throwaway)
- [ ] findings note: `apps/e2e/reports/a2ui-spike-<date>.md` (or the research folder)

## Acceptance criteria

- [ ] A sample A2UI v0.9 surface renders with brand-ui components, themed, in the playground.
- [ ] Theme switch restyles the A2UI surface via tokens (no agent-sent colors).
- [ ] A button action round-trips to a console/callback.
- [ ] A written go/no-go findings note covering theming flow + spec-stability risk.

## Test to add

None (spike). The findings note is the deliverable; real tests come in issue-03.

## Risks / ripple effects

- This is throwaway — don't let it harden into production code without issue-02/03.
- `web_core`/renderer versions may churn; pin exact versions and record them in the note.

## References

- `../../05-a2ui-concept.md` §2/§3; https://a2ui.org/guides/renderer-development/;
  https://github.com/a2ui-project/a2ui (renderers/react, renderers/web_core)
