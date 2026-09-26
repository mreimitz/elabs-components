---
id: RM-189
title: "Sizing and motion sources: one measurement path, one debounce, one reduced-motion source"
status: done
priority: P1
effort: M–L (3 days)
wave: 3
depends_on: [RM-182, RM-183, RM-184, RM-185]
blocks: [RM-196]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/layout-size.ts (one measurement path on `layoutSize` / `useLayoutMeasure`)
  - packages/charts/src/charts/radar-chart.tsx, area-chart.tsx, bar-chart.tsx, pie-chart.tsx, ring-chart.tsx, line-chart.tsx, live-line-chart.tsx, candlestick-chart.tsx, gauge.tsx, composed-chart.tsx (ParentSize sites)
  - packages/charts/src/charts/sankey/sankey-chart.tsx, packages/charts/src/charts/distribution/distribution-chart.tsx, packages/charts/src/charts/choropleth/choropleth-chart.tsx, packages/charts/src/charts/heatmap/heatmap-chart.tsx (ParentSize sites)
  - packages/charts/src/charts/network/network-chart.tsx, packages/charts/src/charts/funnel-chart.tsx, packages/charts/src/charts/unit-chart.tsx, packages/charts/src/charts/treemap/treemap-chart.tsx, packages/charts/src/charts/tree-chart.tsx, packages/charts/src/sparkline/sparkline.tsx, packages/charts/src/gantt/gantt.tsx (raw ResizeObserver sites)
  - packages/charts/src/charts/parent-size-debounce.test.tsx (one debounce constant)
  - packages/charts/src/charts/dumbbell-chart.tsx (`groupBy` honours the host and frame `plotHeight`, :1977-1999)
  - packages/charts/src/charts/line-chart-loading.tsx, area-chart-loading.tsx (`plotHeight`)
  - packages/charts/src/charts/live-line.tsx, network/network-node.tsx, chart-reveal-clip.tsx (reduced motion from the tokens package hook)
  - .changeset/*.md (minor — `plotHeight` on the Loading components)
source: docs/review/2026-09-25-charts-unification-review.md F11, F12, F18; ADR 0042 (frame-size and motion groups)
---

# RM-189 Sizing and motion sources: one measurement path, one debounce, one reduced-motion source

## Finding

- Measurement runs three ways: visx `ParentSize` in 14 files, `useLayoutMeasure` in 6 families plus canvas-layer, raw `ResizeObserver` in 7 families plus ChartCard, ChartFrame and ChartMultiples. Debounce is 10 almost everywhere but 100 on Area, Bar and Radar (F12).
- Dumbbell with `groupBy` re-derives the breakpoint and plot height itself and ignores a host or frame `plotHeight` (F12).
- LineChartLoading and AreaChartLoading default `aspectRatio="2 / 1"` and take no `plotHeight` (F11).
- Reduced motion comes from three sources: `motion/react`, the tokens package `useReducedMotion`, and raw `matchMedia` (F18). The tokens hook honours the person's explicit motion preference before the OS setting.
- Stagger values (seconds on Funnel and Bar, scales on Pie, Ring and Radar) are treated as durations in places (F18).

## Change

- One measurement hook built on `layout-size.ts` (correct under CSS transforms), used by every family; one debounce constant.
- Dumbbell `groupBy` reads the resolved `plotHeight`; the Loading components take `plotHeight`.
- One reduced-motion source: the tokens package `useReducedMotion`.
- Stagger stays a stagger: no code path multiplies a stagger as if it were a duration.

## Acceptance

- `charts-responsive` green; `motion-tokens` green.
- Baselines unchanged except moves named and reviewed in the PR.
- Dumbbell with `groupBy` inside a frame with a fixed `plotHeight` fills it (test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-responsive,motion-tokens`, `pnpm test:stories` (headless runs with reduced motion on), Chromium light and dark at 380 / 600 / 900 px.

## Follow-ups (left open by RM-189)

- Tree, Sparkline and Gantt still run their own `ResizeObserver`s. Tree reads the scroller's `clientWidth` (no scrollbar), Gantt the content box, Sparkline an `<svg>`; moving them onto `useLayoutMeasure` needs a content-box option on the hook first.
- ChartFrame, ChartCard, ChartMultiples, `ChartPlotRoot` (chart-breakpoint), the navigator and the tooltip keep their own observers.
- Other reduced-motion reads still come from `motion/react`: funnel, gauge, treemap, pie-slice, draw-path, shimmering-text, use-grid-shimmer, use-animated-y-domains, use-canvas-draw, gantt and gantt-bar; use-density-view calls `matchMedia` directly.
- `@visx/responsive` is still declared in the charts package.json but no longer imported; remove it in a dependency-cleanup item.
- `layoutSize` reads the used size from `getComputedStyle`, whose sub-pixel rounding (1/64 px) accounts for the small Gauge size difference against the old `ParentSize` rect.
- One debounce, leading + trailing (the orchestrator's option A): during a continuous drag a chart keeps the first step's size until 100 ms after the drag pauses. Families that followed each step before (every one but Area, Bar, Radar and Sankey) now lag during a drag.
