---
id: RM-140
title: "`ChartNavigator`: overview strip, time + index window, condensed min/max shadow, wheel / touch, multi-thumb keyboard, `minSpan`, `align`"
status: planned
priority: P0
effort: L (4 days)
wave: 1
depends_on: [RM-136]
blocks: [RM-141, RM-146]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/navigator/chart-navigator.tsx (new — strip: shadow + window + handles)
  - packages/charts/src/charts/navigator/navigator-window.ts (new — window model, clamp, minSpan, align, index↔time)
  - packages/charts/src/charts/navigator/condense-overview.ts (new — min/max-per-bucket condensation)
  - packages/charts/src/charts/navigator/navigator-handles.tsx (new — two `role="slider"` thumbs outside the svg)
  - packages/charts/src/charts/navigator/use-navigator-gestures.ts (new — drag window, drag handles, wheel, two-finger, click-to-locate)
  - packages/charts/src/charts/navigator/chart-navigator.stories.tsx, *.test.tsx (new)
  - packages/charts/src/charts/time-series-chart-shell.tsx (`scrollbar`/`window` props; strip mounted below the plot outside `plotHeight`; feeds `xDomain`/`xDomainSlotCount`)
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, composed-chart.tsx, candlestick-chart.tsx (prop pass-through)
  - packages/charts/src/charts/chart-brush-layout.tsx (deprecated alias re-implemented on the navigator; removed in 6.0)
  - packages/charts/src/charts/chart-brush.tsx (unchanged; documented as the in-plot zoom gesture)
  - packages/charts/src/charts/decimate-time-series.ts (export the bucket helper)
  - packages/charts/src/test/primitives.tsx (test double for the strip)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.2, §3.4
---

# RM-140 ChartNavigator

## Finding

- the associative BI suite shows a mini chart automatically "when the number of dimension values exceeds the width", with `scrollbar: "miniChart" | "bar" | "none"`, `scrollStartPos` 0/1 and, for large data, "a condensed version … in gray … the very low and the very high values are still visible". the stock-chart library' navigator borrows series 0 grouped at 2 px; the React chart library re-renders the child chart small (costly); one component suite and the stock-chart library (v11.2) expose the handles as sliders with keyboard.
- Ours: `ChartBrushLayout` is an unused render-prop seam; `ChartBrush` is an in-plot visx brush with no keyboard; the shell already applies `xDomain` and pads the scale by `xDomainSlotCount`; `decimateTimeSeries` is LTTB (does not guarantee extremes).

## Change

- `ChartNavigator` — a 40 px strip below the plot (outside `plotHeight`; 32 px on the narrow tier), containing:
  - the **shadow**: `condenseOverview(rows, keys, bucketCount)` → per pixel-bucket `min`/`max` of the pooled series, drawn as one `--chart-grid`-ink area between min and max (never the series ramp; no labels). Full series when rows ≤ buckets. A stacked-bar host passes the stack totals.
  - the **window**: a `--chart-foreground` outlined rect with `--chart-background` core (the compound trick from `chart-selection.ts`) over the shadow; outside dimmed with the existing `ChartBrushTrackOverlay` style.
  - two **handles** rendered as real `<button role="slider">` in a positioned sibling (like `ChartDatapointLayer`), `aria-valuemin/max/now`, `aria-valuetext` in data terms ("Mar 2024" / "Row 120 of 480"), grouped under `role="group" aria-label={t("navigator.label")}`; arrows ±1 step, Shift+arrows ±10, Home/End, PageUp/Down ±window; a live region announces the new range on commit.
- `navigator-window.ts` — `NavigatorWindow` (RM-136) with `clampWindow`, `minSpan` (default: 5× the median step, the stock-chart library' rule; index: 3), `align` (`"end"` starts at the latest data, the associative BI suite `scrollStartPos: 1`), `shiftWindow`, `zoomWindow`, and `indexToTime` / `timeToIndex` so the same strip serves both models.
- Gestures (`use-navigator-gestures.ts`, pointer events, `setPointerCapture`): drag the window, drag a handle, click outside the window to centre it there (the canvas chart library "click to locate"), wheel over the strip pans, two-finger horizontal pan on touch, pinch zooms; `realtime` updates the plot on every frame (rAF-throttled) and commits on release; `onWindowChange(window, { phase: "move" | "commit" })`.
- Time-series shell: `scrollbar` (default `"miniChart"` when `rows > maxVisiblePoints` (default 2 000, the associative BI suite's cap) or when `window` is controlled; `"bar"` = a plain ui `ScrollBar` strip; `"none"`), controlled `window` / `defaultWindow` / `onWindowChange`. The shell keeps feeding `xDomain` exactly as today; nothing in the plot changes.
- `ChartBrushLayout` becomes a deprecated wrapper over the navigator (same render-prop signature) and logs once.

## Acceptance

- Stories: 5 000-point line with auto navigator (shadow visibly keeps spikes present in the data), controlled window shared by two charts, `align="end"` on a live feed, `scrollbar="bar"`, `minSpan` clamp, narrow tier at 380 px. Play functions: drag the window by 100 px → `onWindowChange` commit with the expected dates; keyboard: Tab to the start handle, ArrowRight ×3 → `aria-valuenow` and the plot's first tick advance together; Home → window at data start; wheel event pans.
- The plot's DOM with `scrollbar="none"` is byte-identical to today (snapshot).
- `condenseOverview` test: for a series with one spike at index 3 141 of 10 000 and 200 buckets, the bucket containing it reports `max` equal to the spike.
- Performance: 50 000 rows → strip render under 16 ms after the first pass (memoised condensation), verified in a vitest benchmark.
- Axe: no violations; handles reachable; announcement text asserted.

## Test / gate

Chart tests, `pnpm check --rule charts-responsive` (`ChartPlotRoot` still the root), `chart-hairline`, Storybook Chromium light + dark at three widths with a keyboard run recorded as a GIF in the PR.

## Orchestrator notes

Land the window model + strip on the time-series shell only; category families are RM-141. Do not touch `use-chart-interaction.ts` — the dead drag-range state there is RM-142's to reuse or remove.
