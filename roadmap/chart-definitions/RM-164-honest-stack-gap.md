---
id: RM-164
title: "Honest `stackGap`: symmetric inset at internal stack boundaries in `Bar` and `SeriesBar`"
status: in-progress
priority: P0
effort: S–M (1.5 days)
wave: 1
depends_on: []
blocks: [RM-182]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/bar-stacking.ts (one helper: inset symmetrically at internal boundaries only)
  - packages/charts/src/charts/bar.tsx (the segment loop at :645-673 uses the helper)
  - packages/charts/src/charts/series-bar.tsx (the segment loop at :73-96 uses the helper)
  - packages/charts/src/charts/bar-chart.tsx (`stackGap` reaches the painted geometry; tooltip `gapOffset` at :1424 follows it)
  - packages/charts/src/charts/bar-stacking.test.ts (geometry tests)
  - .changeset/*.md (minor)
source: docs/review/2026-09-25-charts-unification-review.md F14; ADR 0042 (skeptic major on `stackGap`)
---

# RM-164 Honest `stackGap`: symmetric inset at internal stack boundaries in `Bar` and `SeriesBar`

## Finding

- `BarChart.stackGap` (declared :217, default 0) does nothing visible: it is forwarded to `ChartInner` and used only as `gapOffset` for tooltip dot positions (`bar-chart.tsx:1424`), and not even there when stack extents exist. The painted gap comes only from the `Bar` child's own `stackGap` (default 0, `bar.tsx:243/436`).
- Wiring the container value into the child as it stands would be dishonest geometry: the child shifts each segment by `seriesIndex * stackGap` and shortens the non-last segments (`bar.tsx:645-673`), so the stack top sits `(n − 1) · gap` px above the true total and the bottom segment floats off the baseline. `series-bar.tsx:73-96` (ComposedChart, via `composedStackGap`) has the same algorithm.

## Change

- One helper in `bar-stacking.ts` insets each internal boundary symmetrically (half the gap from each neighbour); the outer edges — the baseline and the stack total — never move.
- `bar.tsx` and `series-bar.tsx` both call it; `BarChart.stackGap` reaches it; tooltip positions follow the painted geometry.

## Acceptance

- A geometry test per stack mode (stacked, percent, diverging): the stack's top y equals `scale(total)` and its bottom y equals the baseline, with and without a gap.
- The default `stackGap = 0` leaves pixels unchanged (existing snapshots and baselines identical).
- `BarChart stackGap={4}` paints a visible gap (story + test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts test` (bar-stacking, bar-chart, composed-chart), `pnpm check --rule charts-honesty`, Storybook stacked-bar stories in Chromium, light and dark.
