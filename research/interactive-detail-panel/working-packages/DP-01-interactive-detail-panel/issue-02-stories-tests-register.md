---
TYPE: issue
TITLE: "[ui] Card detail panel — stories (six-theme + axe), smoke tests, registration, docs"
LABELS: type:feature, severity:P2, area:ui, area:registry, needs-triage
WP: DP-01
---

## Summary

Make the new `Card` detail panel verifiable and discoverable: stories that exercise every placement ×
reveal combo across the six themes (interaction + axe), smoke tests (including the empty→normal-card
guarantee), and registration so the agent layer + registry know the new props.

## Source

[`../../README.md`](../../README.md) (quality bar); builds on `issue-01-card-detail-api.md`.

## Severity & impact

**P2.** A core-primitive change is only "done" when it's observed across themes and can't silently
regress; an unregistered prop surface is invisible to consumers + agents.

## Proposed solution

- **Stories** (`packages/ui/src/components/card/card.stories.tsx` — extend, don't fork): add
  `Empty` (= normal card, the control), `DetailSideFixed`, `DetailSideHover`, `DetailBottomFixed`,
  `DetailBottomHover`, and `InteractiveWithDetail` (proves `interactive` + `detail` coexist). Each in a
  sized parent (cards need height for the side panel). An interaction test drives the **keyboard** path
  (tab to focus → panel reveals via `focus-within`).
- **Six-theme + a11y:** when the Storybook dev server is up, `mcp__storybook__run-story-tests` (interaction
  - axe) on these stories and `mcp__storybook__preview-stories` with `globals=theme:<slug>` for all six
    (`qlik-bright · qlik-dark · light · dark · blueprint · high-contrast`); else
    `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`. Confirm panel/divider AA + that the **fixed footprint**
    holds on hover (no reflow) — observed, not inferred.
- **Smoke tests** (`card.test.tsx`): empty `detail` ⇒ no panel region (backwards-compat); `fixed` ⇒
  panel present; `hover` ⇒ revealed on `focus-within`.
- **Register (born compliant):** `pnpm manifest` (the new props on `Card` in `brand-ui.manifest.json`);
  if a registry item documents `Card`, refresh it (`pnpm registry:validate`); Storybook `storySort`
  already covers `Card` (new stories inherit). Note the props in the `brand-ui` skill / component docs so
  agents reach for `detail` instead of hand-rolling a panel.

## Affected files

- [ ] `packages/ui/src/components/card/card.stories.tsx` (new stories + keyboard interaction test)
- [ ] `packages/ui/src/components/card/card.test.tsx` (smoke tests incl. backwards-compat)
- [ ] `brand-ui.manifest.json` (via `pnpm manifest`); `registry/registry.json` if a Card item exists
- [ ] `skills/brand-ui/SKILL.md` / component docs (mention the `detail` props)

## Acceptance criteria

- [ ] Stories cover empty + side×{fixed,hover} + bottom×{fixed,hover} + interactive+detail; pass
      interaction + axe across all six themes (cite story ID + theme slug).
- [ ] Smoke tests assert the empty→normal-card guarantee + both reveal modes; `pnpm --filter @qlik-coe-emea/qlabs-components-ui test` green.
- [ ] `pnpm manifest` regenerated (new props visible); `pnpm registry:validate` green; the agent docs
      mention the `detail` surface.

## Test to add

The interaction (keyboard focus-within reveal) + axe story tests and the three smoke assertions above.

## Risks / ripple effects

- The hover/footprint behavior is the thing most likely to look wrong in a specific theme (divider
  contrast, blueprint hatch over the panel) — **observe per theme**, don't trust "it uses tokens."
- Keep `Card`'s existing stories green (the no-`detail` path must be untouched).

## References

- `.claude/rules/storybook-mcp.md`, `quality-gates.md` (six-theme = observed), `accessibility.md`;
  `issue-01-card-detail-api.md`.
