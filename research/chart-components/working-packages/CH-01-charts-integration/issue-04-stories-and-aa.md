---
TYPE: issue
TITLE: "[charts] Stories from the 17 examples + six-theme AA audit (the quality gate)"
LABELS: type:a11y, severity:P1, area:charts, area:test, needs-triage
WP: CH-01
---

## Summary

Author a Storybook story per chart — **seeded from bklit's 17 examples** (which already carry sample
data + the exact composition) — and run the cross-theme contrast audit until the data palette passes AA
in all six themes. Stories give six-theme verification + Storybook-MCP discoverability; the AA pass is
the main _quality_ task (charts are the hardest thing to keep legible across themes).

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 2; story pattern
[`../../story-pattern/area-chart.stories.tsx`](../../story-pattern/area-chart.stories.tsx).

## Severity & impact

**P1.** Without stories the charts are invisible to the Storybook-MCP agent path and unverifiable across
themes; without the AA pass they may be illegible/off-brand in some themes.

## Proposed solution

- **Stories:** for each of the 14 charts, author `*.stories.tsx` (co-located), `tags: ["autodocs"]`,
  title group `Charts/<Name>`, importing from `@qlik-coe-emea/qlabs-components-charts` — **port the bklit example's sample data +
  composition** as the Default story; add the chart's key states (loading/empty where applicable) and a
  many-series variant for palette charts. Follow the locked pattern in `../../story-pattern/`.
- **Six-theme verification:** render each story across `qlik-bright|qlik-dark|light|dark|blueprint|
high-contrast` (`globals=theme:<slug>`); run `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` (interaction
  - axe).
- **AA audit:** run `brand-ui-audit` (oklch-aware) on the charts × six themes; **tune the `--chart-*`
  palette tokens** (issue-03) until body/label text ≥ 4.5:1, UI ≥ 3:1, and series colors are
  distinguishable (incl. high-contrast + the brand-green caution). Commit the audit artifact to
  `apps/e2e/reports/`.

## Affected files

- [ ] `packages/charts/src/**/*.stories.tsx` (14 + primitives where useful)
- [ ] `apps/docs` storySort (Charts group) ; `apps/e2e/reports/charts-aa-<date>.md`
- [ ] `packages/tokens/src/themes.css` (palette tuning from the audit)

## Acceptance criteria

- [ ] Every chart has a Default story (+ key states) rendering in all six themes; `test-storybook` green
      (interaction + axe).
- [ ] A committed six-theme AA audit artifact shows **no P0 contrast** failures; series colors
      distinguishable in every theme.
- [ ] Stories use real data (from the examples), semantic tokens, no raw hex.

## Test to add

The stories themselves (interaction + axe via `test-storybook`) are the regression lock; keep the audit
artifact updated on palette changes.

## Risks / ripple effects

- AA across six themes (esp. high-contrast + blueprint) is the real work — budget for palette iteration.
  Depends on issue-02 (vendored) + issue-03 (token bridge).

## References

- `../../01-integration-plan.md`; `../../story-pattern/`; `skills/brand-ui-audit/`, `.claude/rules/storybook-mcp.md`.
