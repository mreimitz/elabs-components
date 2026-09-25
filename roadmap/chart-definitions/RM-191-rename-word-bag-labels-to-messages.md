---
id: RM-191
title: "Rename: word-bag `labels` → `messages` (Bullet, Gauge, Sparkline, DensityScatter); Sparkline `label` → `accessibleLabel`"
status: planned
priority: P1
effort: M (2 days)
wave: 4
depends_on: [RM-183, RM-185, RM-187, RM-190]
blocks: [RM-193, RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/bullet-chart.tsx (:85), gauge.tsx (:278), density-scatter/density-scatter-chart.tsx (:244) (`labels` gets `@deprecated`; `messages` added)
  - packages/charts/src/sparkline/sparkline.tsx (`labels` :151 → `messages`; `label` :90 → `accessibleLabel`)
  - packages/charts/src/definitions/bullet-chart.definition.ts, gauge.definition.ts, sparkline.definition.ts, density-scatter-chart.definition.ts (alias rows 1–5)
  - packages/charts/src/charts/bullet-chart.stories.tsx, gauge.stories.tsx, density-scatter/density-scatter-chart.stories.tsx (autodocs notes)
  - packages/charts/src/sparkline/sparkline.stories.tsx (autodocs note)
  - packages/charts/src/a2ui/charts-catalog.ts, packages/charts/src/auto-chart/auto-chart.tsx (internal callers migrated)
  - packages/charts/src/charts/bullet-chart.test.tsx, gauge.test.tsx, density-scatter/density-scatter-chart.test.tsx (per-alias tests)
  - packages/charts/src/sparkline/sparkline.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: the four word-bag `labels`, Sparkline `label`)
source: docs/review/2026-09-25-charts-unification-review.md F17, F37; ADR 0042 Appendix A.1 (rows 1–5)
---

# RM-191 Rename: word-bag `labels` → `messages` (Bullet, Gauge, Sparkline, DensityScatter); Sparkline `label` → `accessibleLabel`

## Finding

- The top-level `labels` prop means three incompatible things: value-label config (Waterfall, Pie, Ring), place names (Choropleth), and UI word bags (Bullet `BulletChartLabels`, Gauge `GaugeLabels`, Sparkline `SparklineLabels`, DensityScatter `DensityScatterLabels`) (F17). One `labels` schema cannot type it.
- Sparkline names its accessible name `label`; every other component uses `accessibleLabel`, the ui `a11y` group's name (F37).
- The word bags must move first so the `data-labels` group (RM-193) can take the name.

## Change

Ship ADR 0042 Appendix A.1 exactly:

| #   | Component           | Old      | New               | Transform  | Precedence |
| --- | ------------------- | -------- | ----------------- | ---------- | ---------- |
| 1   | BulletChart         | `labels` | `messages`        | `identity` | new-wins   |
| 2   | Gauge               | `labels` | `messages`        | `identity` | new-wins   |
| 3   | Sparkline           | `labels` | `messages`        | `identity` | new-wins   |
| 4   | DensityScatterChart | `labels` | `messages`        | `identity` | new-wins   |
| 5   | Sparkline           | `label`  | `accessibleLabel` | `identity` | new-wins   |

- The word-bag object moves as it is; its keys are unchanged.
- The A2UI catalog keeps Sparkline `label` flagged `deprecated: true` until 6.0 (RM-197).
- Internal callers migrate in the same PR.

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium.

## Orchestrator notes

Starts only after the maintainer has reviewed ADR 0042 Appendix A (confirmation item (d)).
