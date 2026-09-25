---
id: RM-169
title: "Hygiene: ChartBrush `selection` read, missing type exports, Scatter `trend` `@deprecated`, MetricGrid `forwardRef`"
status: in-progress
priority: P1
effort: S (1 day)
wave: 1
depends_on: []
blocks: [RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/chart-brush.tsx (`selection` is read, not destructured as `_selection`, :244)
  - packages/charts/src/charts/chart-brush.test.tsx (new — a controlled `selection` draws the selection rect)
  - packages/charts/src/charts/index.ts (export `WaterfallLabelsConfig`, `WaterfallDataFormat`, `WaterfallSort`, `WaterfallEndpointOptions`, `DumbbellDeltaConfig`, `DumbbellValueAxisConfig`, `GaugeThreshold`, `GaugeLabels`)
  - packages/charts/src/charts/scatter.tsx (`@deprecated` TSDoc on `trend`, :118-124, naming the `analytics` trend)
  - packages/charts/src/charts/scatter-chart.stories.tsx (autodocs deprecation note)
  - packages/charts/src/metric-grid/metric-grid.tsx (`forwardRef` to the root; `HTMLAttributes` spread)
  - packages/charts/src/metric-grid/metric-grid.test.tsx (ref and attribute pass-through)
  - .changeset/*.md (minor — `### Deprecated`: Scatter `trend`)
source: docs/review/2026-09-25-charts-unification-review.md F35, F19, F37
---

# RM-169 Hygiene: ChartBrush `selection` read, missing type exports, Scatter `trend` `@deprecated`, MetricGrid `forwardRef`

## Finding

- `ChartBrush` documents `selection` ("Current selection … a visible selection rect is drawn", `chart-brush.tsx:60`) but destructures it as `_selection` (:244) and ignores it. ChartBrush itself is not deprecated: `chart-brush-layout.tsx:45` names it the retained in-plot zoom gesture.
- The charts barrel omits eight public prop types: `WaterfallLabelsConfig`, `WaterfallDataFormat`, `WaterfallSort`, `WaterfallEndpointOptions`, `DumbbellDeltaConfig`, `DumbbellValueAxisConfig`, `GaugeThreshold`, `GaugeLabels`.
- `<Scatter trend>` is deprecated only at runtime through `warnChartOnce`; its prop doc (`scatter.tsx:118-124`) has no `@deprecated` tag, so editors and autodocs never show it.
- `MetricGridProps` (`metric-grid.tsx:7-35`) does not extend `HTMLAttributes`, and `MetricGrid` (:69) is a plain function with no ref.

## Change

- ChartBrush draws the rect for a controlled `selection`, as its doc says.
- The eight types are exported from the charts barrel (type-only; no new runtime export).
- `trend` gets `@deprecated` TSDoc naming `analytics={[{ kind: "trend", … }]}` and an autodocs note — the full `docs/DEPRECATION.md` treatment, so the 6.0 removal (RM-205) is legitimate.
- `MetricGrid` forwards its ref to the root and spreads `HTMLAttributes` (merged `className` last via `cn()`).

## Acceptance

- A controlled `selection` renders the rect (test); an uncontrolled brush is DOM-identical to today.
- The eight types resolve from `@elabs-ai/components-charts` (type test or the dist `.d.ts` export list).
- `trend` shows as deprecated in the editor and in the Scatter autodocs.
- `ref` reaches the MetricGrid root element (test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule data-slot`, `pnpm gen && pnpm gen:check` (manifest picks up the exports), Storybook Scatter and MetricGrid stories in Chromium, light and dark.
