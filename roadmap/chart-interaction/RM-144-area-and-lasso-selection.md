---
id: RM-144
title: "Area + lasso selection: rectangle and polygon on points and marks, snap-to-close, keyboard rectangle, canvas-layer parity"
status: planned
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-142]
blocks: [RM-145]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/selection/area-select.tsx (new — rect + lasso arming inside the plot when the mode says so)
  - packages/charts/src/charts/selection/keyboard-rect.tsx (new — crosshair model: S, arrows, Space held grows, release commits)
  - packages/charts/src/charts/scatter-chart.tsx, time-series-chart-shell.tsx, bar-chart.tsx, heatmap/*, distribution/* (mount when `selectionGestures` includes "rect" / "lasso")
  - packages/charts/src/charts/pie-chart.tsx, treemap/* (lasso on slices/cells — P2, same helper, polygon centres)
  - packages/charts/src/charts/canvas-layer/canvas-layer.tsx (marks registered in the geometry registry so lasso works on canvas points)
  - packages/charts/src/charts/selection/area-select.stories.tsx, *.test.tsx (new)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.3, §3.7, §3.8
---

# RM-144 Area and lasso

## Finding

- Tableau: rectangular (default), radial, lasso. Power BI: Ctrl+drag rectangle with an _overlap_ rule on line, area, scatter, treemap, maps; keyboard rectangle: `S` shows a crosshair, arrows move it, Space held draws, release commits, Shift preserves, Ctrl replaces. Qlik: lasso by toolbar toggle or Shift, "only visible data points", snap-to-close (picasso.js). Plotly `lasso` returns the path; ECharts `polygon` returns `coordRange`.
- Ours: `ScatterChart` has nearest-point tooltips and a datapoint layer; the canvas layer has a nearest-point `hit-test.ts` but no containment.

## Change

- **Rect**: plain drag inside the plot when the toolbar mode is `rect` (RM-145), or **Shift+drag** in `pointer` mode on any family that lists `"rect"` (Qlik's Shift shortcut generalised); hit rule `overlap` by default (`selectionHitRule: "overlap" | "contain"`). Bars/cells: the rect against the mark rect; points: centre inside; line series: the registered points.
- **Lasso**: drag in `lasso` mode (toolbar) or Shift+Alt+drag; freehand path simplified at 1.5 px, closes on pointerup or when within 12 px of the start; `polygonContains` on mark centres, visible marks only; path drawn in the gesture overlay.
- **Radial** (Tableau) = a lasso preset from a centre and a radius: `selectionGestures: ["radial"]` draws the circle; cheap, so included.
- **Keyboard rectangle** (`keyboard-rect.tsx`): with the plot focused (`ChartDatapointLayer`'s container), `S` enters rectangle mode and shows a crosshair at the plot centre; arrows move it by one tick step (Shift ×10); holding Space starts the rectangle and arrows grow it; releasing Space commits with the modifier held at release (Shift add, Ctrl toggle); Esc cancels. A live region announces "12 points selected". This is also lasso's keyboard equivalent (documented in the story and the rule).
- **Intent**: `gesture.kind: "rect" | "lasso" | "radial"`, geometry in data units (rect: x/y ranges; lasso: the path; radial: centre + radius on both axes), `values` = distinct categories of the hits, `datapoints` = the hits (capped to the visible set; no 3 500 cap).
- Pie / treemap lasso: cells and slices register their centroid; ships if the shared helper needs no family code, otherwise deferred to a follow-up noted in the PR.

## Acceptance

- Stories: rect and lasso on a 2 000-point scatter (SVG) and on the canvas-layer scatter (same intent), Shift+drag rect on a line chart selecting the categories under it, lasso across bars with `overlap`, `contain` variant, radial on a scatter, keyboard rectangle end-to-end with announcement text asserted, touch long-press lasso under Chromium touch emulation.
- Play functions assert `values` and `datapoints.length` against fixture geometry; a point hidden by the window (RM-140) inside the lasso is NOT in the intent.
- Rect drawn in the gesture overlay is invisible to AT (`aria-hidden`) and the plot stays `ChartPlotRoot`.

## Test / gate

Chart tests incl. `canvas-layer/hit-test.test.ts`, `pnpm check`, Storybook Chromium light + dark at three widths, keyboard GIF, touch emulation run.

## Orchestrator notes

Do not add zoom-by-rectangle here (Highcharts/Recharts style) — zoom stays `ChartBrush`/`@visx/zoom`; a rectangle in this package selects. If the maintainer wants "draw selection" (Qlik's freehand stroke through marks), it is a stroke-vs-mark intersection on the same registry — note it in the PR, don't build it.
