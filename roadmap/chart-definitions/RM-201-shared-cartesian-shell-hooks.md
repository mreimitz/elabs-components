---
id: RM-201
title: "Bar, Scatter and Candlestick on shared shell hooks; DensityScatter axes on the shared primitives"
status: planned
priority: P2
effort: L (4 days)
wave: 6
depends_on: [RM-182, RM-185, RM-188]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/time-series-chart-shell.tsx (scale, axis, navigator and phase hooks extracted)
  - packages/charts/src/charts/use-chart-phase-orchestrator.ts (called by Bar, Scatter and Candlestick)
  - packages/charts/src/charts/bar-chart.tsx (local `isPostOverlayComponent` without ChartBrush :604-617 goes; hit-test `groupGap` reads the `Bar` prop, :1386 / :1433; own reveal timer :1331-1349 goes)
  - packages/charts/src/charts/scatter-chart-shell.tsx, use-scatter-chart-interaction.ts, use-chart-interaction.ts (one interaction hook)
  - packages/charts/src/charts/candlestick-chart.tsx (local `isDefsComponent` :248-261 and reveal timer go)
  - packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (axes on the shared x / y axis primitives)
  - .changeset/*.md (minor — internal)
source: docs/review/2026-09-25-charts-unification-review.md F08, F22; ADR 0042 (optional convergence)
---

# RM-201 Bar, Scatter and Candlestick on shared shell hooks; DensityScatter axes on the shared primitives

## Finding

- Only Line, Area and Composed use `TimeSeriesChartInner`, the only caller of `useChartPhaseOrchestrator`. Bar (2136 LOC), Scatter and Candlestick each build their own scales, domains and reveal timers (F08).
- Bar's local `isPostOverlayComponent` omits ChartBrush; Bar's hit-testing hard-codes `groupGap` 4 although `<Bar>` exposes it; `use-scatter-chart-interaction.ts` is a near-copy of `use-chart-interaction.ts`; Candlestick keeps its own `isDefsComponent` (F08).
- DensityScatter's axes are private (F22, F24).

## Change

- Extract the shell's scale, axis, navigator and phase logic into hooks; Bar, Scatter and Candlestick call them. One interaction hook. DensityScatter draws its axes with the shared primitives.

## Acceptance

- Visual baselines unchanged.
- The tree-shake byte budget holds (`check-chart-treeshake.mjs`).
- Charts tests unchanged and green.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build && node packages/cli/scripts/check-chart-treeshake.mjs`, `pnpm test:stories` on the four families, Chromium light and dark at 380 / 600 / 900 px.
