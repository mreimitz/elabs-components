---
id: RM-137
title: "`analytics/` stats core: reference computations, regression models + loess, window reduce, quantile / std-dev / CI, Holt-Winters — pure, golden-tested"
status: planned
priority: P0
effort: M (2 days)
wave: 0
depends_on: [RM-136]
blocks: [RM-138, RM-139]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/analytics/stats.ts (new — resolveAnalyticValue, quantile, stddev, ci)
  - packages/charts/src/charts/analytics/regression.ts (new — wraps d3-regression; loess)
  - packages/charts/src/charts/analytics/window.ts (new — rolling reduce, ewm)
  - packages/charts/src/charts/analytics/forecast.ts (new — Holt-Winters additive with prediction band)
  - packages/charts/src/charts/analytics/index.ts (new)
  - packages/charts/src/charts/analytics/*.test.ts (new — golden values)
  - packages/charts/src/charts/trend-line.tsx (fitTrend delegates to regression.ts; API unchanged)
  - packages/charts/package.json (d3-regression, d3-polygon; @types)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.1, §3.1, §3.3
---

# RM-137 Stats core

## Finding

- `fitTrend` in `trend-line.tsx` is the only statistic in the package: OLS `linear`/`log`, returning `slope`, `intercept`, `r2`, `predict`. Qlik ships 8 trend types (average, linear, poly 2/3/4, exp, log, power), Tableau 5 models with poly 2–8 and 95 % confidence bands, Power BI min/max/average/median/percentile lines; Vega-Lite and Observable Plot treat all of these as transforms.
- `decimateTimeSeries` (LTTB) exists; no rolling window or quantile code exists. `d3-array` (already a dep) has `mean`, `median`, `quantile`, `deviation`.

## Change

A framework-free module — no React, no DOM, no chart context — that every overlay in wave 1 calls:

- `resolveAnalyticValue(rows, key, value: AnalyticValue): number | null` — literal, `mean|median|min|max|sum`, `{ percentile }` (d3 `quantile`, R-7), `{ stddev, around }` (sample by default, `sample: false` for population), custom fn. Non-finite inputs skipped; `null` when nothing usable.
- `spreadBand(rows, key, spread): { from, to }` for `percentiles`, `stddev` (symmetric around mean/median), `ci` (t-based on the mean; n < 2 → null).
- `fitModel(points, model): ModelFit | null` — `linear|log|exp|pow|{poly:n}|{loess:bandwidth}` via d3-regression; returns `predict`, `rSquared` (loess: undefined), `coefficients`, `domain`; poly guarded by `n < rows`; `ci` → band via standard error of the regression (linear family only; document that loess/exp bands are not offered, as Tableau does for exponential).
- `windowReduce(values, { k, reduce, anchor, strict })` — Observable Plot semantics; `ewm` with `span`; returns `(number|null)[]` aligned to input.
- `forecastHoltWinters(values, { horizon, season, alpha?, beta?, gamma?, interval })` — additive trend + optional additive season, parameters fitted by grid search on SSE, prediction interval widened per step (the ETS AAN/AAA approximation); returns `{ points, lower, upper }`.
- `analytics/index.ts` exports the lot; `trend-line.tsx` keeps its public API and delegates.

## Acceptance

- Golden tests against published values: mean/median/quantile against d3-array on the same input; `linear` on Anscombe I gives slope 0.5001, intercept 3.0001, r² 0.6665; `exp`/`pow`/`log`/`poly` against the d3-regression README fixtures; `windowReduce` k=3 mean of `[1..5]` anchored `end` → `[null,null,2,3,4]`, `middle` → `[null,2,3,4,null]`; `forecastHoltWinters` on the classic airline series (12-season) gives MAPE < 5 % on the last 12 held-out months.
- 100 k-row `resolveAnalyticValue("mean")` under 5 ms in vitest; `fitModel({poly:6})` on 10 k points under 50 ms.
- `TrendLine` stories and `scatter-chart.test.tsx` unchanged and green.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`, `typecheck`, `lint`, `pnpm check --rule charts-honesty` (no `Math.random`). Bundle: `analytics/` tree-shakes — a chart without `analytics` must not pull d3-regression (assert with a `tsup` size snapshot in the test).

## Orchestrator notes

Pure TS: run this in parallel with RM-136's ADR write-up once the value union is agreed in chat; it must not import from `chart-context`.
