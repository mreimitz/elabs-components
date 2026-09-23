---
id: RM-139
title: "Trend, window, forecast and error-bar overlays as derived series with legend entry, tooltip row and a11y summary"
status: done
priority: P0
effort: M–L (3 days)
wave: 1
depends_on: [RM-137, RM-138]
blocks: [RM-146]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/analytics/derived-series.ts (new — trend/window/forecast → rows + LineConfig)
  - packages/charts/src/charts/analytics/analytic-series-layer.tsx (new — draws derived lines + bands on the family's scales)
  - packages/charts/src/charts/analytics/error-bars.tsx (new)
  - packages/charts/src/charts/time-series-chart-shell.tsx (mounts the layer; extends x-domain for forecast horizon)
  - packages/charts/src/charts/bar-chart.tsx (trend per series over category index; error bars per bar)
  - packages/charts/src/charts/scatter-chart.tsx (`trend` analytic supersedes `Scatter trend`; `describeScatterTrends` reads it)
  - packages/charts/src/charts/candlestick-chart.tsx, live-line-chart.tsx (window: SMA/EMA)
  - packages/charts/src/charts/legend/* (derived-series legend item: dashed marker, "Trend (r² 0.82)")
  - packages/charts/src/charts/tooltip/* (derived value row, muted)
  - packages/charts/src/charts/chart-a11y.tsx (summary sentence per analytic)
  - packages/charts/src/charts/analytics/analytics-models.stories.tsx (new)
  - packages/charts/src/a2ui/charts-catalog.ts (+ regenerate)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.1, §3.1, §4
---

# RM-139 Model overlays

## Finding

- `TrendLine` draws two endpoints of a straight fit on scatter (`trend-line.tsx`); a polynomial, loess or moving-average curve needs a path through many x positions, a legend entry (the analytics-pane BI suite lists trend lines; the associative BI suite labels them) and a tooltip row, none of which the mark has.
- the associative BI suite's moving average is a measure _modifier_ — the user sees "Sales (moving average, 3)" as the series; the notebook plotting library's `windowY` does the same as a transform. the report-builder BI suite's error bars are per-datum fields with an optional band on line charts.

## Change

- `derivedSeries(rows, analytic, ctx)` produces `{ rows: Row[], config: LineConfig, band?: { lowKey, highKey } }`:
  - `trend` — sampled at every x (category index or time) plus the `extent` ("data" default, "domain" extrapolates), model from RM-137; `ci` adds a band. Per `of` series or `"all"` (pooled).
  - `window` — aligned to the rows; `replace: true` hides the source series and the derived one takes its token and name suffix ("Sales · 3-mo avg"); default draws beside it in `--chart-foreground-muted`.
  - `forecast` — appends `horizon` future x values (time: stepped by the median interval; category: "+1", "+2"…), the time-series shell extends `xDomain` so the horizon is visible, band from the prediction interval, dashed path.
  - `errorBars` — whiskers per datum (bars, line points) from `low`/`high` fields or `{ percent }`; `band: true` on line/area draws the range as a band (the report-builder BI suite's error band).
- `AnalyticSeriesLayer` draws derived lines with the family's `Line` path helper (same curve, same reveal clip), bands with `AreaBand`; classified clip-included so they take part in the reveal after the series.
- Legend: derived entries appear after the real series with a dashed marker and the model text; `toggle` hides them like a series. Tooltip: a muted row "Trend 74.1" / "3-mo avg 71.9" / "Forecast 80.2 (76–84)". A11y: `describeAnalytics` sentence per overlay ("A linear trend rises, r² 0.82"; "A 3-month moving average"; "A 6-step forecast with a 95 % interval") joins the container description; `describeScatterTrends` becomes a consumer.
- Scatter's existing `trend` prop maps to `analytics: [{ kind: "trend", of: dataKey, model }]` (deprecated alias, warn once).

## Acceptance

- Stories: linear + poly-3 + loess trend on the same scatter (legend shows three entries, r² for the first two); trend per series on a 3-series line chart; `window` mean k=7 replacing a noisy daily series; `window` ewm beside it; forecast 6 steps with 95 % band on monthly data (x-axis shows the horizon ticks); SMA 20 / EMA 50 on `CandlestickChart`; error bars by field on `BarChart` and error band by percent on `LineChart`. Play functions assert the derived path's sampled `data-y` at three x values equals RM-137's `predict` on the fixture, the legend entry count, and the tooltip row text.
- Reduced motion: derived series do not animate separately from the reveal.
- The honesty gate passes: a forecast is visibly dashed and labelled; it never paints in the series token unless `replace`.

## Test / gate

Chart tests incl. `chart-legend.test.tsx`, tooltip tests, `chart-a11y` tests; Storybook Chromium light + dark at three widths; `pnpm check`.

## Orchestrator notes

Forecast and loess are the two places where "it renders" is not "it is right": the subagent must quote the golden-test numbers next to the screenshots. Anomaly detection and clustering are explicitly out (review §6); do not add them.
