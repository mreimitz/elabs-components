---
id: RM-180
title: "Delete the 8 RM-146 restatement blocks"
status: planned
priority: P1
effort: S (1 day)
wave: 2
depends_on: [RM-179]
blocks: [RM-182, RM-183, RM-184, RM-185]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, composed-chart.tsx, bar-chart.tsx, scatter-chart.tsx, candlestick-chart.tsx (restatement blocks removed)
  - packages/charts/src/charts/heatmap/heatmap-chart.tsx, packages/charts/src/charts/distribution/distribution-chart.tsx (restatement blocks removed)
  - brand-ui.manifest.json (regenerated — the prop set is unchanged)
  - .changeset/*.md — none (no consumer-visible change)
source: docs/review/2026-09-25-charts-unification-review.md F10
---

# RM-180 Delete the 8 RM-146 restatement blocks

## Finding

- Line, Area, Composed, Bar, Scatter, Candlestick, Heatmap and Distribution restate `scrollbar`, `maxVisibleItems`, `selectionGestures`, `onSelectionIntent` and `selectionConfirm` on their own interfaces (the subset differs per family) only so the manifest lists them. RM-179 makes that unnecessary.

## Change

- Delete the eight blocks; the props stay reachable through `extends`.

## Acceptance

- `rg RM-146 packages/charts/src` returns 0.
- `pnpm gen:check` green; the manifest prop set of the eight containers equals RM-179's output.
- The public `.d.ts` of the eight containers still accepts every removed restatement (type test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck test`, `pnpm gen && pnpm gen:check`.
