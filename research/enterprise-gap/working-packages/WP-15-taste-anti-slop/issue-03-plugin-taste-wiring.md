---
TYPE: issue
TITLE: "[plugin] Wire taste into the vibe-coder-plugin: feel stage, anti-slop bar, curated arsenal"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
WP: WP-15
---

## Summary

Use the taste adoption in the customer plugin: the **taste profile** (issue-02) becomes the greenfield
**feel stage**; the **anti-slop audit** (issue-01) becomes the **quality bar** both flows enforce; and
a **curated arsenal** of premium patterns (the brand-ui-expressible subset of the taste-skill's
library) becomes options in the visual-feedback loop.

## Source

[`../../09-taste-adoption.md`](../../09-taste-adoption.md) (Adoption B); the vibe-coder-plugin flows
([`../../../vibe-coder-plugin/02-greenfield-guided-flow.md`](../../../vibe-coder-plugin/02-greenfield-guided-flow.md),
VP-02/VP-03/VP-04).

## Severity & impact

**P1.** This is what makes vibe-coded apps look _crafted, not generic_ — the taste payoff for the
end-user product.

## Current state & why the gap exists

New; depends on the vibe-coder-plugin foundation (VP-01) + flows (VP-02/03) + the visual loop (VP-04),
and on issue-01/02 here.

## Proposed solution

- **Feel stage (greenfield):** extend `new-app` stage 5 ("brand & feel") to set the **taste profile**
  (`register × density × motion × expressiveness`) via `AskUserQuestion`, mapped to brand-ui
  tokens/themes — **never** hardcoded values. Preview the choice as a **real brand-ui render** in the
  chosen theme (VP-04).
- **Anti-slop bar (both flows):** run the issue-01 audit (incl. content checks) on generated/scaffolded
  output as a gate — "does this look AI-generated?" must pass before "done." So scaffolds avoid
  "John Doe"/`99.99%`/"Acme"/filler and the visual slop.
- **Curated arsenal:** expose the taste-skill's premium patterns **that are expressible with brand-ui
  components + tokens** (bento grid, split hero, spotlight card, sticky-scroll stack, …) as options in
  the propose→preview→pick loop — **register- and motion-gated** (calm by default; expressive opt-in),
  each previewed as a real render.
- **Brownfield:** `migrate` runs the anti-slop audit to **score the existing app** and propose taste
  upgrades alongside the component migration.

## Affected files

- [ ] `skills/new-app` (feel stage → taste profile) — vibe-coder-plugin VP-02
- [ ] the scaffold + visual loop (VP-02 issue-02, VP-04) — enforce the bar + offer the arsenal
- [ ] `skills/migrate` (VP-03) — taste-scoring during migration
- [ ] shared: the issue-01 audit + issue-02 profile

## Acceptance criteria

- [ ] The greenfield feel stage sets a token-backed taste profile with a real-render preview.
- [ ] Generated/scaffolded output passes the anti-slop bar (visual + content) before "done."
- [ ] The curated arsenal offers only token-expressible patterns, register/motion-gated, previewed real.
- [ ] The brownfield flow surfaces a taste score + upgrade suggestions.

## Test to add

Scaffold a fixture app at a chosen profile → assert no slop (content + visual) and the profile's tokens
applied; a brownfield fixture → assert a taste score is produced.

## Risks / ripple effects

- Depends on the vibe-coder-plugin VPs + issue-01/02 — sequence after them. Keep the arsenal curated to
  what brand-ui can actually render with tokens; don't offer patterns that force raw CSS.

## References

- `../../09-taste-adoption.md` (Adoption B); vibe-coder-plugin VP-02/VP-03/VP-04; WP-15 issue-01/02.
