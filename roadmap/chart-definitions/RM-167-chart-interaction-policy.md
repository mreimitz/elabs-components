---
id: RM-167
title: "`useChartInteractionPolicy`: host `interactions` honoured by `ChartTooltipBox` and every gesture owner"
status: in-progress
priority: P0
effort: L (3–4 days)
wave: 1
depends_on: []
blocks: [RM-182, RM-184, RM-185]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/chart-config-context.tsx (export `useChartInteractionPolicy()`)
  - packages/charts/src/charts/tooltip/tooltip-box.tsx (`ChartTooltipBox` renders nothing when `passive` is false)
  - packages/charts/src/charts/gestures/use-window-zoom.ts, use-pinch-gesture.ts, category-zoom.tsx, chart-zoom-controls.tsx (`active`)
  - packages/charts/src/charts/navigator/chart-navigator.tsx, navigator-handles.tsx, use-navigator-gestures.ts, category-window.tsx (`active`)
  - packages/charts/src/charts/selection/container-selection.tsx, chart-gesture-layer.tsx (`select`)
  - packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (its private gesture machine: `active` for pan and zoom, `select` for rect, lasso and range)
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx, zoom-controls.tsx (zoom: `active`)
  - packages/charts/src/charts/tree-chart.tsx, tree-chart-viewport.tsx (zoom: `active`; the passive gate at :1361 moves onto the hook)
  - packages/charts/src/charts/canvas-layer/canvas-layer.tsx, canvas-selection.tsx (`select`)
  - packages/charts/src/charts/time-series-chart-shell.tsx (`zoomCandidate` at :497 honours `active`)
  - packages/charts/src/charts/chart-interaction-policy.test.tsx (new — loop over the 26 families with minimal fixtures)
  - .changeset/*.md (minor — adds `useChartInteractionPolicy`)
source: docs/review/2026-09-25-charts-unification-review.md F23, F05; ADR 0042 (skeptic major: every gesture owner named)
---

# RM-167 `useChartInteractionPolicy`: host `interactions` honoured by `ChartTooltipBox` and every gesture owner

## Finding

- `ChartInteractions { passive, active, select, edit }` (`chart-config-context.tsx:28-33`, defaults at :103) is read by only a few modules: ChartBrush, ChartDatapointLayer, ChartTooltip, ChartTooltipDot and TreeChart. Nothing under `selection/`, `navigator/`, `gestures/`, `canvas-layer/` or `annotations/` reads it.
- `ChartTooltipBox` reads only `tooltipBoxSpring` (`tooltip-box.tsx:258`): 13 files render it with no passive gate (bump, canvas-layer, choropleth-tooltip, density-scatter, distribution, dumbbell, heatmap-tooltip, network, parallel-coordinates, sankey-threads, sankey-tooltip, treemap, unit).
- The time-series shell reads `useChartConfig` only for `currency` (:980), so pinch and wheel zoom, the navigator strip and the gesture layers stay live under `interactions={{ active: false }}` (`zoomCandidate` at :497 ignores it).
- There is no policy helper today; `chart-config-context.tsx` exports only `useChartConfig`.

## Change

- `useChartInteractionPolicy()` returns `Required<ChartInteractions>` merged from `DEFAULT_CHART_INTERACTIONS` and the host config. Every owner reads it; none re-derives the merge.
- `passive: false` → no hover readout anywhere: `ChartTooltipBox` renders nothing, like `ChartTooltip` already does.
- `active: false` → no direct manipulation: pinch, wheel, touch and `+` / `−` / `0` zoom, `ChartZoomControls`, navigator window and handle drags, DensityScatter pan and zoom, Choropleth and Tree zoom, and the time-series shell's `zoomCandidate`.
- `select: false` → the selection gestures (container selection, the gesture layer, canvas-layer, DensityScatter rect / lasso / range) emit no `ChartSelectionIntent`.
- Tree's existing gate (`tree-chart.tsx:1361`) moves onto the hook.

## Acceptance

- A loop over `ChartFamilyName` (`test/doubles.tsx:99`) renders each family with minimal fixture data under `passive: false`, `active: false` and `select: false`, and asserts no tooltip box, no zoom or window change on pointer, wheel and key events, and no selection intent. Fixtures live in the test file; RM-175 moves them to `definitions/__fixtures__`.
- Any family jsdom cannot render runs the same assertions in a Storybook play test, and the test file lists those families by name.
- With the default policy the DOM is identical to today.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`, `pnpm check --rule charts-test-double`, `pnpm test:stories` for the listed play tests, keyboard path (`+` / `−` / `0`, navigator arrows) exercised in a play function, Chromium light and dark at 380 / 600 / 900 px.

## Orchestrator notes

`chart-config-context.tsx` is also touched by RM-173 (types move to a pure leaf); merge this item first.
