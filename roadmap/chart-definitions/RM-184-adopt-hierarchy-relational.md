---
id: RM-184
title: "Adopt the groups: hierarchy and relational (Treemap, Tree, Sankey, Network, ParallelCoordinates)"
status: planned
priority: P1
effort: L (3–4 days)
wave: 3
depends_on: [RM-163, RM-167, RM-168, RM-177, RM-180, RM-181]
blocks: [RM-186, RM-187, RM-188, RM-189, RM-190, RM-193, RM-195, RM-203, RM-204]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/treemap/treemap-chart.tsx (`useResolvedChartProps`)
  - packages/charts/src/charts/tree-chart.tsx (`plotHeight`; tooltip `avoid`, :1729-1736)
  - packages/charts/src/charts/sankey/sankey-chart.tsx (the a11y group and a generated summary)
  - packages/charts/src/charts/network/network-chart.tsx, packages/charts/src/charts/parallel-coordinates/parallel-coordinates-chart.tsx (`useResolvedChartProps`)
  - packages/charts/src/charts/sankey/sankey-chart.test.tsx (axe test)
  - packages/charts/src/definitions/*.definition.ts for the five families
  - packages/charts/src/charts/*.stories.tsx for the five families (a Loading story per newly adopted `status`)
  - .changeset/*.md (minor — group props on the hierarchy and relational families; Sankey accessible name and description)
source: docs/review/2026-09-25-charts-unification-review.md F05, F11, F12, F30; ADR 0042 (adoption)
---

# RM-184 Adopt the groups: hierarchy and relational (Treemap, Tree, Sankey, Network, ParallelCoordinates)

## Finding

- `SankeyChartProps` (`sankey-chart.tsx:45-83`) has no `accessibleLabel` / `accessibleDescription`, and SankeyChart never calls `useChartA11yContainerProps` (F30).
- Tree's `ChartTooltipBox` is the only one without `avoid` (F05); Tree has no `plotHeight` (F12).
- None of the five has `status` or `loading` (F11).

## Change

- Adopt `frame-size`, `legend` where the family has one, `tooltip` (Tree passes `avoid`), `chart-state`, `value-format`, and the ui `a11y` group on Sankey with a generated summary through the shared seam.

## Acceptance

- Defaults parity for every adopted family (explicit defaults render the same DOM as none).
- The manifest diff shows additions only.
- Visual baselines move only under review; each move is named in the PR.
- A Loading story and test for every newly adopted `status` (`loading-states` rule).
- Sankey: an axe test passes and the figure has an accessible name and description.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-responsive,loading-states,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` with `addon-a11y` on the five families, Chromium light and dark at 380 / 600 / 900 px.
