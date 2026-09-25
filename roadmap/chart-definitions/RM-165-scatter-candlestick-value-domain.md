---
id: RM-165
title: "Value domains: Scatter through a pure `resolveValueDomain`; Candlestick y over the window"
status: in-progress
priority: P0
effort: M (2 days)
wave: 1
depends_on: []
blocks: [RM-182]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/y-domain-utils.ts (pure `resolveValueDomain({ extents, zeroBased, signed, window, analyticsExtents })`)
  - packages/charts/src/charts/y-domain-utils.test.ts (new — zero baseline only when every value ≥ 0; signed padding below 0)
  - packages/charts/src/charts/scatter-chart-shell.tsx (its `resolveDomain` callback at :251-263 calls `resolveValueDomain`)
  - packages/charts/src/charts/candlestick-chart.tsx (y domain over the `filterDataByXDomain` rows, :180-205)
  - packages/charts/src/charts/scatter-chart.test.tsx, candlestick-chart.test.tsx
  - packages/charts/src/charts/scatter-chart.stories.tsx, candlestick-chart.stories.tsx (negative-values and windowed stories)
  - .changeset/*.md (minor)
source: docs/review/2026-09-25-charts-unification-review.md F25
---

# RM-165 Value domains: Scatter through a pure `resolveValueDomain`; Candlestick y over the window

## Finding

- Scatter clips negative y by default: its `resolveDomain` callback starts `maxValue` at 0 and returns `[0, max × 1.1]` (`scatter-chart-shell.tsx:251-263`); only a `YAxis` domain override escapes it. Bar (`resolveBarValueDomain`) and the time-series shell (`resolveTimeSeriesYDomain`) both extend below 0.
- Candlestick's `yScale` loops over the full `data` (`candlestick-chart.tsx:180-205`, deps `[innerHeight, data]`) even when the navigator or a caller's `xDomain` narrows the window. Line and Area refit y to the visible rows (`time-series-chart-shell.tsx:1121-1126`).
- Shared scaffolding already exists in `y-domain-utils.ts` (`computeYDomainsByAxis`, `niceYDomain`, `resolveYDomain`), so the fix extends it rather than adding a new domain module.

## Change

- `resolveValueDomain` in `y-domain-utils.ts`, pure, passed as the `resolveDomain` callback: a zero baseline only when every value is ≥ 0 (today's `[0, max × 1.1]` stays for that case); signed padding otherwise, as the time-series shell does; analytics widening kept.
- Candlestick computes its y domain over the rows `filterDataByXDomain` returns for the active window, as Line and Area do. With no window, the domain is unchanged. `windowDomain` stays a category-family prop.

## Acceptance

- A scatter with y in [−50, 80]: every point sits inside the plot (test on the rendered `cy` range).
- All-non-negative scatter data keeps today's domain (DOM-identical).
- Narrowing the Candlestick window to a sub-range rescales y to that sub-range's low and high (test on the scale domain); no window leaves it unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test` (y-domain-utils, scatter-chart, candlestick-chart), `pnpm check --rule charts-honesty`, Storybook negative-values and windowed stories in Chromium, light and dark.
