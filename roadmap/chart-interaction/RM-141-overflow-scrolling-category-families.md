---
id: RM-141
title: "Overflow scrolling on category families: `scrollbar` + `maxVisibleItems` on Bar / Composed / Heatmap, both orientations, auto-navigator on long series"
status: planned
priority: P1
effort: M (2 days)
wave: 2
depends_on: [RM-140]
blocks: [RM-146]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/bar-chart.tsx (index window: slice rows, keep scale per visible count, strip below or beside)
  - packages/charts/src/charts/bar-x-axis.tsx, bar-y-axis.tsx (ticks for the visible slice; category-axis-plan uses `maxVisibleItems`)
  - packages/charts/src/charts/category-axis-plan.ts (`maxVisibleItems` replaces the trim-to-fit cascade when a scrollbar is on)
  - packages/charts/src/charts/composed-chart.tsx (category mode)
  - packages/charts/src/charts/line-chart.tsx (category x-scale mode uses the index window)
  - packages/charts/src/charts/heatmap/* (column window)
  - packages/charts/src/charts/navigator/chart-navigator.tsx (vertical orientation for horizontal bars: strip on the right, `aria-orientation="vertical"`)
  - packages/charts/src/charts/bar-chart.stories.tsx, heatmap stories, *.test.tsx
  - packages/charts/src/auto-chart/* (`ChartSpec.scrollbar`, `maxVisibleItems`)
  - packages/charts/src/a2ui/charts-catalog.ts (+ regenerate)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.2, §3.4, §4
---

# RM-141 Category overflow

## Finding

- Qlik's bar/line/combo charts scroll discrete axes by index: "Number of bars: Auto/Custom" (`dimensionAxis.maxVisibleItems`, default 10), the mini chart appears when values exceed the width, `scrollStartPos` decides start/end, and it works for vertical and horizontal orientation ("left/top … right/bottom").
- `BarChart` today runs a trim cascade so the chart never overflows (`bar-chart.tsx` ~914, `category-axis-plan.ts`): with 200 categories the user gets 200 slivers or hidden labels, never a scroll.

## Change

- `BarChart`, `ComposedChart` (bar/category mode), `LineChart` (category x) and `HeatmapChart` accept `scrollbar`, `maxVisibleItems: Responsive<number>` (default `"auto"` = as many as fit the readable band width from `category-axis-plan`), `window`/`defaultWindow`/`onWindowChange` with `kind: "index"`, `align`.
- With a scrollbar on, the plan stops trimming: the band scale is built for `maxVisibleItems`, rows outside the window are not rendered (they stay in `data` for the honesty gate and the table flip), value axes keep the FULL data's domain by default (`windowDomain: "all" | "visible"`, Qlik keeps the axis stable while scrolling) — `"visible"` refits like ECharts `filterMode: "filter"`.
- Horizontal bars: the strip is a vertical navigator on the right edge (the shadow is the bar lengths condensed), handles announce "Row n of N".
- The datapoint layer, selection paint and annotations address rows by category, so they follow the window without change; the tooltip's row index is the row's index in `data`, not in the visible slice (assert).
- `AutoChart` / A2UI: `scrollbar` and `maxVisibleItems` in `ChartSpec`; the catalog text tells the agent "for > 30 categories set maxVisibleItems".

## Acceptance

- Stories: 120-category vertical bar chart with default mini chart, horizontal 80-row bar chart with the vertical strip, stacked bars scrolled with a stable value axis, `windowDomain="visible"` refit, heatmap with 365 day-columns, `scrollbar="bar"`, `align="end"`, narrow tier. Play: drag the window → the first visible category label changes accordingly; `onDatapointClick` on a visible bar returns the row's index in the full `data`; keyboard as in RM-140.
- Byte-identical DOM for a chart that fits (no strip mounted, no wrapper) — snapshot.
- The `charts-honesty` gate still passes (bars stay zero-based; hidden rows are a window, stated by the strip, not a dropped fact).

## Test / gate

Chart tests, `category-axis-plan.test.ts`, `pnpm check`, Storybook Chromium at three widths, both themes, keyboard run.

## Orchestrator notes

Ask the maintainer (RM-136 question b) before flipping the default to `"miniChart"` on bar charts — it changes how every overflowing bar chart on the home site looks. If undecided, ship default `"none"` and let RM-146 flip it after the site sweep.
