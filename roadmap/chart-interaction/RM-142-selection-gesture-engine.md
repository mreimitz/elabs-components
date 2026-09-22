---
id: RM-142
title: "Gesture engine `selection/`: pointer state machine (pointer / range / rect / lasso), containment + overlap hit-testing, visible-only rule, modifiers, touch"
status: planned
priority: P0
effort: M–L (3 days)
wave: 1
depends_on: [RM-136]
blocks: [RM-143, RM-144]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/selection/gesture-machine.ts (new — idle → armed → dragging → provisional → committed; mode; modifiers)
  - packages/charts/src/charts/selection/hit-test.ts (new — overlap for rects/bands, polygonContains for points, band-in-range, visible-only filter)
  - packages/charts/src/charts/selection/geometry.ts (new — pixel↔data conversions per axis kind: time, linear, band; lasso path simplification + snap-to-close)
  - packages/charts/src/charts/selection/resolve-intent.ts (new — hits → ChartSelectionIntent: field, values, mode from modifiers, datapoints)
  - packages/charts/src/charts/selection/use-chart-gesture.ts (new — pointer events with capture, touch long-press → lasso, wheel passthrough)
  - packages/charts/src/charts/selection/gesture-overlay.tsx (new — draws the in-progress rect / band / lasso path in furniture ink)
  - packages/charts/src/charts/selection/index.ts, *.test.ts (new)
  - packages/charts/src/charts/use-chart-interaction.ts (remove the dead `ChartSelection` drag state; the tooltip path stays)
  - packages/charts/src/charts/use-scatter-chart-interaction.ts (same)
  - packages/charts/src/charts/chart-context.tsx (`selection` removed from context; `registerMarkGeometry` seam for hit-testing)
  - packages/charts/src/charts/canvas-layer/hit-test.ts (containment query reuses the same helper)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.3, §3.5, §3.7, §3.9
---

# RM-142 Gesture engine

## Finding

- `use-chart-interaction.ts` and `use-scatter-chart-interaction.ts` each carry a `ChartSelection { startX, endX, startIndex, endIndex, active }` drag state that only lands in context — no paint, no callback, no consumer (grep shows `chart-context.tsx` L699 as the only reader). Two copies of a half-feature.
- The reference rules differ by product and need to be explicit: Power BI selects marks that _overlap_ the rectangle; Qlik's lasso takes _visible points only_ and an axis range on a time axis takes values _even if not visible_; Vega-Lite projects an interval onto one encoding (`encodings: ["x"]`) to get an axis band; picasso.js closes a lasso within a snap threshold and each trigger has an `action` (`toggle`).
- Marks are drawn by six families with different geometry (bands, points, cells, slices); one engine needs a geometry registry, not per-family gesture code.

## Change

- **Mark geometry registry**: every discrete mark family registers `{ id, category, seriesKey, datum, index, shape: rect | circle | polygon, visible }` in plot pixels through a tiny context (`registerMarkGeometry`), the same way `ChartDatapointLayer` already learns its targets; continuous series register their points. Cheap: the arrays the families already compute.
- **`gesture-machine.ts`**: pure reducer, `mode: "pointer" | "range-x" | "range-y" | "rect" | "lasso"`, phases idle → armed (pointerdown, `clickSensitivity` 4 px) → dragging → provisional (pointerup in `explicit` confirm) → committed; modifiers resolved at pointerdown (Shift → add, Ctrl/Cmd → toggle, plain → replace; in `explicit` mode plain → toggle). Esc cancels at any phase.
- **`hit-test.ts`**: `hitsInRect(marks, rect, { rule: "overlap" | "contain" })`, `hitsInPolygon(marks, path)` (d3-polygon `polygonContains` on the mark's centre; rects test all four corners for overlap), `hitsInBand(marks, axis, [a, b])`, and the visibility filter (`visible === false` marks are excluded for rect/lasso; included for axis ranges on a time axis).
- **`geometry.ts`**: pixel → data for `time`, `linear` and `band` scales (band → the categories whose band overlaps), lasso path simplification (Douglas-Peucker, 1.5 px) and `snapToClose` (12 px, picasso.js' rule).
- **`resolve-intent.ts`**: hits → `ChartSelectionIntent` (RM-136): `field` from `selectionField ?? xDataKey`, `values` = distinct categories of the hit marks (a measure-axis range on a bar chart therefore yields the _dimension_ values whose measure is in range — Qlik's semantics), `datapoints` built with the existing `ChartDatapoint` factory, `gesture.geometry` in data units.
- **`use-chart-gesture.ts`**: pointer events on the plot `<g>`, `setPointerCapture`, rAF-throttled move, touch: tap = click, long-press (400 ms) arms lasso (Qlik's "press and drag" on touch), two-finger gestures pass through to the navigator/zoom. Mouse-move tooltips keep working in `pointer` mode and are suppressed while dragging.
- **`gesture-overlay.tsx`**: the in-progress rect / band / lasso path in `--chart-foreground` hairline with a `--chart-background` halo (readable on any series), `pointer-events: none`, `aria-hidden`.
- Remove the dead drag state from both interaction hooks and from `chart-context`.

## Acceptance

- Unit tests: the reducer's full transition table; hit-test golden cases (a bar half inside a rect is hit with `overlap`, not with `contain`; a hidden point inside a lasso is not hit; a band range `[B, D]` on categories A…F yields B, C, D; a lasso whose last point is 10 px from the start closes; modifiers map to modes; `explicit` flips plain to toggle).
- A dev-only story "Selection/Engine" showing the overlay for each mode on a scatter, a bar chart and a line chart with `onSelectionIntent` logged to the Actions panel; play functions drive pointer sequences and assert the intent's `field`, `values` and `mode`.
- No consumer-visible change without `selectionGestures` set: DOM byte-identical (snapshot on three families).

## Test / gate

Chart tests, `typecheck`, `pnpm check`; the Engine story in Chromium with mouse and touch emulation.

## Orchestrator notes

This item ships no user-facing gesture on its own; RM-143 and RM-144 do. Keep it framework-light: the reducer and hit-tests are pure and must stay importable without React so the canvas layer and (later) the dashboard driver can call them.
