---
id: RM-202
title: "RingChart on the Pie engine"
status: planned
priority: P2
effort: M–L (3 days)
wave: 6
depends_on: [RM-183]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/ring-chart.tsx, ring-context.tsx, ring-center.tsx, ring.tsx (on the Pie engine)
  - packages/charts/src/charts/pie-chart.tsx, pie-context.tsx, pie-center.tsx, pie-slice.tsx, pie-center-shell.tsx (the engine Ring reuses)
  - packages/charts/src/charts/ring-chart.test.tsx, pie-chart.test.tsx
  - .changeset/*.md (minor — internal)
source: docs/review/2026-09-25-charts-unification-review.md F28
---

# RM-202 RingChart on the Pie engine

## Finding

- RingChart is a structural fork of PieChart: parallel context files with a 12-colour list each, parallel datapoint-target builders, near-identical center components (about 40 lines differ of 121 / 115), copied child predicates, the d3 arc generator in four places, the same `setTimeout(…, 100)` load timer, duplicated fixed-size and `ParentSize` render branches (F28).

## Change

- Ring renders through the Pie engine: one arc generator, one load timer, one child predicate, one center component with the ring's differences as options. Ring's public props do not change.

## Acceptance

- Ring baselines and the Ring contract tests green.
- Ring's public prop types unchanged (dist `.d.ts` diff).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm test:stories` on Ring and Pie, Chromium light and dark at 380 / 600 / 900 px.

## Orchestrator notes

`chart-defs.ts` belongs to RM-204; this item merges the two pie / ring child predicates into the engine's one and leaves the shared helper alone.
