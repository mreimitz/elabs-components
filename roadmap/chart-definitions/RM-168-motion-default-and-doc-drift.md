---
id: RM-168
title: "Motion default constant, Ring duration, named Choropleth constant, and the documented-default fixes"
status: in-progress
priority: P1
effort: S–M (1.5 days)
wave: 1
depends_on: []
blocks: [RM-182, RM-183, RM-184, RM-185]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, composed-chart.tsx, bar-chart.tsx, scatter-chart.tsx, candlestick-chart.tsx (`animationDuration = DEFAULT_ANIMATION_DURATION_MS`; Line `aspectRatio` doc; Candlestick `Default: 1500` doc)
  - packages/charts/src/charts/sankey/sankey-chart.tsx (the same default, :504)
  - packages/charts/src/charts/radar-chart.tsx (`enterDurationMs` default from the constant, :232)
  - packages/charts/src/charts/ring-chart.tsx (reads `animationDuration` where Ring animates by duration, :77)
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx (a named constant for the 800 ms default, :1189)
  - packages/charts/src/charts/waterfall-chart.tsx (`valueFormat` doc, :1008)
  - packages/charts/src/charts/bump-chart.tsx (`palette` doc, :126)
  - packages/charts/src/charts/pie-grouping.ts (`sort` doc, :125)
  - packages/charts/src/charts/line.tsx (`loadingStroke` doc, :223)
  - packages/charts/src/sparkline/sparkline.tsx (`formatValue` doc, :139)
  - packages/charts/src/charts/parallel-coordinates/parallel-coordinates-chart.tsx (`aspectRatio` doc, :142-143)
  - .claude/rules/charts.md (the `height` alias is removed in 6.0.0, not 5.0.0 — :104-105)
  - .changeset/*.md (minor)
source: docs/review/2026-09-25-charts-unification-review.md F36, F18
---

# RM-168 Motion default constant, Ring duration, named Choropleth constant, and the documented-default fixes

## Finding

- `DEFAULT_ANIMATION_DURATION_MS` (`animation.ts:6`, 1100) is referenced only inside `animation.ts`. Seven containers hard-code `animationDuration = 1100`: Line (:420), Area (:427), Composed (:791), Bar (:1797), Scatter (:332), Candlestick (:367) and Sankey (:504). Radar hard-codes `enterDurationMs = 1100` (:232).
- Ring declares `animationDuration` (`ring-chart.tsx:77`) but never reads it. Choropleth defaults to a bare 800 (:1189).
- Seven documented defaults contradict the code, plus one the review added:
  1. `aspectRatio` "2 / 1" on Line and Parallel — the effective default is `DEFAULT_CHART_PLOT_HEIGHT` (2 / 1 wide, 1.25 narrow);
  2. Candlestick `animationDuration` "Default: 1500" — the code uses 1100;
  3. Waterfall `valueFormat` "locale number" — the real default is compact;
  4. Bump `palette` "ignored by lines" — `LinesPlot` applies it when no `highlightKey` is set;
  5. `pieLegendItems` `sort` "desc, mirrors PieChart" — PieChart itself defaults to `"none"`;
  6. `.claude/rules/charts.md:104-105` says the `height` alias goes in 5.0.0 — the code says 6.0.0;
  7. `Line.loadingStroke` "var(--foreground)" — the code uses `var(--chart-foreground)`;
  - +1: Sparkline `formatValue` "locale number formatting" — the default is compact.

## Change

- The seven `animationDuration = 1100` literals and Radar's `enterDurationMs = 1100` read `DEFAULT_ANIMATION_DURATION_MS`. The value stays 1100.
- Ring reads `animationDuration` where it animates by duration; its `enterTransition` and stagger stay as they are (a stagger is not a duration).
- Choropleth's 800 becomes a named constant. The value stays 800: the 1100 / 900 / 800 entry durations are unchanged unless the maintainer decides otherwise at 6.0.
- Each documented default states what the code does (the eight fixes above), in TSDoc and in `.claude/rules/charts.md`.

## Acceptance

- `rg "= 1100" packages/charts/src` finds nothing outside `animation.ts`.
- Visual baselines (`charts/__baselines__`) unchanged; existing motion tests unchanged.
- Each of the eight doc fixes names the value the code uses; a reviewer can check each against the cited line.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`, `pnpm check --rule motion-tokens,charts-honesty`, Storybook Ring and Choropleth stories in Chromium, light and dark.
