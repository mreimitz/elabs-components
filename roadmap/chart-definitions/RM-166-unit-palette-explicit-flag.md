---
id: RM-166
title: "Unit `palette`: the `explicit` flag comes from what the caller passed"
status: in-progress
priority: P0
effort: S (0.5 day)
wave: 1
depends_on: []
blocks: [RM-183, RM-186]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/unit-chart.tsx (`explicit` from the raw prop, :209 / :260)
  - packages/charts/src/charts/unit-chart.test.tsx (soft-cap and explicit semantics)
  - .changeset/*.md (minor — Unit with more than six categories and no `palette` now follows the shared soft cap)
source: docs/review/2026-09-25-charts-unification-review.md F06
---

# RM-166 Unit `palette`: the `explicit` flag comes from what the caller passed

## Finding

- `UnitChart` defaults `palette = "categorical"` at destructuring (`unit-chart.tsx:209`), then calls `resolvePalette(…, { explicit: palette !== undefined })` (:260), which is therefore always true.
- So Unit never gets the shared categorical soft cap: above `CATEGORICAL_SOFT_CAP` (6) categories without a caller palette, `resolvePalette` should fall back to the mono ladder with a dev warning; Unit cycles the 12 categorical hues silently instead.
- Unit is the only family with this bug; Bar, Bump, Dumbbell, Distribution and Parallel destructure `palette` without a default.

## Change

- Keep the raw prop: `explicit` is true only when the caller passed `palette`. The resolved palette still defaults to `"categorical"`.

## Acceptance

- The test states both semantics: Unit with 8 categories and no `palette` → the mono ladder plus one dev warning; with `palette="categorical"` → 8 categorical hues and no warning.
- Six or fewer categories without `palette` → DOM unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test` (unit-chart, resolve-palette), Storybook Unit stories in Chromium, light and dark.
