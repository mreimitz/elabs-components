---
id: RM-205
title: "6.0.0: remove the alias rows and legacy deprecations; numbered migration steps and `brand-ui codemod`"
status: planned
priority: P1
effort: M (2 days)
wave: 7
depends_on: [RM-169, RM-190, RM-191, RM-192, RM-193, RM-194, RM-195, RM-196, RM-197]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/definitions/*.definition.ts and packages/charts/src/definitions/parts/ (alias rows removed)
  - the families and parts that carry deprecated props in ADR 0042's table (props removed)
  - packages/charts/src/charts/waterfall-chart.tsx, packages/charts/src/chart-frame/chart-frame.tsx, packages/charts/src/auto-chart/auto-chart.tsx (the `height` aliases removed)
  - packages/charts/src/charts/use-chart-interaction.ts (`ChartSelection` removed), packages/charts/src/charts/chart-brush-layout.tsx (`ChartBrushLayout` removed), packages/charts/src/charts/index.ts (their exports)
  - packages/charts/src/charts/scatter.tsx (`trend` removed), packages/charts/src/charts/analytics/scatter-trend-alias.ts (removed)
  - packages/charts/src/charts/candlestick-chart.tsx (the `@deprecated` `maxVisibleItems` and `windowDomain` removed — ADR 0042 A.8)
  - packages/ai/src/a2ui/catalog.source.json and the generated catalogs (deprecated names removed)
  - .claude/rules/charts.md (the `height` alias note removed)
  - .changeset/*.md (major — 6.0.0 migration: numbered steps generated from the alias rows; `brand-ui codemod` usage)
source: docs/review/2026-09-25-charts-unification-review.md F35, F36; ADR 0042 (alias policy, tripwire); docs/DEPRECATION.md §2, §3
---

# RM-205 6.0.0: remove the alias rows and legacy deprecations; numbered migration steps and `brand-ui codemod`

## Finding

- Every alias shipped in wave 4, the A2UI deprecated names (RM-197) and the listed legacy deprecations (`ChartSelection`, `ChartBrushLayout`, the `height` aliases, Scatter `trend`) are due for removal in the next major (`docs/DEPRECATION.md` §2).
- Every major ships a CHANGELOG migration section with numbered consumer steps and, for mechanical renames, the read-only `brand-ui codemod <map.json>` planner (§3).

## Change

- Remove the 39 alias rows of ADR 0042 Appendix A with their deprecated props, Candlestick's `maxVisibleItems` and `windowDomain` (A.8), the `height` aliases, `ChartSelection`, `ChartBrushLayout`, Scatter `trend` and the A2UI deprecated names.
- Nothing is renamed here. The 6.0 questions in ADR A.9 (confirmation item (e)) are the maintainer's to settle; any rename they lead to is an ADR amendment and a later item.
- The changeset carries the numbered migration steps generated from the same rows as `chart-codemod-map.generated.json`, and shows `brand-ui codemod packages/cli/lib/chart-codemod-map.generated.json`.

## Acceptance

- The 6.0 tripwire (RM-190) is green at version 6.0.0.
- `pnpm consumer:check` (the consumer install smoke) green.
- The migration steps list every row of the codemod map, numbered.

## Test / gate

`pnpm check`, `pnpm check:test`, `pnpm -r typecheck lint test`, `pnpm build`, `pnpm gen && pnpm gen:check`, `pnpm consumer:check`, `pnpm test:stories`.

## Orchestrator notes

Start only when the maintainer says release, and only after the last rename item (RM-196) has shipped in a minor. The release itself goes through `brand-ui-release`.
