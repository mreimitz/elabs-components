---
id: RM-143
title: "Axis range selection: x and y, editable range bubbles, measure → dimension resolution, multi-thumb keyboard"
status: planned
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-142]
blocks: [RM-145]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/selection/range-select.tsx (new — axis gutter hit zones, band paint, bubbles)
  - packages/charts/src/charts/selection/range-bubble.tsx (new — ui `Input` in a positioned sibling; numeric / date entry)
  - packages/charts/src/charts/selection/range-thumbs.tsx (new — two `role="slider"` buttons outside the svg)
  - packages/charts/src/charts/x-axis.tsx, y-axis.tsx, bar-x-axis.tsx, bar-y-axis.tsx, distribution/distribution-value-axis.tsx (expose the gutter rect for arming)
  - packages/charts/src/charts/time-series-chart-shell.tsx, bar-chart.tsx, scatter-chart.tsx, distribution/distribution-chart.tsx, heatmap/* (mount when `selectionGestures` includes "range")
  - packages/charts/src/charts/selection/range-select.stories.tsx, *.test.tsx (new)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.3, §3.5, §3.8
---

# RM-143 Axis range selection

## Finding

- the associative BI suite: "You draw your selections on the y-axis or the x-axis. For an axis with measure values, you can click on the range bubble to enter a specific numeric value"; supported on bar, box, combo, distribution, histogram, line, scatter; the gesture starts "just outside the chart area" on the axis; on a time axis it "select[s] all data values (even those that are not visible)". the grammar-of-graphics library gets the same with `encodings: ["x"]`; the canvas chart library with `lineX`/`lineY`.
- No library besides the associative BI suite ships the editable bubble; none documents keyboard for it — the APG multi-thumb slider is the fit.

## Change

- **Arming**: with `"range"` in `selectionGestures`, the axis gutters (tick label zone) are hit zones; pointerdown there arms `range-x` / `range-y` in RM-142's machine. Inside the plot the pointer stays a pointer (tooltip/click) unless the mode is switched by the toolbar (RM-145) — the two never fight.
- **Paint**: the band across the plot in the gesture overlay; at each end a **range bubble** (a positioned sibling with the formatted bound; on a measure or time axis a click turns it into a ui `Input` — numeric or date — Enter applies, Esc reverts; on a category axis the bubbles show the first/last category, not editable).
- **Resolution** (RM-142's `resolve-intent`): dimension-axis range → the categories in the band; **measure-axis range → the dimension values whose measure (of the hovered/first series, or `of` when given) lies in `[lo, hi]`** — the intent carries `gesture: { kind: "range", axis: "y", geometry: { from, to, of } }` too, so a host that wants the numeric range has it; time axis → all rows in range, visible or not; stacked bars: dimension axis only (the associative BI suite's rule; the measure gutter is not armed).
- **Keyboard**: Tab reaches "Select a range on the X axis" (a real `<button>` in the datapoint layer's sibling); Enter creates a default band over the middle third and focuses the two thumbs (`role="slider"`, `aria-valuetext` in data terms); arrows ±1 step (category / tick step), Shift+arrows ±10, Home/End, PageUp/Down ±10 %; Enter commits, Esc cancels. The thumbs are the bubbles' keyboard form.
- Scatter and distribution: both axes; heatmap: column and row ranges (`range-x` over columns, `range-y` over rows).

## Acceptance

- Stories: x-range on a monthly line chart (bubbles show dates), y-range on a bar chart (intent lists the categories whose value is in range, assert against the fixture), y-range on a stacked bar (gutter not armed — asserted), both axes on a scatter, distribution value range, heatmap column range, `explicit` confirm (band stays until ✓ — the chrome itself is RM-145; here the story uses Enter/Esc).
- Play functions: drag on the gutter → intent with expected `values`; click a bubble, type `150`, Enter → the band moves and the intent updates; keyboard run end-to-end with `aria-valuetext` assertions.
- Axe clean; every thumb named ("Range start, Revenue: 120").

## Test / gate

Chart tests, `typecheck`, `pnpm check`, Storybook Chromium light + dark at three widths, keyboard GIF.

## Orchestrator notes

The measure-axis rule is the one people get wrong: it selects **dimension values**, never "rows with value between". Quote the associative BI suite page in the PR and test it with a series where two categories share a value.
