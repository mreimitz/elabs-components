---
id: RM-138
title: "`analytics[]` computed lines and bands on every annotation-bearing container + scatter + distribution; `ChartSpec.analytics`; A2UI catalog"
status: planned
priority: P0
effort: M (2 days)
wave: 1
depends_on: [RM-137]
blocks: [RM-139, RM-146]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/analytics/resolve-analytics.ts (new — analytics[] → annotations + derived series)
  - packages/charts/src/charts/analytics/analytics-label.ts (new — LabelMode → text, "Average: 73.8" via the value formatter)
  - packages/charts/src/charts/annotations/with-chart-annotations.tsx (merges resolved analytics into the annotation layer)
  - packages/charts/src/charts/annotations/annotation-types.ts (`ifOverflow` on line/range; `computation` label token)
  - packages/charts/src/charts/scatter-chart.tsx, distribution/distribution-chart.tsx (accept `analytics`)
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, bar-chart.tsx, composed-chart.tsx, dumbbell-chart.tsx, waterfall-chart.tsx, candlestick-chart.tsx (prop pass-through only)
  - packages/charts/src/charts/reference-line.tsx (accepts `AnalyticValue`; thin wrapper)
  - packages/charts/src/charts/distribution/distribution-reference-line.tsx (accepts `AnalyticValue`)
  - packages/charts/src/auto-chart/* (`ChartSpec.analytics`)
  - packages/charts/src/a2ui/charts-catalog.ts (+ regenerate catalog.generated.ts)
  - packages/charts/src/charts/analytics/analytics.stories.tsx (new)
  - packages/charts/src/charts/analytics/*.test.tsx
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §2.1, §3.1–3.2, §4
---

# RM-138 Computed lines and bands

## Finding

- `annotations[{kind:"line"}]` already paints a literal line on either drawn axis on 7 containers, with `style`/`width`/`label` (`annotation-types.ts` L108–125); `kind:"range"` paints a band with pattern/colour/opacity. What is missing is the number: Power BI's Min/Max/Average/Median/Percentile lines and Tableau's distribution bands (percentiles, quantiles, std-dev, CI) are all "compute, then draw a line/band".
- `ReferenceLine` only draws when the value is inside the y-domain (Qlik's rule); Recharts offers `ifOverflow: "extendDomain"`. Both are legitimate; the caller should choose.

## Change

- `resolveAnalytics(rows, spec[], ctx)` turns `line`/`band` analytics into annotation entries (positions in data units, on the axis the caller named, using RM-137's `resolveAnalyticValue`/`spreadBand`), with the label from `LabelMode`: `"value"` → formatted number through `useChartValueFormatter`; `"computation"` → localised `t("analytics.mean")` + value ("Average 73.8"); string → as given. Result is appended to the container's own `annotations` before `withChartAnnotations` runs — the annotation layer's collision pass, narrow-tier numbered markers and accessible description come for free.
- `ifOverflow: "extend"` widens the affected axis domain through the existing `yScaleDomainMax`/`resolveYDomain` seam; `"clip"` (default) keeps today's behaviour.
- `when?: (rows) => boolean` is Qlik's show-condition.
- `of: dataKey | "all"` — statistic of one series or of every series' values pooled.
- Scatter gets `analytics` on both axes (Qlik's X-axis/Y-axis reference lines); Distribution maps `line`/`band` onto its value axis through `DistributionReferenceLines`.
- `ReferenceLine value` and `DistributionReferenceLine value` accept `AnalyticValue` — `<ReferenceLine value="mean" label="computation" />` works with no other change.
- `ChartSpec.analytics` mirrors the prop; the A2UI catalog description lists the kinds and the value union so the agent can ask for "an average line and the 25–75 percentile band".

## Acceptance

- Stories: Average line on `LineChart`, Median + quartile band on `BarChart` (horizontal), Min/Max lines on `AreaChart`, `{ percentile: 90 }` line with `ifOverflow: "extend"` (domain grows), std-dev ±1 band on `ScatterChart` on both axes, CI band on `DistributionChart`, a `when` condition that hides the line when the mean is below a threshold — each with a play function asserting the line's `data-value` equals the value computed by RM-137 on the same fixture.
- The River recipe stories (`recipes/river-recipes.stories.tsx`) gain one analytic each without visual regression elsewhere (`__baselines__` diff limited to the new ink).
- Accessible description of a chart with an average line contains "Average 73.8" (localised key), verified in the a11y test.
- `AutoChart` renders `spec.analytics`; A2UI `charts-catalog.test.ts` validates a spec with `analytics`.

## Test / gate

Chart tests, `pnpm check --rule chart-hairline` (band and line are furniture ink at full opacity), `charts:honesty:check`, Storybook play functions in Chromium light + dark at 380 / 600 / 900 (narrow tier: labels fall back to numbered markers like RM-111).

## Orchestrator notes

Keep the painter untouched: if a case seems to need a new mark, it is a `line` or `range` annotation with a computed position — push the computation into `resolveAnalytics`, not the annotation layer.
