---
"@elabs-ai/components-charts": minor
---

RM-137 (ADR 0040 §1): the framework-free `analytics/` stats core — `resolveAnalyticValue` / `spreadBand` (mean, median, min, max, sum, R-7 percentiles, sample/population std-dev, t-based confidence interval), `fitModel` (linear, log, exp, pow, poly 2–6, loess on d3-regression, with r², coefficients and a mean-response confidence band for the linear family), `windowReduce` (the notebook plotting library window semantics, plus an `ewm` reducer) and `forecastHoltWinters` (additive trend/season, grid-fitted parameters, widening prediction interval). `fitTrend` now delegates to `fitModel`; its API is unchanged.
